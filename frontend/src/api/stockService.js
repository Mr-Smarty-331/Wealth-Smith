import axios from "axios";
import apiClient from "./apiClient";
import { API_BASE_URL } from "./config";
import { normalizeStockQuote, normalizeHistoricalData } from "../utils/formatters";

export const getStockQuote = async (symbol) => {
    const cleanSymbol = symbol.toUpperCase().trim();
    try {
        const apiKey = import.meta.env.VITE_FINANCIAL_API_KEY;
        if (apiKey) {
            const response = await apiClient.get('/quote', { params: { symbol: cleanSymbol } });
            if (response.data && response.data.c !== undefined && response.data.c > 0) {
                return normalizeStockQuote(response.data, cleanSymbol);
            }
        }
        
        // Fetch CORS-free real-time stock quote from backend microservice
        const backendRes = await axios.get(`${API_BASE_URL}/api/quote`, {
            params: { symbol: cleanSymbol }
        });
        if (backendRes.data && backendRes.data.currentPrice) {
            return backendRes.data;
        }
        throw new Error("Price data unavailable");
    } catch (error) {
        console.error(`Error fetching real-time stock quote for ${cleanSymbol}:`, error);
        throw error;
    }
};

export const getHistoricalData = async (symbol, timeframe = '6 Months') => {
    const cleanSymbol = symbol.toUpperCase().trim();
    try {
        const apiKey = import.meta.env.VITE_POLYGON_API_KEY;
        if (apiKey) {
            const toDate = new Date();
            let fromDate = new Date();
            let multiplier = 1;
            let timespan = 'day';

            switch (timeframe) {
                case '1 Day': fromDate.setDate(toDate.getDate() - 1); multiplier = 5; timespan = 'minute'; break;
                case '1 Week': fromDate.setDate(toDate.getDate() - 7); multiplier = 30; timespan = 'minute'; break;
                case '1 Month': fromDate.setMonth(toDate.getMonth() - 1); multiplier = 1; timespan = 'day'; break;
                case '3 Months': fromDate.setMonth(toDate.getMonth() - 3); multiplier = 1; timespan = 'day'; break;
                case '6 Months': fromDate.setMonth(toDate.getMonth() - 6); multiplier = 1; timespan = 'day'; break;
                case '1 Year': fromDate.setFullYear(toDate.getFullYear() - 1); multiplier = 1; timespan = 'week'; break;
                case '2 Years': fromDate.setFullYear(toDate.getFullYear() - 2); multiplier = 1; timespan = 'week'; break;
                default: fromDate.setMonth(toDate.getMonth() - 6); multiplier = 1; timespan = 'day';
            }

            const toDateStr = toDate.toISOString().split('T')[0];
            const fromDateStr = fromDate.toISOString().split('T')[0];

            const response = await axios.get(
                `https://api.polygon.io/v2/aggs/ticker/${cleanSymbol}/range/${multiplier}/${timespan}/${fromDateStr}/${toDateStr}`,
                { params: { adjusted: 'true', sort: 'asc', apiKey: apiKey } }
            );

            if (response.data && response.data.results) {
                return normalizeHistoricalData(response.data);
            }
        }

        // Fetch CORS-free historical data from backend microservice
        const res = await axios.get(`${API_BASE_URL}/api/history`, {
            params: { symbol: cleanSymbol, timeframe }
        });
        if (res.data && res.data.results) {
            return res.data.results.map(item => ({
                date: new Date(item.timestamp || item.date),
                price: Number(item.close !== undefined ? item.close : (item.price || 0))
            }));
        }
        throw new Error("Historical data unavailable");
    } catch (error) {
        console.error(`Error fetching historical data for ${cleanSymbol}:`, error);
        throw error;
    }
};

export const getCompanyProfile = async (symbol) => {
    const cleanSymbol = symbol.toUpperCase().trim();
    try {
        const apiKey = import.meta.env.VITE_FINANCIAL_API_KEY;
        if (apiKey) {
            const response = await apiClient.get('/stock/profile2', {
                params: { symbol: cleanSymbol }
            });
            if (response.data && response.data.name) {
                return response.data;
            }
        }

        const res = await axios.get(`${API_BASE_URL}/api/profile`, {
            params: { symbol: cleanSymbol }
        });
        return res.data;
    } catch (error) {
        console.error('Error fetching company profile:', error);
        return { name: cleanSymbol, ticker: cleanSymbol };
    }
};
