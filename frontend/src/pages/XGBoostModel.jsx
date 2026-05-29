import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, ReferenceLine,
  Legend, Cell, LabelList
} from 'recharts';
import {
  BarChart2, RefreshCw, AlertTriangle, CheckCircle,
  Trophy, Layers, Target, Activity, Cpu, GitMerge
} from 'lucide-react';
import api from '../services/api';

// ── Shared tooltip style ──────────────────────────────────────────────────────
const TIP = {
  backgroundColor: 'var(--color-card)',
  borderColor:     'var(--color-border)',
  borderRadius:    '8px',
  fontSize:        '12px',
  color:           'var(--color-text)',
};

// Per-model colours & labels
const M_COLOR = {
  XGBoost:          '#3b82f6',
  LightGBM:         '#a855f7',
  RandomForest:     '#22c55e',
  GradientBoosting: '#f97316',
  StackingEnsemble: '#ec4899',
};
const M_SHORT = {
  XGBoost:          'XGBoost',
  LightGBM:         'LightGBM',
  RandomForest:     'RandomForest',
  GradientBoosting: 'GradBoost',
  StackingEnsemble: 'Stacking',
};

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3">
      <RefreshCw size={26} className="animate-spin text-accent" />
      <p className="text-sm text-muted">Loading model metrics…</p>
    </div>
  );
}

function ErrorBanner({ msg, hint }) {
  return (
    <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/20
                    border border-red-200 dark:border-red-800/40 rounded-xl p-4">
      <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold text-sm text-red-700 dark:text-red-400">{msg}</p>
        {hint && <p className="text-xs text-red-600/70 dark:text-red-400/60 mt-1">{hint}</p>}
      </div>
    </div>
  );
}

function SectionHead({ Icon, title, sub, badge }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h2 className="font-bold text-base text-text flex items-center gap-2">
          <Icon size={15} className="text-accent shrink-0" />{title}
        </h2>
        {sub && <p className="text-[11px] text-muted mt-0.5">{sub}</p>}
      </div>
      {badge && (
        <span className="text-[10px] font-bold uppercase tracking-wider
                         bg-accent/10 text-accent border border-accent/20
                         px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap">
          {badge}
        </span>
      )}
    </div>
  );
}

function StatCard({ label, value, unit, sub, color = 'text-sky-600', bg = 'bg-sky-50 border-sky-200 dark:bg-sky-950/20 dark:border-sky-800/30' }) {
  return (
    <div className={`${bg} border rounded-xl p-4`}>
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted mb-1">{label}</p>
      <p className={`text-2xl font-black font-mono ${color}`}>
        {value}
        {unit && <span className="text-xs text-muted font-normal ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-[11px] text-muted mt-1 truncate">{sub}</p>}
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────
function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors
        ${active
          ? 'bg-accent text-white shadow-sm'
          : 'text-muted hover:text-text hover:bg-card2'}`}
    >
      {children}
    </button>
  );
}

// ── Custom tooltips ───────────────────────────────────────────────────────────
function AvPTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-bold mb-1 text-text">Engine #{d.engine}</p>
      <p className="text-sky-500 font-mono">Actual: {d.actual} cyc</p>
      <p className="text-orange-400 font-mono">Predicted: {d.predicted} cyc</p>
      <p className="text-red-400 font-mono">|Error|: {d.error} cyc</p>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function XGBoostModel() {
  const [xgb,      setXgb]      = useState(null);
  const [ensemble, setEnsemble] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [errors,   setErrors]   = useState({});
  const [tab,      setTab]      = useState('comparison'); // comparison | xgboost | ensemble

  useEffect(() => {
    let done = 0;
    const finish = () => { done++; if (done === 2) setLoading(false); };

    api.get('/xgboost-metrics')
      .then(({ data }) => setXgb(data))
      .catch(e => setErrors(prev => ({ ...prev, xgb: e.response?.data?.detail || e.message })))
      .finally(finish);

    api.get('/ensemble-metrics')
      .then(({ data }) => setEnsemble(data))
      .catch(e => setErrors(prev => ({ ...prev, ens: e.response?.data?.detail || e.message })))
      .finally(finish);
  }, []);

  if (loading) return <LoadingState />;

  // ── Derived data ─────────────────────────────────────────────────────────
  const models = ensemble?.models || [];
  const sorted = [...models].sort((a, b) => a.rmse - b.rmse);
  const bestModel = ensemble?.best_model || 'XGBoost';

  const compBar = sorted.map(m => ({
    name:   M_SHORT[m.model] || m.model,
    full:   m.model,
    rmse:   +m.rmse.toFixed(2),
    nasa:   +m.nasa_score.toFixed(1),
    r2:     +m.r2_score.toFixed(4),
    color:  M_COLOR[m.model] || '#64748b',
    isBest: m.model === bestModel,
  }));

  const avpXgb = xgb?.actual_vs_predicted || [];
  const avpEns = ensemble?.actual_vs_predicted || [];

  const fiData = (xgb?.feature_importances || []).map(f => ({
    sensor: f.sensor,
    imp:    +f.importance.toFixed(4),
  }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-5 space-y-5 pb-10">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple
                          flex items-center justify-center shadow-md shrink-0">
            <BarChart2 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-text">Models &amp; Performance</h1>
            <p className="text-xs text-muted">NASA C-MAPSS FD001 · All models · One page</p>
          </div>
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div className="flex gap-2 p-1 bg-card2/60 border border-border rounded-xl w-fit">
          <Tab active={tab === 'comparison'} onClick={() => setTab('comparison')}>
            Model Comparison
          </Tab>
          <Tab active={tab === 'xgboost'} onClick={() => setTab('xgboost')}>
            XGBoost Detail
          </Tab>
          <Tab active={tab === 'ensemble'} onClick={() => setTab('ensemble')}>
            Ensemble Detail
          </Tab>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB 1 — MODEL COMPARISON
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'comparison' && (
          <div className="space-y-5">

            {/* Errors */}
            {errors.ens && (
              <ErrorBanner
                msg="Ensemble data unavailable"
                hint={`Run python train_models.py first. (${errors.ens})`}
              />
            )}

            {/* Top stat cards */}
            {ensemble && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  label="Best RMSE"
                  value={sorted[0]?.rmse?.toFixed(2)} unit="cyc"
                  sub={`${sorted[0]?.full || '—'}`}
                  color="text-sky-600"
                  bg="bg-sky-50 border-sky-200 dark:bg-sky-950/20 dark:border-sky-800/30"
                />
                <StatCard
                  label="Best NASA ↓"
                  value={[...models].sort((a,b)=>a.nasa_score-b.nasa_score)[0]?.nasa_score?.toFixed(1)}
                  sub={[...models].sort((a,b)=>a.nasa_score-b.nasa_score)[0]?.model}
                  color="text-purple-600"
                  bg="bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800/30"
                />
                <StatCard
                  label="Best R²"
                  value={[...models].sort((a,b)=>b.r2_score-a.r2_score)[0]?.r2_score?.toFixed(4)}
                  sub={[...models].sort((a,b)=>b.r2_score-a.r2_score)[0]?.model}
                  color="text-green-600"
                  bg="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800/30"
                />
                <StatCard
                  label="Test Engines"
                  value={ensemble.test_engines || 100}
                  sub="NASA FD001"
                  color="text-orange-600"
                  bg="bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800/30"
                />
              </div>
            )}

            {/* Comparison table */}
            {ensemble ? (
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                  <Trophy size={14} className="text-yellow-500" />
                  <h2 className="font-bold text-sm text-text">All Models — Side-by-Side</h2>
                  <span className="text-[10px] text-muted ml-auto">{ensemble.test_engines || 100} test engines · FD001</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-card2/50">
                        <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-muted font-bold">Model</th>
                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest text-muted font-bold">RMSE ↓</th>
                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest text-muted font-bold">MAE ↓</th>
                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest text-muted font-bold">R² ↑</th>
                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest text-muted font-bold">NASA ↓</th>
                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest text-muted font-bold">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((m, i) => (
                        <tr key={m.model}
                            className={`border-b border-border/40 last:border-0 transition-colors hover:bg-card2/40
                              ${m.model === bestModel ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: M_COLOR[m.model] }}/>
                              <span className="font-semibold text-text">{m.model}</span>
                              {m.model === bestModel && (
                                <span className="text-[9px] font-bold text-yellow-700 bg-yellow-100
                                                 border border-yellow-300 px-1.5 py-0.5 rounded-full">
                                  BEST
                                </span>
                              )}
                              {m.model === 'StackingEnsemble' && (
                                <span className="text-[9px] font-bold text-pink-700 bg-pink-100
                                                 border border-pink-300 px-1.5 py-0.5 rounded-full">
                                  ENSEMBLE
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-sky-600">{m.rmse.toFixed(4)}</td>
                          <td className="px-4 py-3 text-right font-mono text-text">{m.mae.toFixed(4)}</td>
                          <td className="px-4 py-3 text-right font-mono text-green-600">{m.r2_score.toFixed(4)}</td>
                          <td className="px-4 py-3 text-right font-mono text-purple-600">{m.nasa_score.toFixed(1)}</td>
                          <td className="px-4 py-3 text-right font-mono text-muted text-xs">{m.training_time_sec}s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted text-sm">
                Run <code className="bg-card2 px-2 py-1 rounded font-mono text-text">python train_models.py</code> to
                generate the model comparison.
              </div>
            )}

            {/* RMSE + NASA charts side-by-side */}
            {compBar.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <p className="text-sm font-bold text-text mb-3">RMSE — lower is better</p>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compBar} margin={{ top:4, right:16, bottom:4, left:0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false}/>
                        <XAxis dataKey="name" stroke="var(--color-muted)" fontSize={11}
                               tickLine={false} axisLine={false}/>
                        <YAxis stroke="var(--color-muted)" fontSize={11} tickLine={false} axisLine={false}
                               domain={['auto','auto']}/>
                        <Tooltip contentStyle={TIP} formatter={v=>[`${v} cycles`,'RMSE']}/>
                        <Bar dataKey="rmse" radius={[4,4,0,0]} maxBarSize={40} isAnimationActive={false}>
                          {compBar.map((d,i) => (
                            <Cell key={i} fill={d.color} opacity={d.isBest ? 1 : 0.6}/>
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <p className="text-sm font-bold text-text mb-3">NASA Score — lower is better</p>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[...compBar].sort((a,b)=>a.nasa-b.nasa)}
                                margin={{ top:4, right:16, bottom:4, left:0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false}/>
                        <XAxis dataKey="name" stroke="var(--color-muted)" fontSize={11}
                               tickLine={false} axisLine={false}/>
                        <YAxis stroke="var(--color-muted)" fontSize={11} tickLine={false} axisLine={false}/>
                        <Tooltip contentStyle={TIP} formatter={v=>[v,'NASA Score']}/>
                        <Bar dataKey="nasa" radius={[4,4,0,0]} maxBarSize={40} isAnimationActive={false}>
                          {[...compBar].sort((a,b)=>a.nasa-b.nasa).map((d,i) => (
                            <Cell key={i} fill={d.color} opacity={0.75}/>
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Stacking architecture summary */}
            {ensemble && (
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <GitMerge size={14} className="text-pink-500"/>
                  <h3 className="font-bold text-sm text-text">Stacking Ensemble Architecture</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {(ensemble.base_learners || []).map(bl => (
                    <span key={bl}
                          className="font-mono font-bold px-3 py-1.5 rounded-lg text-white"
                          style={{ backgroundColor: M_COLOR[Object.keys(M_COLOR).find(k=>k.toLowerCase().includes(bl))] || '#64748b' }}>
                      {bl.toUpperCase()}
                    </span>
                  ))}
                  <span className="text-muted font-bold mx-1">→ {ensemble.stacking_cv_folds}-fold CV →</span>
                  <span className="font-mono font-bold px-3 py-1.5 rounded-lg border border-pink-300
                                   bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300">
                    {ensemble.meta_learner || 'Ridge'}
                  </span>
                  <span className="text-muted font-bold mx-1">→ RUL prediction</span>
                </div>
                <p className="text-[11px] text-muted mt-3 leading-relaxed">
                  Each base learner is trained on out-of-fold predictions. The Ridge meta-learner
                  learns the optimal blend, correcting each model's systematic biases.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 2 — XGBOOST DETAIL
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'xgboost' && (
          <div className="space-y-5">
            {errors.xgb ? (
              <ErrorBanner msg="XGBoost metrics unavailable" hint={errors.xgb}/>
            ) : !xgb ? (
              <div className="text-center text-muted text-sm p-8">No XGBoost data.</div>
            ) : (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard label="RMSE" value={xgb.rmse?.toFixed(2)} unit="cycles"
                    sub="Root Mean Square Error" color="text-sky-600"
                    bg="bg-sky-50 border-sky-200 dark:bg-sky-950/20 dark:border-sky-800/30"/>
                  <StatCard label="MAE" value={xgb.mae?.toFixed(2)} unit="cycles"
                    sub="Mean Absolute Error" color="text-blue-600"
                    bg="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/30"/>
                  <StatCard label="R² Score" value={xgb.r2?.toFixed(4)}
                    sub="Coefficient of Determination" color="text-green-600"
                    bg="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800/30"/>
                  <StatCard label="NASA Score" value={xgb.nasa_score?.toFixed(1)}
                    sub="Lower is better" color="text-purple-600"
                    bg="bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800/30"/>
                </div>

                {/* Model info + hyperparams */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Cpu size={14} className="text-accent"/>
                      <h3 className="font-bold text-sm text-text">Model Info</h3>
                    </div>
                    {[
                      ['Model Type',       'XGBoost Regressor'],
                      ['Dataset',          'NASA C-MAPSS FD001'],
                      ['Task',             'Regression (RUL in cycles)'],
                      ['Training Samples', xgb.training_samples?.toLocaleString()],
                      ['Test Samples',     xgb.test_samples?.toLocaleString()],
                      ['Features Used',    `${xgb.features_used} sensors`],
                    ].map(([k,v]) => (
                      <div key={k} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                        <span className="text-xs text-muted">{k}</span>
                        <span className="text-xs font-bold font-mono text-text">{v}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Target size={14} className="text-purple"/>
                      <h3 className="font-bold text-sm text-text">Hyperparameters</h3>
                    </div>
                    {[
                      ['n_estimators',  xgb.n_estimators],
                      ['max_depth',     xgb.max_depth],
                      ['learning_rate', xgb.learning_rate],
                      ['objective',     'reg:squarederror'],
                      ['subsample',     '0.8'],
                      ['colsample',     '0.8'],
                    ].map(([k,v]) => (
                      <div key={k} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                        <span className="text-xs text-muted font-mono">{k}</span>
                        <span className="text-xs font-bold font-mono text-text">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feature importance */}
                {fiData.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                    <SectionHead Icon={BarChart2} title="Top Feature Importances (XGBoost gain)"
                                 sub="Sensors with highest influence on RUL prediction"/>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={fiData} layout="vertical"
                                  margin={{ top:4, right:48, bottom:4, left:20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false}/>
                          <XAxis type="number" stroke="var(--color-muted)" fontSize={11}
                                 tickLine={false} axisLine={false}/>
                          <YAxis type="category" dataKey="sensor" stroke="var(--color-muted)"
                                 fontSize={12} width={72} tickLine={false} axisLine={false}/>
                          <Tooltip contentStyle={TIP}
                                   formatter={v=>[`${(+v).toFixed(4)} (${(v*100).toFixed(1)}%)`, 'Importance']}/>
                          <Bar dataKey="imp" fill="var(--color-accent)" radius={[0,6,6,0]}
                               isAnimationActive={false} maxBarSize={20}>
                            <LabelList dataKey="imp" position="right"
                                       formatter={v=>(+v).toFixed(3)}
                                       style={{ fill:'var(--color-muted)', fontSize:10, fontFamily:'monospace' }}/>
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Actual vs Predicted */}
                {avpXgb.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                    <SectionHead Icon={Activity} title="Actual vs Predicted RUL — XGBoost"
                                 sub={`${avpXgb.length} test engines`} badge="XGBoost"/>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={avpXgb} margin={{ top:4, right:24, bottom:16, left:0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false}/>
                          <XAxis dataKey="engine" stroke="var(--color-muted)" fontSize={11}
                                 tickLine={false} axisLine={false}
                                 label={{ value:'Engine', position:'insideBottom', offset:-4,
                                          style:{ fill:'var(--color-muted)', fontSize:11 } }}/>
                          <YAxis stroke="var(--color-muted)" fontSize={11} tickLine={false} axisLine={false}/>
                          <Tooltip content={<AvPTip/>}/>
                          <ReferenceLine y={60} stroke="#d97706" strokeDasharray="4 4" strokeWidth={1}/>
                          <ReferenceLine y={30} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1}/>
                          <Legend verticalAlign="bottom" iconType="line" wrapperStyle={{ fontSize:11 }}/>
                          <Line type="monotone" dataKey="actual" name="Actual RUL"
                                stroke="#0284c7" strokeWidth={2} dot={false} isAnimationActive={false}/>
                          <Line type="monotone" dataKey="predicted" name="Predicted"
                                stroke="#ea580c" strokeWidth={2} strokeDasharray="5 4"
                                dot={false} isAnimationActive={false}/>
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Why XGBoost callout */}
                <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle size={15} className="text-sky-600 mt-0.5 shrink-0"/>
                    <p className="text-xs text-sky-900 dark:text-sky-200 leading-relaxed">
                      <strong>Why XGBoost?</strong> RUL prediction on C-MAPSS is a tabular regression
                      task on 100 engines. Gradient-boosted trees outperform LSTMs and CNNs at this
                      scale, train in seconds, predict in microseconds, and support SHAP explainability
                      natively — essential for aviation safety.
                      This run: <span className="font-mono font-bold">RMSE {xgb.rmse?.toFixed(2)} cycles</span>.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB 3 — ENSEMBLE DETAIL
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'ensemble' && (
          <div className="space-y-5">
            {errors.ens ? (
              <ErrorBanner
                msg="Ensemble data unavailable"
                hint="Run python train_models.py to train all 5 models and generate model_comparison.json."
              />
            ) : !ensemble ? (
              <div className="text-center text-muted text-sm p-8">No ensemble data.</div>
            ) : (
              <>
                {/* Stat cards */}
                {(() => {
                  const ensM = models.find(m => m.model === 'StackingEnsemble');
                  if (!ensM) return null;
                  return (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <StatCard label="Ensemble RMSE" value={ensM.rmse?.toFixed(2)} unit="cycles"
                        color="text-pink-600"
                        bg="bg-pink-50 border-pink-200 dark:bg-pink-950/20 dark:border-pink-800/30"/>
                      <StatCard label="Ensemble MAE"  value={ensM.mae?.toFixed(2)} unit="cycles"
                        color="text-pink-600"
                        bg="bg-pink-50 border-pink-200 dark:bg-pink-950/20 dark:border-pink-800/30"/>
                      <StatCard label="Ensemble R²"   value={ensM.r2_score?.toFixed(4)}
                        color="text-pink-600"
                        bg="bg-pink-50 border-pink-200 dark:bg-pink-950/20 dark:border-pink-800/30"/>
                      <StatCard label="Ensemble NASA" value={ensM.nasa_score?.toFixed(1)}
                        sub="Lower is better"
                        color="text-pink-600"
                        bg="bg-pink-50 border-pink-200 dark:bg-pink-950/20 dark:border-pink-800/30"/>
                    </div>
                  );
                })()}

                {/* Architecture */}
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <GitMerge size={14} className="text-pink-500"/>
                    <h3 className="font-bold text-sm text-text">Architecture</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        step:'1', color:'bg-sky-500',
                        title:'Base Learners',
                        text:`${(ensemble.base_learners||[]).join(', ')} — each trained on ${ensemble.stacking_cv_folds}-fold CV. OOF predictions form the meta-features.`
                      },
                      {
                        step:'2', color:'bg-purple-500',
                        title:'Out-of-Fold Stacking',
                        text:`OOF predictions are column-stacked into an N×K matrix (N engines, K base models). This prevents label leakage.`
                      },
                      {
                        step:'3', color:'bg-pink-500',
                        title:`Meta-Learner (${ensemble.meta_learner||'Ridge'})`,
                        text:`Ridge regression learns optimal blend weights. Corrects for each base model's systematic bias.`
                      },
                    ].map(({ step, color, title, text }) => (
                      <div key={step} className="bg-card2/40 border border-border/40 rounded-xl p-3 flex gap-3">
                        <div className={`w-6 h-6 rounded-full ${color} text-white text-xs font-black
                                         flex items-center justify-center shrink-0 mt-0.5`}>
                          {step}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-text mb-1">{title}</p>
                          <p className="text-xs text-muted leading-relaxed">{text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actual vs Predicted */}
                {avpEns.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                    <SectionHead Icon={Activity} title="Actual vs Predicted RUL — Stacking Ensemble"
                                 sub={`${avpEns.length} test engines`} badge="Ensemble"/>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={avpEns} margin={{ top:4, right:24, bottom:16, left:0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false}/>
                          <XAxis dataKey="engine" stroke="var(--color-muted)" fontSize={11}
                                 tickLine={false} axisLine={false}
                                 label={{ value:'Engine', position:'insideBottom', offset:-4,
                                          style:{ fill:'var(--color-muted)', fontSize:11 } }}/>
                          <YAxis stroke="var(--color-muted)" fontSize={11} tickLine={false} axisLine={false}/>
                          <Tooltip content={<AvPTip/>}/>
                          <ReferenceLine y={60} stroke="#d97706" strokeDasharray="4 4" strokeWidth={1}/>
                          <ReferenceLine y={30} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1}/>
                          <Legend verticalAlign="bottom" iconType="line" wrapperStyle={{ fontSize:11 }}/>
                          <Line type="monotone" dataKey="actual" name="Actual RUL"
                                stroke="#0284c7" strokeWidth={2} dot={false} isAnimationActive={false}/>
                          <Line type="monotone" dataKey="predicted" name="Ensemble Predicted"
                                stroke="#ec4899" strokeWidth={2} strokeDasharray="5 4"
                                dot={false} isAnimationActive={false}/>
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Insight */}
                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200
                                dark:border-yellow-800/40 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle size={14} className="text-yellow-600 mt-0.5 shrink-0"/>
                  <p className="text-xs text-yellow-900 dark:text-yellow-200 leading-relaxed">
                    <strong>Key insight:</strong> On FD001, XGBoost and LightGBM are nearly identical
                    in RMSE. LightGBM achieves the best NASA score — fewer catastrophic late-predictions.
                    The stacking ensemble shows the theoretical ceiling for these base learners and is
                    most valuable across multiple operating conditions (FD002–FD004).
                  </p>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
