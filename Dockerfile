# ── Stage 1: build React frontend ─────────────────────────────────────────────
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python backend ────────────────────────────────────────────────────
FROM python:3.10-slim

WORKDIR /app

# System deps for scientific Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc g++ libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY app.py database.py model_comparison.json ./
COPY static/ ./static/
COPY test_csvs/ ./test_csvs/

# Copy ML artifacts needed at runtime
COPY best_rul_model.ubj scaler.pkl train_FD001.txt ./

# Copy built React frontend from Stage 1
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
