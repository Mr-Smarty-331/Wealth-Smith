import os
import logging
import joblib
import numpy as np
from tensorflow.keras.models import load_model
try:
    from ml_core.nlp_engine.text_processor import clean_text
except ImportError:
    from text_processor import clean_text

# Set up logging for sentiment analysis
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nlp-sentiment-predictor")

NLP_ENGINE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(NLP_ENGINE_DIR, "sentiment_model.h5")
VECTORIZER_PATH = os.path.join(NLP_ENGINE_DIR, "tfidf_vectorizer.pkl")

# Sentiment Label Mappings
LABEL_NAMES = {0: "Bearish", 1: "Neutral", 2: "Bullish"}

class SentimentAnalyzer:
    """
    Inference service for Deep Learning NLP Sentiment Analysis.
    Loads sentiment_model.h5 and tfidf_vectorizer.pkl into memory once upon initialization.
    """
    def __init__(self):
        self.model = None
        self.vectorizer = None
        self.is_ready = False
        self._load_resources()

    def _load_resources(self):
        """
        Loads trained model and vectorizer from disk into memory.
        """
        if not os.path.exists(MODEL_PATH) or not os.path.exists(VECTORIZER_PATH):
            logger.warning(f"Sentiment model or vectorizer file missing in {NLP_ENGINE_DIR}. Auto-training may be required.")
            return

        try:
            logger.info("Loading Deep Learning Sentiment Model (sentiment_model.h5)...")
            self.model = load_model(MODEL_PATH)
            
            logger.info("Loading TF-IDF Vectorizer (tfidf_vectorizer.pkl)...")
            self.vectorizer = joblib.load(VECTORIZER_PATH)
            
            self.is_ready = True
            logger.info("SentimentAnalyzer engine initialized successfully!")
        except Exception as e:
            logger.error(f"Failed to load SentimentAnalyzer resources: {e}")
            self.is_ready = False

    def analyze_headlines(self, headlines_list: list[str]) -> dict:
        """
        Analyzes a list of unstructured financial headlines/summaries, cleans each text item,
        transforms them via TF-IDF vectorizer, runs Keras neural network inference, and aggregates predictions.

        :param headlines_list: List of raw news headline/summary strings
        :return: JSON-friendly sentiment dictionary containing ratios, overall sentiment, and score
        """
        if not self.is_ready:
            # Attempt reloading if not ready
            self._load_resources()
            if not self.is_ready:
                return {
                    "overall_sentiment": "Neutral",
                    "bullish_ratio": 0.33,
                    "bearish_ratio": 0.33,
                    "neutral_ratio": 0.34,
                    "sentiment_score": 0.0,
                    "total_articles": 0,
                    "error": "Sentiment model not loaded."
                }

        if not headlines_list or not isinstance(headlines_list, list):
            return {
                "overall_sentiment": "Neutral",
                "bullish_ratio": 0.33,
                "bearish_ratio": 0.33,
                "neutral_ratio": 0.34,
                "sentiment_score": 0.0,
                "total_articles": 0,
                "message": "No headlines provided."
            }

        # 1. Clean all input headlines
        cleaned_texts = [clean_text(text) for text in headlines_list]
        cleaned_texts = [t for t in cleaned_texts if len(t.strip()) > 0]
        
        if not cleaned_texts:
            return {
                "overall_sentiment": "Neutral",
                "bullish_ratio": 0.33,
                "bearish_ratio": 0.33,
                "neutral_ratio": 0.34,
                "sentiment_score": 0.0,
                "total_articles": len(headlines_list)
            }

        try:
            # 2. Vectorize cleaned texts using loaded vectorizer
            tfidf_matrix = self.vectorizer.transform(cleaned_texts).toarray()
            
            # 3. Run neural network inference (Softmax output probabilities for 3 classes: [Bearish, Neutral, Bullish])
            predictions_probs = self.model.predict(tfidf_matrix, verbose=0)
            predicted_classes = np.argmax(predictions_probs, axis=1)
            
            total_count = len(predicted_classes)
            bearish_count = int(np.sum(predicted_classes == 0))
            neutral_count = int(np.sum(predicted_classes == 1))
            bullish_count = int(np.sum(predicted_classes == 2))
            
            bullish_ratio = round(bullish_count / total_count, 4)
            bearish_ratio = round(bearish_count / total_count, 4)
            neutral_ratio = round(neutral_count / total_count, 4)
            
            # Net sentiment score in range [-1.0, +1.0]
            sentiment_score = round(bullish_ratio - bearish_ratio, 4)
            
            # Determine overall sentiment label
            if sentiment_score >= 0.15:
                overall = "Bullish"
            elif sentiment_score <= -0.15:
                overall = "Bearish"
            else:
                overall = "Neutral"

            return {
                "overall_sentiment": overall,
                "bullish_ratio": bullish_ratio,
                "bearish_ratio": bearish_ratio,
                "neutral_ratio": neutral_ratio,
                "sentiment_score": sentiment_score,
                "total_articles": total_count
            }

        except Exception as e:
            logger.error(f"Error during sentiment prediction execution: {e}")
            return {
                "overall_sentiment": "Neutral",
                "bullish_ratio": 0.33,
                "bearish_ratio": 0.33,
                "neutral_ratio": 0.34,
                "sentiment_score": 0.0,
                "total_articles": len(headlines_list),
                "error": str(e)
            }

if __name__ == "__main__":
    # Standalone test run
    analyzer = SentimentAnalyzer()
    sample_news = [
        "Apple reports massive profits in tech sector expansion with strong iPhone sales",
        "Stock market faces inflation pressure, rising bond yields, and severe economic slowdown",
        "Corporate presentation highlights ongoing strategic initiatives and stable operations"
    ]
    result = analyzer.analyze_headlines(sample_news)
    print("\n--- Sentiment Analyzer Verification ---")
    print(result)
