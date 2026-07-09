import os
import sys
import json
import joblib
from datetime import datetime
import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout

# Constants
START_DATE = "2020-01-01"
END_DATE = datetime.now().strftime("%Y-%m-%d")
SEQUENCE_LENGTH = 60

# Model storage directory
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

def load_historical_data(ticker: str, start: str, end: str) -> pd.DataFrame:
    """Download historical close prices."""
    print(f"Downloading historical data for {ticker} from {start} to {end}...")
    df = yf.download(ticker, start=start, end=end)
    if df.empty:
        raise ValueError(f"Failed to fetch data for ticker {ticker}. Ensure the symbol is correct and you are online.")
    return df[["Close"]]

def prepare_classification_sequences(scaled_prices: np.ndarray, raw_prices: np.ndarray, seq_length: int):
    """Generate sequences and binary targets (1 if close increases, 0 otherwise)."""
    X, y = [], []
    for i in range(len(scaled_prices) - seq_length):
        X.append(scaled_prices[i : i + seq_length])
        
        # Binary target from raw prices
        close_t = raw_prices[i + seq_length - 1]
        close_next = raw_prices[i + seq_length]
        
        # 1=UP, 0=DOWN
        target = 1 if close_next > close_t else 0
        y.append(target)
        
    return np.array(X), np.array(y).reshape(-1, 1)

def evaluate_classifier(model, X_test, y_test) -> dict:
    """Evaluate model accuracy on test data."""
    probabilities = model.predict(X_test, verbose=0)
    predictions = (probabilities >= 0.50).astype(int)
    
    accuracy = np.mean(predictions == y_test) * 100
    
    return {
        "accuracy_pct": round(float(accuracy), 2),
        "test_samples": int(len(y_test))
    }

def train_model_for_ticker(ticker: str) -> bool:
    """Train LSTM binary classifier for a ticker."""
    ticker = ticker.upper().strip()
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    # File paths
    model_path = os.path.join(MODELS_DIR, f"{ticker}_classifier.h5")
    scaler_path = os.path.join(MODELS_DIR, f"{ticker}_scaler.pkl")
    metrics_path = os.path.join(MODELS_DIR, f"{ticker}_metrics.json")
    
    default_model_path = os.path.join(MODELS_DIR, "stock_classifier.h5")
    default_scaler_path = os.path.join(MODELS_DIR, "scaler.pkl")
    
    try:
        # 1. Download data
        df = load_historical_data(ticker, START_DATE, END_DATE)
        raw_prices = df.values.flatten()  # 1D close prices

        # 2. Train/test split
        split_idx = int(len(raw_prices) * 0.8)
        train_raw = raw_prices[:split_idx]
        test_raw = raw_prices[split_idx:]
        
        if len(train_raw) <= SEQUENCE_LENGTH or len(test_raw) <= SEQUENCE_LENGTH:
            raise ValueError(f"Insufficient data to train and validate {ticker}. Total samples: {len(raw_prices)}")

        # 3. Normalize data
        scaler = MinMaxScaler(feature_range=(0, 1))
        train_scaled = scaler.fit_transform(train_raw.reshape(-1, 1)).flatten()
        test_scaled = scaler.transform(test_raw.reshape(-1, 1)).flatten()

        # 4. Create sequences
        X_train, y_train = prepare_classification_sequences(train_scaled, train_raw, SEQUENCE_LENGTH)
        X_test, y_test = prepare_classification_sequences(test_scaled, test_raw, SEQUENCE_LENGTH)
        
        # Reshape for LSTM
        X_train = np.reshape(X_train, (X_train.shape[0], X_train.shape[1], 1))
        X_test = np.reshape(X_test, (X_test.shape[0], X_test.shape[1], 1))
        
        print(f"Classification dataset prepared for {ticker}.")
        print(f"  Train: X shape: {X_train.shape}, y shape: {y_train.shape} (UP ratio: {np.mean(y_train):.2%})")
        print(f"  Test:  X shape: {X_test.shape}, y shape: {y_test.shape} (UP ratio: {np.mean(y_test):.2%})")

        # 5. Build LSTM model
        model = Sequential([
            LSTM(units=50, input_shape=(SEQUENCE_LENGTH, 1)),
            Dropout(0.2),
            Dense(units=1, activation='sigmoid')
        ])

        # 6. Compile model
        model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])

        # 7. Train model
        print(f"Training binary classification LSTM model for {ticker}...")
        model.fit(X_train, y_train, batch_size=32, epochs=5, verbose=1)

        # 8. Evaluate model
        print(f"Evaluating validation metrics on test split...")
        metrics = evaluate_classifier(model, X_test, y_test)
        print(f"Validation Accuracy for {ticker}: {metrics['accuracy_pct']:.2f}%")

        # 9. Export artifacts
        print(f"Saving classification model to {model_path} and {default_model_path}...")
        model.save(model_path)
        model.save(default_model_path)
        
        print(f"Saving fitted scaler to {scaler_path} and {default_scaler_path}...")
        joblib.dump(scaler, scaler_path)
        joblib.dump(scaler, default_scaler_path)
        
        print(f"Saving validation metrics to {metrics_path}...")
        with open(metrics_path, "w") as f:
            json.dump(metrics, f, indent=4)

        # Sync to AWS S3
        try:
            import asyncio
            from model_storage_service import save_model_to_aws
            asyncio.run(save_model_to_aws(ticker, model_path, scaler_path))
        except Exception as aws_err:
            print(f"AWS S3 Sync Note: {aws_err}")

        print(f"Binary classification model training complete for {ticker}!")
        return True
    except Exception as e:
        print(f"Error training model for ticker {ticker}: {e}")
        return False

def main():
    ticker = "AAPL"
    if len(sys.argv) > 1:
        ticker = sys.argv[1]
    
    success = train_model_for_ticker(ticker)
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
