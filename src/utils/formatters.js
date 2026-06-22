/**
 * Normalizes raw stock quote data from Finnhub into a readable object.
 * @param {Object} rawData - The raw JSON from the API response
 * @param {string} symbol - The stock ticker symbol (e.g., 'AAPL')
 * @returns {Object} Cleaned, standardized stock data
 */

export const normalizeStockQuote = (rawData, symbol) => {
    if (!rawData || rawData.c === 0) {
        throw new Error(`Invalid or missing stock data for ${symbol}`)
    }

    const priceChange = rawData.c - rawData.pc;
    const percentChange = (priceChange / rawData.pc) * 100;

    return {
        symbol: symbol.toUpperCase(),
        currentPrice: rawData.c,
        highPrice: rawData.h,
        lowPrice: rawData.l,
        openPrice: rawData.o,
        previousClose: rawData.pc,
        change: Number(priceChange.toFixed(2)),
        changePercent: Number(percentChange.toFixed(2)),
        timestamp: rawData.t * 1000
    };
}