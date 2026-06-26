import { useState, useEffect } from 'react';
import StockCard from './components/StockCard';
import { getStockQuote, getHistoricalData } from './api/stockService';
import LineChart from './components/LineChart';
import './index.css';

function App() {
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historicalData, setHistoricalData] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const symbol = 'AAPL';
        // We can fetch both at the same time using Promise.all to make it faster!
        const [quote, history] = await Promise.all([
          getStockQuote(symbol),
          getHistoricalData(symbol)
        ]);

        setStockData(quote);
        setHistoricalData(history);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="dashboard-container">
      <h1>Financial Dashboard</h1>

      <div style={{ marginTop: '20px', padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #ccc' }}>
        <h2>Phase 01 Test: Normalized Data</h2>

        {loading && <p>Fetching live market data...</p>}
        {error && <p style={{ color: 'red', fontWeight: 'bold' }}>Error: {error}</p>}

        <div className="dashboard-grid">
          {stockData && <StockCard data={stockData} />}
          {/* Render our D3 chart if we have data */}
          {historicalData.length > 0 && <LineChart data={historicalData} symbol={stockData?.symbol} />}
        </div>
      </div>
    </div>
  );
}

export default App;