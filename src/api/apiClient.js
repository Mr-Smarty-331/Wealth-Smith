import axios from "axios";

const apiClient = axios.create({
    baseURL: 'https://finnhub.io/api/v1',
    timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
    config.params = config.params || {};
    config.params.token = import.meta.env.VITE_FINANCIAL_API_KEY;
    return config;
});

export default apiClient;
