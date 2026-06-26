import asyncio
from contextlib import asynccontextmanager
import logging
import json
import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from ml_core.predict import PredictorService

# Set up logging to track connection and data lifecycle events
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ws-backend")

# Global services & managers
predictor_service = None
active_finnhub_ws = None
finnhub_task = None

# Finnhub Credentials & Stream config
FINNHUB_API_KEY = "d8s361hr01qlj6ffrq20d8s361hr01qlj6ffrq2g"
FINNHUB_WS_URL = f"wss://ws.finnhub.io?token={FINNHUB_API_KEY}"

# Subscription tracking
active_subscribed_tickers = set()  # Set of all tickers requested by any client
training_tickers = set()          # Set of tickers currently training in the background
price_buffers = {}                # Rolling last 60 close prices cache: {ticker: list[float]}


class ConnectionManager:
    """
    Manages active client browser WebSockets and their stock subscriptions.
    """
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.client_subscriptions: dict[WebSocket, set[str]] = {}
        
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.client_subscriptions[websocket] = set()
        logger.info(f"Client connected. Active client count: {len(self.active_connections)}")
        
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.client_subscriptions:
            del self.client_subscriptions[websocket]
        logger.info(f"Client disconnected. Active client count: {len(self.active_connections)}")
            
    async def subscribe(self, websocket: WebSocket, ticker: str):
        ticker = ticker.upper().strip()
        self.client_subscriptions[websocket].add(ticker)
        logger.info(f"Client subscribed to {ticker}")
        
        # Check if we need to subscribe to this on the external Finnhub WebSocket
        if ticker not in active_subscribed_tickers:
            active_subscribed_tickers.add(ticker)
            if active_finnhub_ws is not None:
                await active_finnhub_ws.send(json.dumps({"type": "subscribe", "symbol": ticker}))
                logger.info(f"Sent subscribe to Finnhub for {ticker}")
                
    async def unsubscribe(self, websocket: WebSocket, ticker: str):
        ticker = ticker.upper().strip()
        if ticker in self.client_subscriptions[websocket]:
            self.client_subscriptions[websocket].remove(ticker)
            logger.info(f"Client unsubscribed from {ticker}")
            
        # If no other active connection is subscribed to this ticker, unsubscribe on Finnhub
        still_subscribed = any(ticker in subs for subs in self.client_subscriptions.values())
        if not still_subscribed and ticker in active_subscribed_tickers:
            active_subscribed_tickers.discard(ticker)
            if active_finnhub_ws is not None:
                await active_finnhub_ws.send(json.dumps({"type": "unsubscribe", "symbol": ticker}))
                logger.info(f"Sent unsubscribe to Finnhub for {ticker}")


manager = ConnectionManager()


async def seed_price_buffer(ticker: str):
    """
    Downloads the last 60 days of historical data from yfinance
    to seed the rolling prediction sequence.
    """
    ticker = ticker.upper().strip()
    if ticker in price_buffers:
        return True
        
    try:
        from ml_core.train import load_historical_data
        # Run historical download in worker thread to prevent ASGI blocking
        df = await asyncio.to_thread(load_historical_data, ticker, "2023-09-01", "2024-01-01")
        prices = df["Close"].values[-60:]
        price_list = [float(p[0] if isinstance(p, np.ndarray) else p) for p in prices]
        
        if len(price_list) < 60:
            logger.warning(f"Downloaded history for {ticker} is too short: {len(price_list)} days.")
            return False
            
        price_buffers[ticker] = price_list
        logger.info(f"Seeded 60-day price buffer for {ticker} successfully.")
        return True
    except Exception as e:
        logger.error(f"Failed to seed price buffer for {ticker}: {e}")
        return False


async def run_background_training(ticker: str):
    """
    Worker task running in the background to fetch yfinance data
    and train an LSTM model for a specific ticker.
    """
    ticker = ticker.upper().strip()
    logger.info(f"Background training task running for {ticker}")
    
    try:
        from ml_core.train import train_model_for_ticker
        # Run CPU-heavy LSTM model training in a worker thread to keep ASGI loop free
        success = await asyncio.to_thread(train_model_for_ticker, ticker)
        if success:
            logger.info(f"Background training for {ticker} finished successfully.")
            # Load newly trained model files into memory cache
            predictor_service.load_ticker_model(ticker)
        else:
            logger.error(f"Background training for {ticker} failed.")
    except Exception as e:
        logger.error(f"Error during background training execution for {ticker}: {e}")
    finally:
        training_tickers.discard(ticker)


async def handle_finnhub_trade(data: dict):
    """
    Extracts incoming trade data from Finnhub WebSocket and runs predictions.
    """
    trades = data.get("data", [])
    if not trades:
        return
        
    # Group trades by symbol and extract the latest price update
    latest_prices = {}
    for trade in trades:
        symbol = trade.get("s")
        price = trade.get("p")
        if symbol and price:
            latest_prices[symbol] = float(price)
            
    for symbol, live_price in latest_prices.items():
        symbol = symbol.upper().strip()
        if symbol in active_subscribed_tickers:
            # Seed buffer if not already present
            if symbol not in price_buffers:
                await seed_price_buffer(symbol)
                
            if symbol in price_buffers:
                buffer = price_buffers[symbol]
                # Construct input sequence: 59 historical days + today's live price
                input_sequence = list(buffer[:-1]) + [live_price]
                
                try:
                    # Run ML prediction on the constructed sequence
                    prediction, metrics = predictor_service.predict_next_price(symbol, input_sequence)
                    
                    # Create payload
                    payload = {
                        "type": "live_update",
                        "ticker": symbol,
                        "price": live_price,
                        "predicted_price": prediction,
                        "accuracy_metrics": metrics
                    }
                    
                    # Broadcast updates to all clients subscribed to this symbol
                    for conn, subs in manager.client_subscriptions.items():
                        if symbol in subs:
                            try:
                                await conn.send_json(payload)
                            except Exception as e:
                                logger.error(f"Error sending live update to client: {e}")
                                
                except Exception as e:
                    logger.error(f"Failed to calculate real-time prediction for {symbol}: {e}")


async def finnhub_listener():
    """
    Background loop connecting to Finnhub WebSocket.
    """
    global active_finnhub_ws
    while True:
        try:
            logger.info(f"Connecting to Finnhub WebSocket...")
            async with websockets.connect(FINNHUB_WS_URL) as ws:
                logger.info("Connected to Finnhub WebSocket successfully.")
                active_finnhub_ws = ws
                
                # Resubscribe to any currently active tickers
                for ticker in active_subscribed_tickers:
                    await ws.send(json.dumps({"type": "subscribe", "symbol": ticker}))
                    logger.info(f"Resubscribed to {ticker} on Finnhub reconnect")
                    
                # Loop to receive messages
                while True:
                    msg = await ws.recv()
                    data = json.loads(msg)
                    if data.get("type") == "trade":
                        await handle_finnhub_trade(data)
                        
        except asyncio.CancelledError:
            logger.info("Finnhub listener task cancelled.")
            break
        except Exception as e:
            logger.error(f"Finnhub connection error, reconnecting in 5s: {e}")
            active_finnhub_ws = None
            await asyncio.sleep(5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan manager to handle startup and shutdown logic.
    Loads existing stock-specific models from disk and starts Finnhub task on start.
    """
    global predictor_service, finnhub_task
    logger.info("Initializing PredictorService...")
    try:
        predictor_service = PredictorService()
        
        # Load any existing models in models/ folder
        DEFAULT_TICKERS = ["AAPL", "MSFT", "TSLA", "NVDA", "META"]
        for ticker in DEFAULT_TICKERS:
            if predictor_service.has_model_files(ticker):
                predictor_service.load_ticker_model(ticker)
                logger.info(f"Pre-loaded existing model for {ticker} from disk.")
                
        # Start background Finnhub listener
        finnhub_task = asyncio.create_task(finnhub_listener())
    except Exception as e:
        logger.error(f"Failed to initialize server lifespan components: {e}")
        
    yield
    
    # Clean up
    if finnhub_task:
        finnhub_task.cancel()
        await asyncio.gather(finnhub_task, return_exceptions=True)
    logger.info("Server shutdown complete.")


app = FastAPI(
    title="Wealth Smith ML Backend",
    description="Python backend microservice handling Machine Learning inference and WebSockets.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration - required to support cross-origin queries from React client (localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    """
    Root REST endpoint to verify FastAPI service status.
    """
    return {
        "message": "Wealth Smith ML Backend is Online",
        "loaded_models": list(predictor_service.models.keys()) if predictor_service else [],
        "active_training_runs": list(training_tickers),
        "finnhub_connected": active_finnhub_ws is not None,
        "active_subscriptions": list(active_subscribed_tickers)
    }


@app.websocket("/ws/predict")
async def websocket_predict(websocket: WebSocket):
    """
    WebSocket endpoint that accepts incoming stock subscription requests,
    starts background training if the model is missing, seeds the price buffer,
    and streams predictions on incoming live data.
    """
    await manager.connect(websocket)
    
    try:
        while True:
            # Receive subscription actions from the client
            # Expects: {"action": "subscribe", "ticker": "TSLA"}
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            action = payload.get("action")
            ticker = payload.get("ticker", "").upper().strip()
            
            if not ticker:
                await websocket.send_json({
                    "type": "status",
                    "status": "error",
                    "ticker": "UNKNOWN",
                    "message": "Ticker symbol is missing."
                })
                continue
                
            if action == "subscribe":
                # 1. Ensure the model exists on disk
                if not predictor_service.has_model_files(ticker):
                    if ticker not in training_tickers:
                        training_tickers.add(ticker)
                        asyncio.create_task(run_background_training(ticker))
                        
                    await websocket.send_json({
                        "type": "status",
                        "status": "training",
                        "ticker": ticker,
                        "message": f"Model for {ticker} is training. Stream will start once ready..."
                    })
                    
                    # Wait for training to complete
                    while ticker in training_tickers:
                        await asyncio.sleep(1.0)
                        
                    # Recheck model files
                    if not predictor_service.has_model_files(ticker):
                        await websocket.send_json({
                            "type": "status",
                            "status": "error",
                            "ticker": ticker,
                            "message": f"Training failed for {ticker}."
                        })
                        continue
                
                # 2. Seed price buffer
                seeded = await seed_price_buffer(ticker)
                if not seeded:
                    await websocket.send_json({
                        "type": "status",
                        "status": "error",
                        "ticker": ticker,
                        "message": f"Failed to seed 60-day historical data for {ticker}."
                    })
                    continue
                
                # 3. Add to WebSocket subscriptions
                await manager.subscribe(websocket, ticker)
                await websocket.send_json({
                    "type": "status",
                    "status": "success",
                    "ticker": ticker,
                    "message": f"Subscribed to real-time ML updates for {ticker}"
                })
                
            elif action == "unsubscribe":
                await manager.unsubscribe(websocket, ticker)
                await websocket.send_json({
                    "type": "status",
                    "status": "success",
                    "ticker": ticker,
                    "message": f"Unsubscribed from {ticker}"
                })
            else:
                await websocket.send_json({
                    "type": "status",
                    "status": "error",
                    "ticker": ticker,
                    "message": f"Unknown action: {action}"
                })
                
    except WebSocketDisconnect:
        logger.info("Client browser closed WebSocket connection.")
    except Exception as e:
        logger.error(f"Unexpected error in client WebSocket session: {e}")
    finally:
        manager.disconnect(websocket)
