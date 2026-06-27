import asyncio
from contextlib import asynccontextmanager
import logging
import json
import time
import numpy as np
import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from ml_core.predict import PredictorService
from ml_core.nlp_engine.sentiment_predictor import SentimentAnalyzer
from ml_core.nlp_engine.news_fetcher import fetch_company_news

# Set up logging to track connection and data lifecycle events
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ws-backend")

# Global services & managers
predictor_service = None
sentiment_analyzer = None
active_finnhub_ws = None
finnhub_task = None

# Finnhub Credentials & Stream config
FINNHUB_API_KEY = "d8s361hr01qlj6ffrq20d8s361hr01qlj6ffrq2g"
FINNHUB_WS_URL = f"wss://ws.finnhub.io?token={FINNHUB_API_KEY}"

# Subscription tracking & caching
active_subscribed_tickers = set()  # Set of all tickers requested by any client
training_tickers = set()          # Set of tickers currently training in the background
price_buffers = {}                # Rolling last 60 close prices cache: {ticker: list[float]}
news_sentiment_cache = {}         # Cache for news sentiment: {ticker: {"data": dict, "timestamp": float}}


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
        from datetime import datetime, timedelta
        from ml_core.train import load_historical_data
        
        end_str = datetime.now().strftime("%Y-%m-%d")
        start_str = (datetime.now() - timedelta(days=150)).strftime("%Y-%m-%d")
        
        # Run historical download in worker thread to prevent ASGI blocking
        df = await asyncio.to_thread(load_historical_data, ticker, start_str, end_str)
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
    and train an LSTM classification model for a specific ticker.
    """
    ticker = ticker.upper().strip()
    logger.info(f"Background training task running for {ticker}")
    
    try:
        from ml_core.train import train_model_for_ticker
        # Run CPU-heavy LSTM model training in a worker thread to keep ASGI loop free
        success = await asyncio.to_thread(train_model_for_ticker, ticker)
        if success:
            logger.info(f"Background training for {ticker} finished successfully.")
            predictor_service.load_ticker_model(ticker)
        else:
            logger.error(f"Background training for {ticker} failed.")
    except Exception as e:
        logger.error(f"Error during background training execution for {ticker}: {e}")
    finally:
        training_tickers.discard(ticker)


async def get_cached_news_sentiment(ticker: str) -> dict:
    """
    Fetches news headlines for ticker and runs NLP SentimentAnalyzer.
    Caches results for 5 minutes (300s) to maintain high WebSocket frequency and prevent Finnhub rate limits.
    """
    ticker = ticker.upper().strip()
    current_time = time.time()
    
    # Check cache validity (300 seconds = 5 mins)
    if ticker in news_sentiment_cache:
        cached_entry = news_sentiment_cache[ticker]
        if current_time - cached_entry["timestamp"] < 300:
            return cached_entry["data"]
            
    try:
        # Fetch news articles asynchronously in worker thread
        headlines = await asyncio.to_thread(fetch_company_news, ticker, 30, FINNHUB_API_KEY)
        
        # Run sentiment analysis on fetched headlines
        sentiment_res = sentiment_analyzer.analyze_headlines(headlines)
        
        # Store in cache
        news_sentiment_cache[ticker] = {
            "data": sentiment_res,
            "timestamp": current_time
        }
        return sentiment_res
    except Exception as e:
        logger.error(f"Error fetching/analyzing news sentiment for {ticker}: {e}")
        fallback = {
            "overall_sentiment": "Neutral",
            "bullish_ratio": 0.33,
            "bearish_ratio": 0.33,
            "neutral_ratio": 0.34,
            "sentiment_score": 0.0,
            "total_articles": 0
        }
        return fallback


def calculate_ultimate_confidence(price_pred: dict, sentiment_pred: dict) -> dict:
    """
    Algorithmic Weighting Merge Engine:
    Combines Time-Series probability (60% weight) and NLP Sentiment score (40% weight)
    into a unified Ultimate Confidence Score (0.0 to 1.0) and final recommendation decision.
    """
    # 1. Extract Time-Series Directional Probability (0.0 to 1.0)
    raw_ts_prob = price_pred.get("raw_probability")
    if raw_ts_prob is None:
        raw_ts_prob = price_pred.get("confidence_up", 50.0) / 100.0
    ts_prob = float(np.clip(raw_ts_prob, 0.0, 1.0))
    
    # 2. Convert NLP Sentiment Score (-1.0 to +1.0) into normalized NLP probability (0.0 to 1.0)
    sentiment_score = sentiment_pred.get("sentiment_score", 0.0)
    nlp_prob = float(np.clip(0.5 + (0.5 * sentiment_score), 0.0, 1.0))
    
    # 3. Algorithmic Weighting (60% Time-Series + 40% NLP Sentiment)
    ultimate_score_raw = (0.60 * ts_prob) + (0.40 * nlp_prob)
    ultimate_score = round(float(ultimate_score_raw), 4)
    
    # 4. Final Decision & Signal Determination
    final_decision = "UP" if ultimate_score >= 0.50 else "DOWN"
    signal = "BUY" if final_decision == "UP" else "SELL"
    confidence_pct = round((ultimate_score if final_decision == "UP" else (1.0 - ultimate_score)) * 100, 2)
    
    return {
        "ultimate_score": ultimate_score,
        "final_decision": final_decision,
        "signal": signal,
        "confidence": confidence_pct,
        "ts_prediction": price_pred.get("prediction", "UP"),
        "ts_confidence": round(ts_prob, 4),
        "nlp_sentiment": sentiment_pred.get("overall_sentiment", "Neutral"),
        "nlp_confidence": round(nlp_prob, 4)
    }


async def handle_finnhub_trade(data: dict):
    """
    Extracts incoming trade data from Finnhub WebSocket and runs Dual-Inference pipeline.
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
            if symbol not in price_buffers:
                await seed_price_buffer(symbol)
                
            if symbol in price_buffers:
                buffer = price_buffers[symbol]
                input_sequence = list(buffer[:-1]) + [live_price]
                
                try:
                    # 1. Time-Series Model Inference
                    clf_res = predictor_service.predict_direction(symbol, input_sequence)
                    
                    # 2. NLP News Sentiment Analysis Inference (Asynchronous / Cached)
                    sentiment_res = await get_cached_news_sentiment(symbol)
                    
                    # 3. Dual-Inference Algorithmic Weighting Convergence
                    merge_res = calculate_ultimate_confidence(clf_res, sentiment_res)
                    
                    # 4. Construct Multimodal Payload matching exact Phase 03 specifications
                    payload = {
                        "type": "live_update",
                        "ticker": symbol,
                        "price": live_price,
                        "live_price": live_price,
                        "ts_prediction": merge_res["ts_prediction"],
                        "ts_confidence": merge_res["ts_confidence"],
                        "nlp_sentiment": merge_res["nlp_sentiment"],
                        "nlp_confidence": merge_res["nlp_confidence"],
                        "ultimate_score": merge_res["ultimate_score"],
                        "final_decision": merge_res["final_decision"],
                        "prediction": merge_res["final_decision"],
                        "signal": merge_res["signal"],
                        "confidence": merge_res["confidence"],
                        "confidence_up": clf_res.get("confidence_up"),
                        "accuracy_metrics": clf_res.get("accuracy_metrics"),
                        "news_sentiment": sentiment_res
                    }
                    
                    # Broadcast updates to all subscribed client browser WebSockets
                    for conn, subs in manager.client_subscriptions.items():
                        if symbol in subs:
                            try:
                                await conn.send_json(payload)
                            except Exception as e:
                                logger.error(f"Error sending live update to client: {e}")
                                
                except Exception as e:
                    logger.error(f"Failed to calculate dual-inference prediction for {symbol}: {e}")


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
                
                for ticker in active_subscribed_tickers:
                    await ws.send(json.dumps({"type": "subscribe", "symbol": ticker}))
                    logger.info(f"Resubscribed to {ticker} on Finnhub reconnect")
                    
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
    Loads PredictorService and SentimentAnalyzer into memory once upon startup.
    """
    global predictor_service, sentiment_analyzer, finnhub_task
    logger.info("Initializing PredictorService and SentimentAnalyzer engines...")
    try:
        predictor_service = PredictorService()
        sentiment_analyzer = SentimentAnalyzer()
        
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
    title="Wealth Smith Multimodal ML Backend",
    description="Python backend microservice handling Time-Series ML, NLP Sentiment Analysis, and WebSockets.",
    version="3.0.0",
    lifespan=lifespan
)

# CORS Configuration
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
        "message": "Wealth Smith Multimodal ML Backend is Online",
        "loaded_ts_models": list(predictor_service.models.keys()) if predictor_service else [],
        "nlp_engine_ready": sentiment_analyzer.is_ready if sentiment_analyzer else False,
        "active_training_runs": list(training_tickers),
        "finnhub_connected": active_finnhub_ws is not None,
        "active_subscriptions": list(active_subscribed_tickers)
    }


@app.websocket("/ws/predict")
async def websocket_predict(websocket: WebSocket):
    """
    WebSocket endpoint accepting incoming stock subscription requests,
    executing Dual-Inference analysis, and streaming multimodal updates.
    """
    await manager.connect(websocket)
    
    try:
        while True:
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
                    
                    while ticker in training_tickers:
                        await asyncio.sleep(1.0)
                        
                    if not predictor_service.has_model_files(ticker):
                        await websocket.send_json({
                            "type": "status",
                            "status": "error",
                            "ticker": ticker,
                            "message": f"Training failed for {ticker}."
                        })
                        continue
                
                seeded = await seed_price_buffer(ticker)
                if not seeded:
                    await websocket.send_json({
                        "type": "status",
                        "status": "error",
                        "ticker": ticker,
                        "message": f"Failed to seed 60-day historical data for {ticker}."
                    })
                    continue
                
                await manager.subscribe(websocket, ticker)
                await websocket.send_json({
                    "type": "status",
                    "status": "success",
                    "ticker": ticker,
                    "message": f"Subscribed to real-time multimodal ML updates for {ticker}"
                })

                # Push initial multimodal prediction instantly from pre-seeded buffer
                if ticker in price_buffers:
                    buffer = price_buffers[ticker]
                    last_price = buffer[-1]
                    try:
                        clf_res = predictor_service.predict_direction(ticker, buffer)
                        sentiment_res = await get_cached_news_sentiment(ticker)
                        merge_res = calculate_ultimate_confidence(clf_res, sentiment_res)
                        
                        await websocket.send_json({
                            "type": "live_update",
                            "ticker": ticker,
                            "price": last_price,
                            "live_price": last_price,
                            "ts_prediction": merge_res["ts_prediction"],
                            "ts_confidence": merge_res["ts_confidence"],
                            "nlp_sentiment": merge_res["nlp_sentiment"],
                            "nlp_confidence": merge_res["nlp_confidence"],
                            "ultimate_score": merge_res["ultimate_score"],
                            "final_decision": merge_res["final_decision"],
                            "prediction": merge_res["final_decision"],
                            "signal": merge_res["signal"],
                            "confidence": merge_res["confidence"],
                            "confidence_up": clf_res.get("confidence_up"),
                            "accuracy_metrics": clf_res.get("accuracy_metrics"),
                            "news_sentiment": sentiment_res
                        })
                        logger.info(f"Sent initial multimodal prediction for {ticker}: {merge_res['final_decision']} (Ultimate Score: {merge_res['ultimate_score']})")
                    except Exception as e:
                        logger.error(f"Failed to send initial multimodal prediction for {ticker}: {e}")
                
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
