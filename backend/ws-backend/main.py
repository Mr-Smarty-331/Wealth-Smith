import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Set up logging to track connection and data lifecycle events
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ws-backend")

app = FastAPI(
    title="Wealth Smith ML Backend",
    description="Python backend microservice handling Machine Learning inference and WebSockets.",
    version="1.0.0"
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
    return {"message": "Wealth Smith ML Backend is Online"}


@app.websocket("/ws/predict")
async def websocket_predict(websocket: WebSocket):
    """
    WebSocket endpoint that accepts incoming stock prediction queries,
    logs the inputs, and sends back simulated price forecasts.
    """
    await websocket.accept()
    logger.info("WebSocket connection established at /ws/predict")
    
    try:
        while True:
            # Receive data from client (expects ticker symbol or configuration text)
            data = await websocket.receive_text()
            logger.info(f"Received query payload from client: {data}")
            
            # Send back placeholder ML prediction output
            response_payload = {
                "status": "success",
                "message": f"Server received: {data}",
                "mock_prediction": 150.25
            }
            await websocket.send_json(response_payload)
            logger.info("Sent mock prediction payload to client")
            
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed cleanly by the client")
    except Exception as e:
        logger.error(f"Unexpected error in WebSocket lifecycle: {e}")
    finally:
        # FastAPI handles closing the connection automatically upon exiting,
        # but logging here helps audit connections.
        logger.info("WebSocket cleanup complete")
