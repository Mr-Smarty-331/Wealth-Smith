/** Normalize stock quote from Finnhub. */
export const normalizeStockQuote = (rawData, symbol) => {
    if (!rawData || rawData.c === 0) {
        throw new Error(`Invalid or missing stock data for ${symbol}`);
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
};

/** Normalize historical data from Polygon.io. */
export const normalizeHistoricalData = (rawData) => {
    if (!rawData || !rawData.results) {
        return [];
    }

    return rawData.results.map((item) => ({
        date: new Date(item.t), // timestamp
        price: item.c          // close price
    }));
};