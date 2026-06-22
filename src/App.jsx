import { useState, useEffect } from 'react';
import { getStockQuote } from './api/stockService';
import './index.css';

function App() {
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTestQuote = async () => {
      try {
        const data = await getStockQuote('AAPL');
        setStockData(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchTestQuote();
  }, []);

  return (
    <div className="dashboard-container">
      <h1>Financial Dashboard</h1>

      <div style={{ marginTop: '20px', padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #ccc' }}>
        <h2>Phase 01 Test: Normalized Data</h2>

        {loading && <p>Fetching live market data...</p>}
        {error && <p style={{ color: 'red', fontWeight: 'bold' }}>Error: {error}</p>}

        {stockData && (
          <div>
            <h3>Asset: {stockData.symbol}</h3>
            <p><strong>Current Price:</strong> ${stockData.currentPrice}</p>
            <p><strong>Open Price:</strong> ${stockData.openPrice}</p>
            <p><strong>Daily High:</strong> ${stockData.highPrice}</p>
            <p><strong>Daily Low:</strong> ${stockData.lowPrice}</p>
            <p>
              <strong>Daily Change:</strong>{' '}
              <span style={{ color: stockData.change >= 0 ? 'green' : 'red' }}>
                {stockData.change} ({stockData.changePercent}%)
              </span>
            </p>
            <p><small>Last Updated: {new Date(stockData.timestamp).toLocaleTimeString()}</small></p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;