import apiClient from "./apiClient";
import { normalizeStockQuote } from "../utils/formatters";

const getStockQuote = async (symbol) => {
    try {
        const response = await apiClient.get('/quote',
            { params: { symbol: symbol.toUpperCase() } });
        return normalizeStockQuote(response.data, symbol);
    } catch (error) {
        console.error('Error fetching stock quote:', error);
        throw error;
    }
};

export { getStockQuote }
