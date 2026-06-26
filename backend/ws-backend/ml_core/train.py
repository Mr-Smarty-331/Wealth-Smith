import os
import joblib
import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout

# Define constants
TICKER = "AAPL"
START_DATE = "2020-01-01"
END_DATE = "2024-01-01"
SEQUENCE_LENGTH = 60
MODEL_PATH = os.path.join(os.path.dirname(__file__), "stock_predictor.h5")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "scaler.pkl")


def load_historical_data(ticker: str, start: str, end: str) -> pd.DataFrame:
    """
    Downloads historical close price data from yfinance.
    """
    print(f"Downloading historical data for {ticker} from {start} to {end}...")
    df = yf.download(ticker, start=start, end=end)
    if df.empty:
        raise ValueError(f"Failed to fetch data for ticker {ticker}. Ensure you are online.")
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


def main():
    # 1. Download data
    df = load_historical_data(TICKER, START_DATE, END_DATE)
    close_prices = df.values  # shape: (n_samples, 1)

    # 2. Normalize price data between 0 and 1
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled_data = scaler.fit_transform(close_prices)

    # 3. Create sequences
    X, y = prepare_sequences(scaled_data, SEQUENCE_LENGTH)
    
    # Reshape X to fit LSTM expectations: (samples, time_steps, features)
    X = np.reshape(X, (X.shape[0], X.shape[1], 1))
    
    print(f"Dataset prepared. X shape: {X.shape}, y shape: {y.shape}")

    # 4. Build lightweight LSTM Model
    model = Sequential([
        LSTM(units=50, return_sequences=True, input_shape=(SEQUENCE_LENGTH, 1)),
        Dropout(0.2),
        LSTM(units=50, return_sequences=False),
        Dropout(0.2),
        Dense(units=25),
        Dense(units=1)
    ])

    # 5. Compile Model
    model.compile(optimizer="adam", loss="mean_squared_error")

    # 6. Train Model
    # We use a small number of epochs (3) so it trains quickly during pipeline boot
    print("Training the LSTM model...")
    model.fit(X, y, batch_size=32, epochs=3, verbose=1)

    # 7. Save Model and Scaler
    print(f"Saving trained model to {MODEL_PATH}...")
    model.save(MODEL_PATH)
    
    print(f"Saving fitted scaler to {SCALER_PATH}...")
    joblib.dump(scaler, SCALER_PATH)

    print("Model training pipeline complete!")


if __name__ == "__main__":
    main()
