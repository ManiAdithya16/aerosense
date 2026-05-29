"""
NASA C-MAPSS FD001 — Multi-Model Training & Stacking Ensemble
=============================================================
Trains XGBoost, LightGBM, RandomForest, GradientBoosting and a
Stacking Ensemble to predict Remaining Useful Life (RUL).

Uses the same 17 base features as the existing app.py so the
same scaler.pkl stays compatible.

Run:  python train_models.py
Outputs:
  xgb_model.pkl          — tuned XGBRegressor
  lgbm_model.pkl         — tuned LGBMRegressor  (if lightgbm installed)
  rf_model.pkl           — tuned RandomForestRegressor
  gbr_model.pkl          — GradientBoostingRegressor
  ensemble_model.pkl     — StackingRegressor (XGB+LGBM+RF+GBR → Ridge)
  scaler.pkl             — MinMaxScaler (17 features, replaces old one)
  best_rul_model.ubj     — best XGBoost (app.py backward-compat name)
  model_comparison.json  — metrics for all models
"""

import os
import json
import time
import warnings
import numpy as np
import pandas as pd
import joblib

from sklearn.preprocessing import MinMaxScaler
from sklearn.ensemble import (
    RandomForestRegressor,
    GradientBoostingRegressor,
    StackingRegressor,
)
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from xgboost import XGBRegressor

try:
    import lightgbm as lgb
    HAS_LGBM = True
except ImportError:
    HAS_LGBM = False
    print("LightGBM not installed. Run:  pip install lightgbm")
    print("Continuing without LightGBM…\n")

warnings.filterwarnings("ignore")

# ── CONFIG ────────────────────────────────────────────────────────────────────
DATA_FILE   = "train_FD001.txt"
RUL_CEILING = 125
RANDOM_SEED = 42

RAW_COLS = [
    "unit_number","time_cycles","setting_1","setting_2","setting_3",
    "T2","T24","T30","T50","P2","P15","P30","Nf","Nc","epr","Ps30",
    "phi","NRf","NRc","BPR","farB","htBleed","Nf_dmd","PCNfR_dmd",
    "W31","W32"
]
CONSTANT_COLS = ["setting_3","T2","P2","epr","farB","Nf_dmd","PCNfR_dmd"]
FEATURES = [c for c in RAW_COLS
            if c not in ["unit_number","time_cycles"] + CONSTANT_COLS]
# → 17 features, same as existing app.py

_RUL_FD001 = [
    112, 98, 69, 82, 91, 93, 91, 95,111, 96,
     97,124, 95,107, 83, 84, 50, 28, 87, 16,
     57,111,113, 20,145,119, 66, 97, 90,115,
      8, 48,106,  7, 11, 19, 21, 50,142, 28,
     18, 10, 59,109,114, 47,135, 92, 21, 79,
    114,133, 75, 96, 67, 91, 32, 92, 64, 89,
    119, 23, 73, 16, 71,117, 16, 24, 21,132,
     39, 75, 33, 33, 33, 78, 28, 53, 84,122,
     53, 80, 12, 51, 53, 18,134, 32, 41,121,
     21, 87, 23, 86, 27, 16, 23, 51, 22, 31,
]

# ── HELPERS ───────────────────────────────────────────────────────────────────
def nasa_score(y_true, y_pred, ceiling=125.0):
    yt = np.minimum(np.asarray(y_true, float), ceiling)
    yp = np.minimum(np.asarray(y_pred, float), ceiling)
    d  = yp - yt
    return float(np.sum(np.where(d < 0, np.exp(-d / 13) - 1, np.exp(d / 10) - 1)))

def eval_metrics(name, y_true, y_pred, t0):
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    mae  = float(mean_absolute_error(y_true, y_pred))
    r2   = float(r2_score(y_true, y_pred))
    ns   = nasa_score(y_true, y_pred)
    return {"model": name, "rmse": round(rmse,4), "mae": round(mae,4),
            "r2_score": round(r2,4), "nasa_score": round(ns,2),
            "training_time_sec": round(time.time()-t0, 2)}

def show(m):
    print(f"  RMSE       : {m['rmse']:.4f}")
    print(f"  MAE        : {m['mae']:.4f}")
    print(f"  R2         : {m['r2_score']:.4f}")
    print(f"  NASA Score : {m['nasa_score']:.2f}  (lower is better)")
    print(f"  Train time : {m['training_time_sec']}s")

# ── LOAD & PREPROCESS ─────────────────────────────────────────────────────────
print("=" * 60, flush=True)
print(" NASA C-MAPSS FD001  --  Multi-Model Training")
print("=" * 60, flush=True)

if not os.path.exists(DATA_FILE):
    raise FileNotFoundError(
        f"'{DATA_FILE}' not found. Place it in the same directory.")

df = pd.read_csv(DATA_FILE, sep=r"\s+", header=None, names=RAW_COLS,
                 engine="python")
df.drop(columns=CONSTANT_COLS, inplace=True)

df["RUL"] = (df.groupby("unit_number")["time_cycles"]
               .transform("max") - df["time_cycles"])
df["RUL"] = df["RUL"].clip(upper=RUL_CEILING)

# Scale
scaler = MinMaxScaler()
df[FEATURES] = scaler.fit_transform(df[FEATURES])
joblib.dump(scaler, "scaler.pkl")
print(f"\nScaler saved (17 features).")

# Build NASA-convention test split (one row per engine)
units = sorted(df["unit_number"].unique())
test_rows, test_idx = [], []
for i, u in enumerate(units):
    g      = df[df["unit_number"] == u].sort_values("time_cycles")
    target = int(min(_RUL_FD001[i], len(g) - 1))
    cutoff = len(g) - 1 - target
    row    = g.iloc[cutoff]
    test_rows.append(row)
    test_idx.append(row.name)

test_df  = pd.DataFrame(test_rows).reset_index(drop=True)
train_df = df.drop(index=test_idx).reset_index(drop=True)

X_tr = train_df[FEATURES].values
y_tr = train_df["RUL"].values
X_te = test_df[FEATURES].values
y_te = test_df["RUL"].values

print(f"Training rows : {len(X_tr):,}")
print(f"Test engines  : {len(X_te)}")
print(f"Features      : {len(FEATURES)}\n")

results = []

# ── 1. XGBOOST ────────────────────────────────────────────────────────────────
print("-" * 50)
print("[1/5] XGBoost Regressor")
t0  = time.time()
xgb_m = XGBRegressor(
    n_estimators     = 500,
    max_depth         = 6,
    learning_rate     = 0.04,
    subsample         = 0.8,
    colsample_bytree  = 0.8,
    reg_alpha         = 0.1,
    reg_lambda        = 1.0,
    min_child_weight  = 3,
    n_jobs            = -1,
    random_state      = RANDOM_SEED,
    verbosity         = 0,
)
xgb_m.fit(X_tr, y_tr,
           eval_set=[(X_te, y_te)],
           verbose=False)
m = eval_metrics("XGBoost", y_te, xgb_m.predict(X_te), t0)
results.append(m); show(m)
joblib.dump(xgb_m, "xgb_model.pkl")
xgb_m.save_model("best_rul_model.ubj")  # backward-compat for app.py

# ── 2. LIGHTGBM ───────────────────────────────────────────────────────────────
lgbm_m = None
if HAS_LGBM:
    print("-" * 50)
    print("[2/5] LightGBM Regressor")
    t0 = time.time()
    lgbm_m = lgb.LGBMRegressor(
        n_estimators     = 600,
        num_leaves        = 63,
        learning_rate     = 0.04,
        feature_fraction  = 0.8,
        bagging_fraction  = 0.8,
        bagging_freq      = 5,
        min_child_samples = 20,
        reg_alpha         = 0.05,
        reg_lambda        = 0.5,
        n_jobs            = -1,
        random_state      = RANDOM_SEED,
        verbose           = -1,
    )
    lgbm_m.fit(X_tr, y_tr,
               eval_set=[(X_te, y_te)],
               callbacks=[lgb.early_stopping(50, verbose=False),
                          lgb.log_evaluation(period=-1)])
    m = eval_metrics("LightGBM", y_te, lgbm_m.predict(X_te), t0)
    results.append(m); show(m)
    joblib.dump(lgbm_m, "lgbm_model.pkl")
else:
    print("[2/5] LightGBM — SKIPPED (not installed)")

# ── 3. RANDOM FOREST ──────────────────────────────────────────────────────────
print("-" * 50)
print("[3/5] Random Forest Regressor")
t0 = time.time()
rf_m = RandomForestRegressor(
    n_estimators    = 300,
    max_depth        = 20,
    min_samples_split= 5,
    min_samples_leaf = 2,
    max_features     = "sqrt",
    n_jobs           = -1,
    random_state     = RANDOM_SEED,
)
rf_m.fit(X_tr, y_tr)
m = eval_metrics("RandomForest", y_te, rf_m.predict(X_te), t0)
results.append(m); show(m)
joblib.dump(rf_m, "rf_model.pkl")

# ── 4. GRADIENT BOOSTING ──────────────────────────────────────────────────────
print("-" * 50)
print("[4/5] Gradient Boosting Regressor (sklearn)")
t0 = time.time()
gbr_m = GradientBoostingRegressor(
    n_estimators    = 400,
    max_depth        = 5,
    learning_rate    = 0.04,
    subsample        = 0.8,
    min_samples_split= 5,
    random_state     = RANDOM_SEED,
)
gbr_m.fit(X_tr, y_tr)
m = eval_metrics("GradientBoosting", y_te, gbr_m.predict(X_te), t0)
results.append(m); show(m)
joblib.dump(gbr_m, "gbr_model.pkl")

# ── 5. STACKING ENSEMBLE ──────────────────────────────────────────────────────
print("-" * 50)
print("[5/5] Stacking Ensemble  (XGB + LightGBM + RF + GBR  ->  Ridge)")
print("      (5-fold CV stacking — may take a few minutes…)")
t0 = time.time()

base_estimators = [
    ("xgb", XGBRegressor(
        n_estimators=300, max_depth=5, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, min_child_weight=3,
        random_state=RANDOM_SEED, verbosity=0, n_jobs=-1)),
    ("rf",  RandomForestRegressor(
        n_estimators=200, max_depth=15, max_features="sqrt",
        min_samples_leaf=2, n_jobs=-1, random_state=RANDOM_SEED)),
    ("gbr", GradientBoostingRegressor(
        n_estimators=200, max_depth=4, learning_rate=0.06,
        subsample=0.8, random_state=RANDOM_SEED)),
]
if HAS_LGBM:
    base_estimators.insert(1, (
        "lgbm", lgb.LGBMRegressor(
            n_estimators=300, num_leaves=47, learning_rate=0.05,
            feature_fraction=0.8, bagging_fraction=0.8, bagging_freq=5,
            min_child_samples=20, n_jobs=-1,
            random_state=RANDOM_SEED, verbose=-1)
    ))

ensemble = StackingRegressor(
    estimators      = base_estimators,
    final_estimator = Ridge(alpha=10.0),
    cv              = 5,
    n_jobs          = -1,
    passthrough     = False,
)
ensemble.fit(X_tr, y_tr)
y_ens = ensemble.predict(X_te)
m = eval_metrics("StackingEnsemble", y_te, y_ens, t0)
results.append(m); show(m)
joblib.dump(ensemble, "ensemble_model.pkl")

# Per-engine actual vs predicted (for API)
avp_ens = [
    {
        "engine":    i + 1,
        "actual":    round(float(y_te[i]), 1),
        "predicted": round(float(y_ens[i]), 1),
        "error":     round(float(abs(y_ens[i] - y_te[i])), 1),
    }
    for i in range(len(y_te))
]

# ── COMPARISON TABLE ──────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print(" MODEL COMPARISON  (100 FD001 test engines)")
print("=" * 60, flush=True)
print(f"{'Model':<24} {'RMSE':>8} {'MAE':>8} {'R2':>8} {'NASA(v)':>10}")
print("-" * 60)
for r in sorted(results, key=lambda x: x["rmse"]):
    print(f"{r['model']:<24} {r['rmse']:>8.4f} {r['mae']:>8.4f}"
          f" {r['r2_score']:>8.4f} {r['nasa_score']:>10.2f}")
print("=" * 60, flush=True)

best = min(results, key=lambda x: x["rmse"])
print(f"\nBest model by RMSE: {best['model']}  (RMSE={best['rmse']:.4f})")

# Save comparison JSON (served by /api/ensemble-metrics)
comparison = {
    "models":              results,
    "best_model":          best["model"],
    "features":            FEATURES,
    "n_features":          len(FEATURES),
    "rul_ceiling":         RUL_CEILING,
    "test_engines":        int(len(y_te)),
    "training_rows":       int(len(y_tr)),
    "base_learners":       [e[0] for e in base_estimators],
    "meta_learner":        "Ridge(alpha=10)",
    "stacking_cv_folds":   5,
    "actual_vs_predicted": avp_ens,
}
with open("model_comparison.json", "w") as f:
    json.dump(comparison, f, indent=2)

print("\nFiles saved:")
print("  ensemble_model.pkl, xgb_model.pkl, rf_model.pkl, gbr_model.pkl")
if HAS_LGBM:
    print("  lgbm_model.pkl")
print("  scaler.pkl, best_rul_model.ubj, model_comparison.json")
