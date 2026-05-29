FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc g++ libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py database.py model_comparison.json ./
COPY static/ ./static/
COPY test_csvs/ ./test_csvs/
COPY best_rul_model.ubj scaler.pkl train_FD001.txt ./
COPY frontend/dist/ ./frontend/dist/

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
