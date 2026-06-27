import logging
from datetime import datetime, timedelta
import finnhub

# Set up logging for data collection events
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nlp-news-fetcher")

# Default Finnhub API credentials
DEFAULT_FINNHUB_KEY = "d8s361hr01qlj6ffrq20d8s361hr01qlj6ffrq2g"

def fetch_company_news(ticker: str, days_back: int = 30, api_key: str = DEFAULT_FINNHUB_KEY) -> list[str]:
    """
    Fetches company news articles for the specified ticker over the last `days_back` days from Finnhub.
    Concatenates the headline and summary of each article into a clean text string.

    :param ticker: Stock ticker symbol (e.g., 'AAPL', 'MSFT')
    :param days_back: Number of days in the past to fetch news for (default: 30)
    :param api_key: Finnhub API Key
    :return: List of concatenated news article strings (headline + summary)
    """
    ticker = ticker.upper().strip()
    
    # Calculate dynamic start (_from) and end (to) date strings in YYYY-MM-DD format
    to_date = datetime.now()
    from_date = to_date - timedelta(days=days_back)
    
    to_str = to_date.strftime("%Y-%m-%d")
    from_str = from_date.strftime("%Y-%m-%d")
    
    logger.info(f"Fetching company news for {ticker} from {from_str} to {to_str}...")
    
    try:
        # Initialize Finnhub API client
        finnhub_client = finnhub.Client(api_key=api_key)
        
        # Query Finnhub company news endpoint
        news_articles = finnhub_client.company_news(ticker, _from=from_str, to=to_str)
        
        if not news_articles or not isinstance(news_articles, list):
            logger.warning(f"No news articles returned by Finnhub for ticker: {ticker}")
            return []
            
        logger.info(f"Retrieved {len(news_articles)} news articles for {ticker}.")
        
        combined_texts = []
        for article in news_articles:
            headline = article.get("headline", "").strip()
            summary = article.get("summary", "").strip()
            
            # Combine non-empty headline and summary
            if headline or summary:
                full_text = f"{headline}. {summary}".strip()
                combined_texts.append(full_text)
                
        return combined_texts
        
    except Exception as e:
        logger.error(f"Error fetching news for ticker {ticker} from Finnhub: {e}")
        return []

if __name__ == "__main__":
    # Standalone test run
    test_ticker = "AAPL"
    articles = fetch_company_news(test_ticker, days_back=7)
    print(f"\n--- Sample Article Output for {test_ticker} (Total: {len(articles)}) ---")
    for idx, text in enumerate(articles[:3], 1):
        print(f"[{idx}] {text}\n")
