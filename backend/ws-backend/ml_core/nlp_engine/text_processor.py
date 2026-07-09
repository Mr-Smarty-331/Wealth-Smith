import os
import re
import logging
import joblib
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from sklearn.feature_extraction.text import TfidfVectorizer

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nlp-text-processor")

# Ensure NLTK data is downloaded
try:
    stop_words_set = set(stopwords.words('english'))
except Exception:
    import ssl
    ssl._create_default_https_context = ssl._create_unverified_context
    nltk.download('stopwords', quiet=True)
    nltk.download('punkt', quiet=True)
    nltk.download('punkt_tab', quiet=True)
    stop_words_set = set(stopwords.words('english'))

# Output directory
NLP_ENGINE_DIR = os.path.dirname(__file__)

def clean_text(text: str) -> str:
    """Clean text by lowercasing, removing punctuation, tokenizing, and removing stopwords."""
    if not text or not isinstance(text, str):
        return ""
        
    # 1. Lowercase
    text_lower = text.lower()
    
    # 2. Remove punctuation
    text_alpha = re.sub(r'[^a-zA-Z\s]', '', text_lower)
    
    # 3. Tokenize
    try:
        tokens = word_tokenize(text_alpha)
    except Exception:
        tokens = text_alpha.split()
        
    # 4. Stopwords
    clean_tokens = [word for word in tokens if word not in stop_words_set and len(word) > 1]
    
    # 5. Rejoin tokens
    return " ".join(clean_tokens)


def vectorize_texts(clean_texts_list: list[str], max_features: int = 5000, save_filename: str = "tfidf_vectorizer.pkl"):
    """Fit TF-IDF vectorizer, transform texts, and save to disk."""
    if not clean_texts_list:
        logger.warning("Empty text list provided for vectorization.")
        return None, None
        
    logger.info(f"Vectorizing {len(clean_texts_list)} text items using TfidfVectorizer (max_features={max_features})...")
    
    # Init vectorizer
    vectorizer = TfidfVectorizer(max_features=max_features)
    
    # Fit & transform
    tfidf_matrix = vectorizer.fit_transform(clean_texts_list)
    
    # Save to disk
    save_path = os.path.join(NLP_ENGINE_DIR, save_filename)
    logger.info(f"Exporting fitted TfidfVectorizer object to {save_path}...")
    joblib.dump(vectorizer, save_path)
    
    return tfidf_matrix, vectorizer


if __name__ == "__main__":
    # Test run
    sample_raw_text = "Apple Inc. (AAPL) announces record Q4 iPhone sales, beating Wall Street earnings estimates!"
    cleaned = clean_text(sample_raw_text)
    print("\n--- Text Cleaning Verification ---")
    print(f"RAW TEXT:     {sample_raw_text}")
    print(f"CLEANED TEXT: {cleaned}")
    
    sample_corpus = [
        "Apple reports massive profits in tech sector expansion",
        "Stock market faces inflation pressure and rate hikes",
        "Microsoft launches new AI features for enterprise customers"
    ]
    cleaned_corpus = [clean_text(t) for t in sample_corpus]
    matrix, vec = vectorize_texts(cleaned_corpus)
    print(f"\n--- Vectorization Output Shape: {matrix.shape} ---")
