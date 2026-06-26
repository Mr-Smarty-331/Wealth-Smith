import os
import json
import joblib
import numpy as np
from tensorflow.keras.models import load_model

class PredictorService:
    def __init__(self):
        self.models_dir = os.path.join(os.path.dirname(__file__), "models")
        self.models = {}  # Cache for loaded models: {ticker: KerasModel}
        self.scalers = {}  # Cache for loaded scalers: {ticker: MinMaxScaler}
        self.metrics = {}  # Cache for validation metrics: {ticker: dict}
        os.makedirs(self.models_dir, exist_ok=True)

    def has_model_files(self, ticker: str) -> bool:
        """
        Checks if model files for the given ticker exist on disk.
        """
        ticker = ticker.upper().strip()
        model_path = os.path.join(self.models_dir, f"{ticker}.h5")
        scaler_path = os.path.join(self.models_dir, f"{ticker}.pkl")
        return os.path.exists(model_path) and os.path.exists(scaler_path)

    def load_ticker_model(self, ticker: str) -> bool:
        """
        Loads the trained LSTM model, scaler, and validation metrics for the given ticker from disk.
        Returns True if successful, False if files are missing or load fails.
        """
        ticker = ticker.upper().strip()
        
        # If already fully loaded, return True
        if ticker in self.models and ticker in self.scalers:
            return True
            
        model_path = os.path.join(self.models_dir, f"{ticker}.h5")
        scaler_path = os.path.join(self.models_dir, f"{ticker}.pkl")
        metrics_path = os.path.join(self.models_dir, f"{ticker}_metrics.json")
        
        if not os.path.exists(model_path) or not os.path.exists(scaler_path):
            return False
            
        try:
            print(f"Loading TensorFlow LSTM model for {ticker}...")
            self.models[ticker] = load_model(model_path)
            
            print(f"Loading Scaler for {ticker}...")
            self.scalers[ticker] = joblib.load(scaler_path)
            
            # Load metrics if available, otherwise fallback
            if os.path.exists(metrics_path):
                print(f"Loading metrics for {ticker}...")
                with open(metrics_path, "r") as f:
                    self.metrics[ticker] = json.load(f)
            else:
                self.metrics[ticker] = {
                    "mae_usd": 0.0,
                    "mape_pct": 0.0,
                    "test_samples": 0,
                    "warning": "No validation metrics file found."
                }
                
            print(f"Model, scaler, and metrics for {ticker} loaded successfully!")
            return True
        except Exception as e:
            print(f"Failed to load model files for {ticker}: {e}")
            return False

    def predict_next_price(self, ticker: str, recent_prices: list) -> tuple:
        """
        Takes a list of recent closing prices (expects 60 values) for a ticker,
        scales them, runs LSTM inference, and returns (prediction_float, metrics_dict).
        """
        ticker = ticker.upper().strip()
        
        # Ensure the model is loaded
        if not self.load_ticker_model(ticker):
            raise FileNotFoundError(f"Model or scaler for {ticker} is not loaded/available on disk.")
            
        if len(recent_prices) != 60:
            raise ValueError(f"Expected exactly 60 recent prices, but got {len(recent_prices)}")
        
        # Convert to numpy array and reshape to (60, 1) for scaling
        prices_arr = np.array(recent_prices, dtype=np.float32).reshape(-1, 1)
        
        # Scale the data using the ticker-specific scaler
        scaler = self.scalers[ticker]
        scaled_prices = scaler.transform(prices_arr)
        
        # Reshape to fit LSTM input format: (samples=1, time_steps=60, features=1)
        input_data = np.reshape(scaled_prices, (1, 60, 1))
        
        # Predict the next scaled price
        model = self.models[ticker]
        scaled_prediction = model.predict(input_data, verbose=0)
        
        # Inverse transform the predicted value to normal USD/price range
        prediction = scaler.inverse_transform(scaled_prediction)
        
        # Extract the float value from shape (1, 1)
        prediction_val = float(prediction[0][0])
        
        # Retrieve validation metrics
        ticker_metrics = self.metrics.get(ticker, {})
        
        return prediction_val, ticker_metrics
