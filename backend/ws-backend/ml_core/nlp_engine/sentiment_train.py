import os
import json
import joblib
import numpy as np
import pandas as pd
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout
try:
    from ml_core.nlp_engine.text_processor import clean_text, vectorize_texts
except ImportError:
    from text_processor import clean_text, vectorize_texts

# Paths
NLP_ENGINE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(NLP_ENGINE_DIR, "sentiment_model.h5")
VECTORIZER_PATH = os.path.join(NLP_ENGINE_DIR, "tfidf_vectorizer.pkl")

# Label mapping
LABEL_MAP = {"Bearish": 0, "Neutral": 1, "Bullish": 2}
REVERSE_LABEL_MAP = {0: "Bearish", 1: "Neutral", 2: "Bullish"}

def generate_financial_sentiment_dataset() -> pd.DataFrame:
    """Generate financial sentiment training data."""
    bullish_phrases = [
        "Apple reports record quarterly revenue beating Wall Street estimates driven by massive iPhone demand",
        "Microsoft cloud earnings surge past expectations with strong AI enterprise growth and expanding margins",
        "Nvidia chip sales skyrocket as demand for next generation AI GPUs accelerates worldwide",
        "Meta Platforms announces dividend hike and billions in share buyback authorization after profit blowout",
        "Tesla vehicle deliveries top forecasts as manufacturing efficiency improves and global sales expand",
        "Company raises full year profit guidance following strong operational execution and margin expansion",
        "Analysts upgrade stock rating to strong buy citing robust balance sheet and accelerated market share growth",
        "Biotech firm receives FDA approval for breakthrough cancer treatment opening massive addressable market",
        "Bank reports solid net interest income growth and declining non performing loan ratios",
        "Retail giant reports robust holiday sales growth driven by digital e commerce momentum",
        "Semiconductor equipment manufacturer secures major foundry contract boosting order backlog",
        "Software company expands operating margins significantly while accelerating annual recurring revenue growth",
        "Energy producer increases free cash flow yield and boosts quarterly cash payout to shareholders",
        "Aerospace leader receives multi billion dollar defense contract order securing multi year revenue visibility",
        "Pharmaceutical firm reports positive phase three clinical trial results meeting primary endpoints"
    ]
    
    neutral_phrases = [
        "Apple scheduled to host its annual developer conference next month to announce software updates",
        "Microsoft appoints new chief financial officer to succeed retiring executive after smooth transition",
        "Nvidia holds annual shareholder meeting to vote on routine corporate governance matters",
        "Meta Platforms maintains existing quarterly capital expenditure outlook for infrastructure investments",
        "Tesla scheduled to release its quarterly financial results after market close on Tuesday",
        "Company maintains previous financial outlook ahead of upcoming investor day presentation",
        "Federal Reserve holds benchmark interest rates steady while monitoring ongoing economic indicators",
        "Analysts reiterate neutral hold rating on stock pending further clarity on macro conditions",
        "Regulatory agency requests standard additional information regarding proposed industry merger",
        "Retailer opens new distribution center in Midwest region to optimize regional logistics operations",
        "Trading volume remains steady in quiet session as major indices consolidate near recent ranges",
        "Corporate presentation highlights ongoing strategic initiatives and multi year technology roadmap",
        "Board of directors schedules regular annual meeting of stockholders for late spring session",
        "Executive leadership participates in fireside chat at annual technology conference",
        "Financial report provides detailed breakdown of segment revenue and international operations"
    ]
    
    bearish_phrases = [
        "Apple shares sink after supply chain bottlenecks and rising component costs pressure gross margins",
        "Microsoft faces antitrust scrutiny and European regulatory investigation into cloud bundling practices",
        "Nvidia shares tumble following export restrictions and delayed product launches in key markets",
        "Meta Platforms warns of slowing advertising revenue growth and rising infrastructure expense burden",
        "Tesla cuts vehicle prices aggressively as competition intensifies and EV demand momentum slows",
        "Company slashes full year profit outlook warning of severe macroeconomic headwinds and falling demand",
        "Analysts downgrade stock to sell citing weakening cash flow balance sheet leverage and margin compression",
        "Regulatory investigation launched into potential accounting irregularities and delayed financial disclosures",
        "Bank reports unexpected credit loss provisions as commercial loan defaults increase sharply",
        "Retailer cuts earnings forecast citing persistent inflation inventory write downs and sluggish store foot traffic",
        "Securities exchange commission files enforcement action regarding corporate disclosure compliance",
        "Software provider loses major enterprise customer contract to competing platform causing revenue drop",
        "Manufacturing company halts production at key facility due to severe raw material shortages",
        "Biotech firm cancels clinical drug development candidate following disappointing safety trial data",
        "Rating agency downgrades corporate debt rating to junk status following debt restructuring concerns"
    ]
    
    data = []
    for phrase in bullish_phrases:
        data.append({"text": phrase, "label_str": "Bullish", "label": 2})
    for phrase in neutral_phrases:
        data.append({"text": phrase, "label_str": "Neutral", "label": 1})
    for phrase in bearish_phrases:
        data.append({"text": phrase, "label_str": "Bearish", "label": 0})
        
    # Duplicate data to improve TF-IDF
    df = pd.DataFrame(data)
    df_expanded = pd.concat([df] * 5, ignore_index=True)
    return df_expanded


def train_sentiment_model(max_features: int = 5000) -> bool:
    """Train sentiment model and save model & vectorizer."""
    print("Initializing Financial Sentiment Dataset...")
    df = generate_financial_sentiment_dataset()
    print(f"Total dataset samples: {len(df)}")
    
    # 1. Preprocess & clean
    print("Preprocessing and cleaning unstructured text...")
    df["clean_text"] = df["text"].apply(clean_text)
    
    # 2. TF-IDF vectorization
    print(f"Vectorizing texts with TfidfVectorizer (max_features={max_features})...")
    tfidf_matrix, vectorizer = vectorize_texts(df["clean_text"].tolist(), max_features=max_features)
    
    X_train = tfidf_matrix.toarray()
    y_train = df["label"].values
    
    print(f"X_train matrix shape: {X_train.shape}, y_train shape: {y_train.shape}")
    
    # 3. Build MLP model
    num_features = X_train.shape[1]
    model = Sequential([
        Dense(512, activation='relu', input_shape=(num_features,)),
        Dropout(0.3),
        Dense(256, activation='relu'),
        Dropout(0.2),
        Dense(3, activation='softmax')  # 3 classes: Bearish, Neutral, Bullish
    ])
    
    # 4. Compile
    model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    
    # 5. Train
    print("Training Deep Learning Sentiment Model...")
    model.fit(X_train, y_train, epochs=12, batch_size=16, verbose=1, validation_split=0.15)
    
    # 6. Save
    print(f"Saving trained NLP sentiment model to {MODEL_PATH}...")
    model.save(MODEL_PATH)
    print("Sentiment Engine training complete!")
    return True

if __name__ == "__main__":
    train_sentiment_model()
