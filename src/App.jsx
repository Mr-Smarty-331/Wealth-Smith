import { useState, useEffect } from 'react';
import { getStockQuote } from './api/stockService';
import './index.css';

function App() {
  // 1. Set up our 'memory' (state) for the data, loading status, and errors
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 2. Set up our trigger to fetch data when the app loads
  useEffect(() => {
    const fetchTestQuote = async () => {
      try {
        // We are asking our service for Apple's live data
        const data = await getStockQuote('AAPL');
        setStockData(data); // Save the data to memory
        setLoading(false);  // Turn off the loading text
      } catch (err) {
        setError(err.message); // If it fails, save the error message
        setLoading(false);
      }
    };

    fetchTestQuote(); // Execute the function we just wrote
  }, []); // The empty brackets mean "only do this ONCE when the page loads"

  // 3. What the user actually sees on the screen
  return (
    <div className="dashboard-container">
      <h1>Financial Dashboard</h1>

      <div style={{ marginTop: '20px', padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #ccc' }}>
        <h2>API Connection Test: Apple (AAPL)</h2>

        {/* Show a loading message while waiting for the internet */}
        {loading && <p>Fetching live market data...</p>}

        {/* Show a red error message if the API key is wrong or missing */}
        {error && <p style={{ color: 'red', fontWeight: 'bold' }}>Error: {error}</p>}

        {/* If we have the data, print it out as raw JSON text */}
        {stockData && (
          <pre style={{ background: '#222', color: '#0f0', padding: '15px', borderRadius: '5px', overflowX: 'auto' }}>
            {JSON.stringify(stockData, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export default App;