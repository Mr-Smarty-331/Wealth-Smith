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

export const getHistoricalData = async (symbol, timeframe = '6 Months') => {
    try {
        const apiKey = import.meta.env.VITE_POLYGON_API_KEY;
        if (!apiKey) {
            throw new Error("Polygon API key (VITE_POLYGON_API_KEY) is missing in environment variables.");
        }

        const toDate = new Date();
        let fromDate = new Date();
        let multiplier = 1;
        let timespan = 'day';

        switch (timeframe) {
            case '1 Day':
                fromDate.setDate(toDate.getDate() - 1);
                multiplier = 5;
                timespan = 'minute';
                break;
            case '1 Week':
                fromDate.setDate(toDate.getDate() - 7);
                multiplier = 30;
                timespan = 'minute';
                break;
            case '1 Month':
                fromDate.setMonth(toDate.getMonth() - 1);
                multiplier = 1;
                timespan = 'day';
                break;
            case '3 Months':
                fromDate.setMonth(toDate.getMonth() - 3);
                multiplier = 1;
                timespan = 'day';
                break;
            case '6 Months':
                fromDate.setMonth(toDate.getMonth() - 6);
                multiplier = 1;
                timespan = 'day';
                break;
            case '1 Year':
                fromDate.setFullYear(toDate.getFullYear() - 1);
                multiplier = 1;
                timespan = 'week';
                break;
            case '2 Years':
                fromDate.setFullYear(toDate.getFullYear() - 2);
                multiplier = 1;
                timespan = 'week';
                break;
            default:
                fromDate.setMonth(toDate.getMonth() - 6);
                multiplier = 1;
                timespan = 'day';
        }

        const toDateStr = toDate.toISOString().split('T')[0];
        const fromDateStr = fromDate.toISOString().split('T')[0];

        const response = await axios.get(
            `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}/range/${multiplier}/${timespan}/${fromDateStr}/${toDateStr}`,
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

export const getCompanyProfile = async (symbol) => {
    try {
        const response = await apiClient.get('/stock/profile2', {
            params: { symbol: symbol.toUpperCase() }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching company profile:', error);
        return null;
    }
};
