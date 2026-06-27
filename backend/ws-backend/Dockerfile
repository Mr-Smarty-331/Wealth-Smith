# Use official lightweight Python 3.12 slim base image
FROM python:3.12-slim

# Set environment variables to prevent Python from writing pyc files and buffering stdout
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# Set working directory inside container
WORKDIR /app

# Install system dependencies needed for C compilation and NLTK downloads
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt-get/lists/*

# Copy python dependencies list
COPY requirements.txt /app/requirements.txt

# Install Python packages inside container
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir finnhub-python nltk scikit-learn

# Pre-download NLTK stopwords and tokenizers inside the image to avoid runtime download overhead
RUN python -c "import nltk, ssl; ssl._create_default_https_context = ssl._create_unverified_context; nltk.download('stopwords'); nltk.download('punkt'); nltk.download('punkt_tab')"

# Copy backend application source code and trained models
COPY . /app

# Expose FastAPI port
EXPOSE 8000

# Run FastAPI uvicorn server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
