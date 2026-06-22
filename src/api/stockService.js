import apiClient from "./apiClient";

const getStockQuote = async (symbol) => {
    try {
        const response = await apiClient.get('/quote',
            { params: { symbol: symbol.toUpperCase() } });
        return response.data;
    } catch (error) {
        console.error('Error fetching stock quote:', error);
        throw error;
    }
};

export { getStockQuote }
