import axios from "axios";
import apiClient from "./apiClient";
import { normalizeStockQuote, normalizeHistoricalData } from "../utils/formatters";

export const getStockQuote = async (symbol) => {
    try {
        const response = await apiClient.get('/quote',
            { params: { symbol: symbol.toUpperCase() } });
        return normalizeStockQuote(response.data, symbol);
    } catch (error) {
        console.error('Error fetching stock quote:', error);
        throw error;
    }
};

export const getHistoricalData = async (symbol) => {
    try {
        const apiKey = import.meta.env.VITE_POLYGON_API_KEY;
        if (!apiKey) {
            throw new Error("Polygon API key (VITE_POLYGON_API_KEY) is missing in environment variables.");
        }

        // Format dates as YYYY-MM-DD
        const toDateStr = new Date().toISOString().split('T')[0];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const fromDateStr = thirtyDaysAgo.toISOString().split('T')[0];

        const response = await axios.get(
            `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}/range/1/day/${fromDateStr}/${toDateStr}`,
            {
                params: {
                    adjusted: 'true',
                    sort: 'asc',
                    apiKey: apiKey
                }
            }
        );

        return normalizeHistoricalData(response.data);
    } catch (error) {
        console.error(`Error fetching historical data for ${symbol}:`, error);
        throw error;
    }
};
