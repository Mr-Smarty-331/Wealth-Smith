import os
import asyncio
from contextlib import asynccontextmanager
from typing import Optional, List
import logging
import json
import time
import numpy as np
import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ml_core.predict import PredictorService
from ml_core.nlp_engine.sentiment_predictor import SentimentAnalyzer
from ml_core.nlp_engine.news_fetcher import fetch_company_news
from database import engine, Base, get_db
import models
import schemas
import auth
from email_service import generate_otp, send_otp_email

# Set up logging to track connection and data lifecycle events
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ws-backend")

# Global services & managers
predictor_service = None
sentiment_analyzer = None
active_finnhub_ws = None
finnhub_task = None

def get_predictor():
    global predictor_service
    if predictor_service is None:
        from ml_core.predict import PredictorService
        predictor_service = PredictorService()
    return predictor_service

def get_sentiment():
    global sentiment_analyzer
    if sentiment_analyzer is None:
        from ml_core.nlp_engine.sentiment_predictor import SentimentAnalyzer
        sentiment_analyzer = SentimentAnalyzer()
    return sentiment_analyzer

# Finnhub Credentials & Stream config
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "d8s361hr01qlj6ffrq20d8s361hr01qlj6ffrq2g")
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
        
        # Run sentiment analysis on fetched headlines using lazy getter
        sentiment_res = get_sentiment().analyze_headlines(headlines)
        
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


cleanup_task = None
model_cleanup_task = None

async def cleanup_unverified_accounts():
    """
    Background worker running periodically to delete unverified accounts
    older than 24 hours from PostgreSQL.
    """
    from datetime import datetime, timedelta
    from database import AsyncSessionLocal
    from sqlalchemy import delete
    
    while True:
        try:
            cutoff = datetime.utcnow() - timedelta(hours=24)
            async with AsyncSessionLocal() as session:
                stmt = delete(models.User).where(
                    models.User.is_verified == False,
                    models.User.created_at < cutoff
                )
                res = await session.execute(stmt)
                await session.commit()
                if res.rowcount > 0:
                    logger.info(f"🧹 Database Cleanup: Purged {res.rowcount} unverified accounts older than 24h.")
        except Exception as e:
            logger.error(f"Error during unverified accounts cleanup: {e}")
            
        # Run cleanup every 6 hours
        await asyncio.sleep(6 * 3600)


async def periodic_model_cleanup_worker():
    """
    Background worker scanning AWS storage once every 12 hours to delete models older than 5 days.
    """
    from model_storage_service import cleanup_outdated_aws_models
    while True:
        try:
            await cleanup_outdated_aws_models()
        except Exception as e:
            logger.error(f"Error during automated ML model cleanup: {e}")
        await asyncio.sleep(12 * 3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan manager to handle startup and shutdown logic.
    Loads PredictorService and SentimentAnalyzer into memory once upon startup,
    initializes database tables, and starts background database and model cleanup workers.
    """
    global predictor_service, sentiment_analyzer, finnhub_task, cleanup_task, model_cleanup_task
    import database
    logger.info("Initializing PredictorService and SentimentAnalyzer engines...")
    try:
        # Create database tables if they do not exist
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified/created successfully.")

        predictor_service = PredictorService()
        sentiment_analyzer = SentimentAnalyzer()
        
        # Load any existing models in models/ folder
        DEFAULT_TICKERS = ["AAPL", "MSFT", "TSLA", "NVDA", "META"]
        for ticker in DEFAULT_TICKERS:
            if predictor_service.has_model_files(ticker):
                predictor_service.load_ticker_model(ticker)
                logger.info(f"Pre-loaded existing model for {ticker} from disk.")
                
        # Start background Finnhub listener, database cleanup, and 5-day model garbage collection
        finnhub_task = asyncio.create_task(finnhub_listener())
        cleanup_task = asyncio.create_task(cleanup_unverified_accounts())
        model_cleanup_task = asyncio.create_task(periodic_model_cleanup_worker())
    except Exception as e:
        logger.error(f"Failed to initialize server lifespan components: {e}")
        
    yield
    
    # Clean up
    if finnhub_task:
        finnhub_task.cancel()
        await asyncio.gather(finnhub_task, return_exceptions=True)
    if cleanup_task:
        cleanup_task.cancel()
        await asyncio.gather(cleanup_task, return_exceptions=True)
    if model_cleanup_task:
        model_cleanup_task.cancel()
        await asyncio.gather(model_cleanup_task, return_exceptions=True)
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


@app.get("/api/quote")
async def get_live_stock_quote(symbol: str):
    """
    Returns real-time stock quote via yfinance for backend proxying.
    """
    import yfinance as yf
    clean_sym = symbol.upper().trim() if hasattr(symbol, 'trim') else symbol.upper().strip()
    try:
        ticker = yf.Ticker(clean_sym)
        info = ticker.fast_info
        current_price = float(info.last_price or info.previous_close or 0.0)
        prev_close = float(info.previous_close or current_price)
        change = current_price - prev_close
        pct_change = ((current_price - prev_close) / prev_close * 100.0) if prev_close > 0 else 0.0
        
        return {
            "symbol": clean_sym,
            "currentPrice": round(current_price, 2),
            "change": round(change, 2),
            "percentChange": round(pct_change, 2),
            "high": round(float(info.day_high or current_price), 2),
            "low": round(float(info.day_low or current_price), 2),
            "open": round(float(info.open or current_price), 2),
            "previousClose": round(prev_close, 2)
        }
    except Exception as e:
        logger.error(f"Error fetching quote for {clean_sym}: {e}")
        raise HTTPException(status_code=404, detail=f"Stock quote unavailable for {clean_sym}")


@app.get("/api/history")
async def get_historical_chart_data(symbol: str, timeframe: str = "6 Months"):
    """
    Returns historical stock price points via yfinance for interactive charts.
    """
    import yfinance as yf
    clean_sym = symbol.upper().strip()
    period_map = {
        "1 Day": ("1d", "5m"),
        "1 Week": ("5d", "15m"),
        "1 Month": ("1mo", "1d"),
        "3 Months": ("3mo", "1d"),
        "6 Months": ("6mo", "1d"),
        "1 Year": ("1y", "1wk"),
        "2 Years": ("2y", "1wk")
    }
    period, interval = period_map.get(timeframe, ("6mo", "1d"))
    try:
        df = yf.download(clean_sym, period=period, interval=interval, progress=False)
        if df.empty:
            raise ValueError("No data returned")
            
        results = []
        for idx, row in df.iterrows():
            close_val = float(row["Close"].iloc[0] if hasattr(row["Close"], "iloc") else row["Close"])
            timestamp_ms = int(idx.timestamp() * 1000)
            results.append({
                "timestamp": timestamp_ms,
                "date": idx.strftime("%b %d" if "m" in interval else "%b %Y"),
                "close": round(close_val, 2)
            })
        return {"symbol": clean_sym, "results": results}
    except Exception as e:
        logger.error(f"Error fetching history for {clean_sym}: {e}")
        raise HTTPException(status_code=404, detail=f"Historical data unavailable for {clean_sym}")


@app.get("/api/news")
async def get_company_news(symbol: str):
    """
    Returns live financial news articles via yfinance.
    """
    import yfinance as yf
    clean_sym = symbol.upper().strip()
    try:
        ticker = yf.Ticker(clean_sym)
        raw_news = ticker.news or []
        articles = []
        for idx, item in enumerate(raw_news[:10]):
            content = item.get("content", {})
            articles.append({
                "id": str(idx),
                "headline": content.get("title") or item.get("title") or f"Market updates for {clean_sym}",
                "summary": content.get("summary") or item.get("publisher") or "Latest financial analysis and market sentiment.",
                "url": content.get("canonicalUrl", {}).get("url") or item.get("link") or "https://finance.yahoo.com",
                "source": content.get("provider", {}).get("displayName") or item.get("publisher") or "Financial News",
                "datetime": int(time.time())
            })
        return articles
    except Exception as e:
        logger.error(f"Error fetching news for {clean_sym}: {e}")
        return []


@app.get("/api/profile")
async def get_company_profile_backend(symbol: str):
    """
    Returns company metadata profile cleanly.
    """
    import yfinance as yf
    clean_sym = symbol.upper().strip()
    try:
        ticker = yf.Ticker(clean_sym)
        info = ticker.info or {}
        return {
            "name": info.get("longName") or info.get("shortName") or clean_sym,
            "ticker": clean_sym,
            "currency": info.get("currency") or "USD",
            "country": info.get("country") or "US",
            "industry": info.get("industry") or "Technology"
        }
    except Exception:
        return {"name": clean_sym, "ticker": clean_sym}


@app.get("/api/sentiment")
async def get_stock_sentiment(symbol: str):
    """
    Returns NLP Sentiment Analysis results for symbol.
    """
    clean_sym = symbol.upper().strip()
    return await get_cached_news_sentiment(clean_sym)


# =====================================================================
# AUTHENTICATION REST API ENDPOINTS
# =====================================================================

@app.post("/api/auth/register")
async def register(user_data: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    from datetime import datetime, timedelta
    from sqlalchemy.exc import IntegrityError
    try:
        # Check if user already exists
        query = select(models.User).where(models.User.email == user_data.email)
        result = await db.execute(query)
        existing_user = result.scalars().first()
        if existing_user:
            if existing_user.is_verified:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An account with this email already exists."
                )
            else:
                # Re-generate OTP for unverified user
                otp_code = generate_otp()
                existing_user.password_hash = auth.get_password_hash(user_data.password)
                existing_user.otp_code = otp_code
                existing_user.otp_expires_at = datetime.utcnow() + timedelta(seconds=600)
                await db.commit()
                await send_otp_email(user_data.email, otp_code)
                return {
                    "status": "otp_sent",
                    "message": "Verification code re-sent to your email.",
                    "email": user_data.email,
                    "dev_otp_code": otp_code
                }
            
        hashed_pwd = auth.get_password_hash(user_data.password)
        otp_code = generate_otp()
        new_user = models.User(
            email=user_data.email,
            password_hash=hashed_pwd,
            cash_balance=100000.0,
            is_verified=False,
            otp_code=otp_code,
            otp_expires_at=datetime.utcnow() + timedelta(seconds=600)
        )
        db.add(new_user)
        await db.commit()
        
        await send_otp_email(user_data.email, otp_code)
        return {
            "status": "otp_sent",
            "message": "Verification code sent to your email.",
            "email": user_data.email,
            "dev_otp_code": otp_code
        }
    except HTTPException:
        raise
    except IntegrityError:
        await db.rollback()
        logger.warning(f"IntegrityError during registration for {user_data.email} (likely race condition duplicate).")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please sign in instead."
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Error during user registration: {e}")
        raise HTTPException(status_code=400, detail=f"Registration failed. Please try again.")


def _serialize_user(user: models.User) -> dict:
    """Convert a SQLAlchemy User ORM instance into a clean dict matching UserResponse schema."""
    return {
        "id": user.id,
        "email": user.email,
        "cash_balance": user.cash_balance,
        "is_verified": user.is_verified,
        "created_at": user.created_at
    }


@app.post("/api/auth/verify-otp", response_model=schemas.Token)
async def verify_otp(payload: schemas.VerifyOTP, db: AsyncSession = Depends(get_db)):
    from datetime import datetime
    query = select(models.User).where(models.User.email == payload.email)
    result = await db.execute(query)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found. Please register first.")
        
    if user.is_verified:
        access_token = auth.create_access_token(data={"sub": user.email})
        return {"access_token": access_token, "token_type": "bearer", "user": _serialize_user(user)}
        
    if user.otp_code != payload.otp_code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification code. Please check your email.")
        
    if user.otp_expires_at and datetime.utcnow() > user.otp_expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code has expired. Please register again to get a new code.")
        
    user.is_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    await db.commit()
    await db.refresh(user)
    
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer", "user": _serialize_user(user)}


@app.post("/api/auth/login", response_model=schemas.Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    query = select(models.User).where(models.User.email == form_data.username)
    result = await db.execute(query)
    user = result.scalars().first()
    
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your email address has not been verified. Please register again to get a new verification code."
        )
        
    access_token = auth.create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": _serialize_user(user)
    }





# =====================================================================
# PERSISTENT PORTFOLIO REST API ENDPOINTS
# =====================================================================

@app.get("/api/portfolio", response_model=schemas.PortfolioResponse)
async def get_portfolio(
    current_user: Optional[models.User] = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user:
        # Fallback for unauthenticated guest sessions
        return {"cash": 100000.0, "holdings": []}
        
    query = select(models.Holding).where(models.Holding.user_id == current_user.id)
    result = await db.execute(query)
    holdings_list = result.scalars().all()
    
    formatted_holdings = [
        {"ticker": h.ticker, "shares": h.shares, "buyPrice": h.avg_buy_price}
        for h in holdings_list if h.shares > 0
    ]
    
    return {
        "cash": current_user.cash_balance,
        "holdings": formatted_holdings
    }


@app.post("/api/trades/execute")
async def execute_trade(
    trade: schemas.TradeExecute,
    current_user: Optional[models.User] = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="You must be logged in to execute persistent trades."
        )
        
    trade.symbol = trade.symbol.upper().strip()
    cost = trade.shares * trade.price
    
    if trade.action == "BUY":
        if current_user.cash_balance < cost:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient cash balance! Required: ${cost:.2f}, Available: ${current_user.cash_balance:.2f}"
            )
            
        current_user.cash_balance -= cost
        
        # Check if holding already exists for user
        query = select(models.Holding).where(
            models.Holding.user_id == current_user.id,
            models.Holding.ticker == trade.symbol
        )
        result = await db.execute(query)
        holding = result.scalars().first()
        
        if holding:
            total_shares = holding.shares + trade.shares
            avg_price = ((holding.shares * holding.avg_buy_price) + cost) / total_shares
            holding.shares = total_shares
            holding.avg_buy_price = round(avg_price, 2)
        else:
            holding = models.Holding(
                user_id=current_user.id,
                ticker=trade.symbol,
                shares=trade.shares,
                avg_buy_price=round(trade.price, 2)
            )
            db.add(holding)
            
    elif trade.action == "SELL":
        query = select(models.Holding).where(
            models.Holding.user_id == current_user.id,
            models.Holding.ticker == trade.symbol
        )
        result = await db.execute(query)
        holding = result.scalars().first()
        
        if not holding or holding.shares < trade.shares:
            owned = holding.shares if holding else 0.0
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You do not own enough shares of {trade.symbol} to sell. Owned: {owned}"
            )
            
        current_user.cash_balance += cost
        holding.shares -= trade.shares
        if holding.shares <= 0.0001:
            await db.delete(holding)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid action. Must be BUY or SELL."
        )
        
    # Log immutable transaction audit record
    transaction_record = models.Transaction(
        user_id=current_user.id,
        action=trade.action,
        ticker=trade.symbol,
        shares=trade.shares,
        price=trade.price
    )
    db.add(transaction_record)
    
    await db.commit()
    await db.refresh(current_user)
    
    # Return updated portfolio summary
    query_holdings = select(models.Holding).where(models.Holding.user_id == current_user.id)
    res_holdings = await db.execute(query_holdings)
    updated_holdings = res_holdings.scalars().all()
    
    return {
        "status": "success",
        "cash": current_user.cash_balance,
        "holdings": [
            {"ticker": h.ticker, "shares": h.shares, "buyPrice": h.avg_buy_price}
            for h in updated_holdings if h.shares > 0
        ]
    }


@app.get("/api/transactions")
async def get_transactions(
    current_user: Optional[models.User] = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user:
        return []
    query = select(models.Transaction).where(models.Transaction.user_id == current_user.id).order_by(models.Transaction.timestamp.desc())
    result = await db.execute(query)
    records = result.scalars().all()
    return [
        {
            "id": t.id,
            "action": t.action,
            "ticker": t.ticker,
            "shares": t.shares,
            "price": t.price,
            "timestamp": t.timestamp.isoformat() if t.timestamp else ""
        }
        for t in records
    ]


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
                pred_svc = get_predictor()
                if not pred_svc.has_model_files(ticker):
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
                        
                    if not pred_svc.has_model_files(ticker):
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
                        clf_res = pred_svc.predict_direction(ticker, buffer)
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
