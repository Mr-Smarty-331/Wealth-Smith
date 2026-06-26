import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout

# Define constants
START_DATE = "2020-01-01"
END_DATE = "2024-01-01"
SEQUENCE_LENGTH = 60

# Directory where models are stored
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

def load_historical_data(ticker: str, start: str, end: str) -> pd.DataFrame:
    """
    Downloads historical close price data from yfinance.
    """
    print(f"Downloading historical data for {ticker} from {start} to {end}...")
    df = yf.download(ticker, start=start, end=end)
    if df.empty:
        raise ValueError(f"Failed to fetch data for ticker {ticker}. Ensure the symbol is correct and you are online.")
    return df[["Close"]]

def prepare_sequences(data: np.ndarray, seq_length: int):
    """
    Creates sliding-window sequences of seq_length prices to predict the next price.
    """
    X, y = [], []
    for i in range(len(data) - seq_length):
        X.append(data[i : i + seq_length])
        y.append(data[i + seq_length])
    return np.array(X), np.array(y)

def evaluate_model(model, X_test, y_test, scaler) -> dict:
    """
    Evaluates the model on unseen test data and calculates MAE and MAPE.
    """
    # Predict scaled values
    scaled_predictions = model.predict(X_test, verbose=0)
    
    # Reverse scaling to get real dollar values
    predictions = scaler.inverse_transform(scaled_predictions)
    actuals = scaler.inverse_transform(y_test)
    
    # Calculate Mean Absolute Error (MAE)
    mae = np.mean(np.abs(predictions - actuals))
    
    # Calculate Mean Absolute Percentage Error (MAPE)
    epsilon = 1e-5
    mape = np.mean(np.abs((actuals - predictions) / (actuals + epsilon))) * 100
    
    return {
        "mae_usd": round(float(mae), 4),
        "mape_pct": round(float(mape), 4),
        "test_samples": int(len(actuals))
    }

def train_model_for_ticker(ticker: str) -> bool:
    """
    Trains an LSTM model specifically for the given stock ticker
    using a chronological split to prevent leakage, and exports it.
    """
    ticker = ticker.upper().strip()
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    model_path = os.path.join(MODELS_DIR, f"{ticker}.h5")
    scaler_path = os.path.join(MODELS_DIR, f"{ticker}.pkl")
    metrics_path = os.path.join(MODELS_DIR, f"{ticker}_metrics.json")
    
    try:
        # 1. Download data
        df = load_historical_data(ticker, START_DATE, END_DATE)
        close_prices = df.values  # shape: (n_samples, 1)

        # 2. Chronological split (80% training, 20% validation/testing)
        split_idx = int(len(close_prices) * 0.8)
        train_prices = close_prices[:split_idx]
        test_prices = close_prices[split_idx:]
        
        if len(train_prices) <= SEQUENCE_LENGTH or len(test_prices) <= SEQUENCE_LENGTH:
            raise ValueError(f"Insufficient data to train and validate. Total samples: {len(close_prices)}")

        # 3. Normalize price data
        scaler = MinMaxScaler(feature_range=(0, 1))
        scaled_train = scaler.fit_transform(train_prices)
        scaled_test = scaler.transform(test_prices)

        # 4. Create sequences
        X_train, y_train = prepare_sequences(scaled_train, SEQUENCE_LENGTH)
        X_test, y_test = prepare_sequences(scaled_test, SEQUENCE_LENGTH)
        
        # Reshape X to fit LSTM expectations: (samples, time_steps, features)
        X_train = np.reshape(X_train, (X_train.shape[0], X_train.shape[1], 1))
        X_test = np.reshape(X_test, (X_test.shape[0], X_test.shape[1], 1))
        
        print(f"Dataset prepared for {ticker}.")
        print(f"  Train: X shape: {X_train.shape}, y shape: {y_train.shape}")
        print(f"  Test:  X shape: {X_test.shape}, y shape: {y_test.shape}")

        # 5. Build lightweight LSTM Model
        model = Sequential([
            LSTM(units=50, return_sequences=True, input_shape=(SEQUENCE_LENGTH, 1)),
            Dropout(0.2),
            LSTM(units=50, return_sequences=False),
            Dropout(0.2),
            Dense(units=25),
            Dense(units=1)
        ])

        # 6. Compile Model
        model.compile(optimizer="adam", loss="mean_squared_error")

        # 7. Train Model (3 epochs for dynamic server execution performance)
        print(f"Training the LSTM model for {ticker}...")
        model.fit(X_train, y_train, batch_size=32, epochs=3, verbose=1)

        # 8. Evaluate metrics on the unseen test split
        print(f"Evaluating validation metrics on test split...")
        metrics = evaluate_model(model, X_test, y_test, scaler)
        print(f"Validation metrics for {ticker}:")
        print(f"  MAE:  ${metrics['mae_usd']:.2f}")
        print(f"  MAPE: {metrics['mape_pct']:.2f}%")

        # 9. Save Model, Scaler, and Metrics
        print(f"Saving trained model to {model_path}...")
        model.save(model_path)
        
        print(f"Saving fitted scaler to {scaler_path}...")
        joblib.dump(scaler, scaler_path)
        
        print(f"Saving validation metrics to {metrics_path}...")
        with open(metrics_path, "w") as f:
            json.dump(metrics, f, indent=4)

        print(f"Model training pipeline for {ticker} complete!")
        return True
    except Exception as e:
        print(f"Error training model for ticker {ticker}: {e}")
        return False

def main():
    # Allow command line execution: python train.py TICKER
    ticker = "AAPL"
    if len(sys.argv) > 1:
        ticker = sys.argv[1]
    
    success = train_model_for_ticker(ticker)
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
