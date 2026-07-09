import os
import time
import logging
from datetime import datetime, timedelta

logger = logging.getLogger("ws-backend")

S3_BUCKET_NAME = os.getenv("AWS_S3_MODEL_BUCKET", "wealth-smith-ml-models")
MODEL_EXPIRATION_DAYS = 5

def get_s3_client():
    """Get boto3 S3 client if AWS keys exist."""
    try:
        import boto3
        if os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY"):
            return boto3.client("s3")
    except Exception:
        pass
    return None

async def save_model_to_aws(ticker: str, model_file_path: str, scaler_file_path: str) -> bool:
    """Save trained model & scaler to AWS S3 or fallback to local disk."""
    s3 = get_s3_client()
    ticker = ticker.toUpperCase() if hasattr(ticker, 'toUpperCase') else ticker.upper()

    if s3:
        try:
            model_s3_key = f"models/{ticker}/{ticker}_model.h5"
            scaler_s3_key = f"models/{ticker}/{ticker}_scaler.pkl"

            logger.info(f"📤 Uploading trained ML artifacts for {ticker} to AWS S3 ({S3_BUCKET_NAME})...")
            s3.upload_file(model_file_path, S3_BUCKET_NAME, model_s3_key)
            s3.upload_file(scaler_file_path, S3_BUCKET_NAME, scaler_s3_key)
            logger.info(f"✅ Successfully saved {ticker} ML artifacts to AWS S3 cloud storage.")
            return True
        except Exception as e:
            logger.error(f"Failed to upload {ticker} models to AWS S3: {e}")

    logger.info(f"ℹ️ Local Persistence: {ticker} ML model artifacts preserved on local disk.")
    return True

async def is_model_valid_and_fresh(ticker: str) -> bool:
    """Check if model exists and is < 5 days old."""
    s3 = get_s3_client()
    ticker = ticker.upper()

    if s3:
        try:
            model_s3_key = f"models/{ticker}/{ticker}_model.h5"
            response = s3.head_object(Bucket=S3_BUCKET_NAME, Key=model_s3_key)
            last_modified = response['LastModified']
            
            # Check 5-day expiry
            cutoff = datetime.now(last_modified.tzinfo) - timedelta(days=MODEL_EXPIRATION_DAYS)
            if last_modified < cutoff:
                logger.info(f"⏰ Model for {ticker} in AWS S3 is older than 5 days. Marking for retraining.")
                return False
            return True
        except Exception:
            return False

    # Local fallback
    local_model_path = os.path.join("models", f"{ticker}_model.h5")
    if os.path.exists(local_model_path):
        mtime = datetime.fromtimestamp(os.path.getmtime(local_model_path))
        if datetime.now() - mtime > timedelta(days=MODEL_EXPIRATION_DAYS):
            logger.info(f"⏰ Local model for {ticker} is older than 5 days. Expired.")
            return False
        return True
    return False

async def cleanup_outdated_aws_models():
    """Delete S3 models older than 5 days."""
    logger.info("🧹 Running automated 5-day ML Model Garbage Collection scanner...")
    s3 = get_s3_client()

    if s3:
        try:
            paginator = s3.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=S3_BUCKET_NAME, Prefix="models/")
            
            cutoff = datetime.now(timedelta(days=0).tzinfo) - timedelta(days=MODEL_EXPIRATION_DAYS)
            deleted_count = 0

            for page in pages:
                if "Contents" in page:
                    for obj in page["Contents"]:
                        key = obj["Key"]
                        last_mod = obj["LastModified"]
                        # Check 5-day expiry
                        if last_mod < datetime.now(last_mod.tzinfo) - timedelta(days=MODEL_EXPIRATION_DAYS):
                            logger.info(f"🗑️ Purging outdated ML artifact from AWS S3 (>5 days old): {key}")
                            s3.delete_object(Bucket=S3_BUCKET_NAME, Key=key)
                            deleted_count += 1
            logger.info(f"✅ AWS S3 Model Garbage Collection finished. Purged {deleted_count} outdated model artifacts.")
            return
        except Exception as e:
            logger.error(f"Error during AWS S3 model cleanup: {e}")

    # Local fallback
    models_dir = "models"
    if os.path.exists(models_dir):
        deleted_count = 0
        now = time.time()
        cutoff_seconds = MODEL_EXPIRATION_DAYS * 86400
        for fname in os.listdir(models_dir):
            fpath = os.path.join(models_dir, fname)
            if os.path.isfile(fpath):
                if now - os.path.getmtime(fpath) > cutoff_seconds:
                    os.remove(fpath)
                    deleted_count += 1
        if deleted_count > 0:
            logger.info(f"🧹 Purged {deleted_count} local model files older than 5 days.")
