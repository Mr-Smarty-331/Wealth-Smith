import React, { useState } from 'react';
import { calculatePortfolioMetrics } from '../utils/portfolioMath';

const Portfolio = ({ livePrices }) => {
    // 1. STATE: We start the user off with one mock stock so the dashboard isn't empty
    const [holdings, setHoldings] = useState([
        { ticker: 'AAPL', shares: 10, buyPrice: 150.00 }
    ]);

    // 2. STATE: This tracks what the user is currently typing in the input boxes
    const [ticker, setTicker] = useState('');
    const [shares, setShares] = useState('');
    const [buyPrice, setBuyPrice] = useState('');

    // 3. MATH: Run our utility function every time 'holdings' or 'livePrices' changes
    const metrics = calculatePortfolioMetrics(holdings, livePrices);
    const isProfit = metrics.netProfit >= 0;

    // 4. ACTION: What happens when the user clicks "Add Asset"
    const handleAddStock = (e) => {
        e.preventDefault(); // Prevents the webpage from refreshing when the form submits

        // Make sure they filled out all fields before adding
        if (!ticker || !shares || !buyPrice) return;

        const newAsset = {
            ticker: ticker.toUpperCase(), // Standardize to uppercase (e.g., aapl -> AAPL)
            shares: Number(shares),
            buyPrice: Number(buyPrice)
        };

        // Add the new asset to our existing list of holdings
        setHoldings([...holdings, newAsset]);

        // Clear the input boxes for the next entry
        setTicker('');
        setShares('');
        setBuyPrice('');
    };

    // 5. ACTION: What happens when the user clicks "Remove"
    const handleRemoveStock = (indexToRemove) => {
        // Filter out the stock that matches the index we clicked
        setHoldings(holdings.filter((_, index) => index !== indexToRemove));
    };

    return (
        <div className="card" style={{ gridColumn: '1 / -1', marginTop: '20px' }}>
            <h2 style={{ marginBottom: '20px' }}>My Portfolio</h2>

            {/* --- METRICS SUMMARY --- */}
            <div className="metrics-grid" style={{ marginBottom: '30px', borderTop: 'none', padding: 0 }}>
                <div className="metric">
                    <span className="label">Total Invested</span>
                    <span className="value" style={{ fontSize: '1.5rem' }}>${metrics.totalInvested}</span>
                </div>
                <div className="metric">
                    <span className="label">Current Value</span>
                    <span className="value" style={{ fontSize: '1.5rem' }}>${metrics.currentValue}</span>
                </div>
                <div className="metric">
                    <span className="label">Net Profit</span>
                    <span className="value" style={{ fontSize: '1.5rem', color: isProfit ? '#00d924' : '#ff2a2a' }}>
                        {isProfit ? '+' : ''}${metrics.netProfit} ({metrics.netProfitPercent}%)
                    </span>
                </div>
            </div>

            {/* --- ADD STOCK FORM --- */}
            <form onSubmit={handleAddStock} className="portfolio-form">
                <input
                    type="text"
                    placeholder="Ticker (e.g., AAPL)"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    required
                />
                <input
                    type="number"
                    placeholder="Shares"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    required
                    min="0.1"
                    step="any"
                />
                <input
                    type="number"
                    placeholder="Avg Buy Price"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    required
                    min="1"
                    step="any"
                />
                <button type="submit" className="btn-primary">Add Asset</button>
            </form>

            {/* --- HOLDINGS TABLE --- */}
            <table className="portfolio-table">
                <thead>
                    <tr>
                        <th>Asset</th>
                        <th>Shares</th>
                        <th>Buy Price</th>
                        <th>Current Price</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {holdings.map((stock, index) => {
                        const currentPrice = livePrices[stock.ticker] || stock.buyPrice;
                        return (
                            <tr key={index}>
                                <td><strong>{stock.ticker}</strong></td>
                                <td>{stock.shares}</td>
                                <td>${stock.buyPrice.toFixed(2)}</td>
                                <td>${currentPrice.toFixed(2)}</td>
                                <td>
                                    <button onClick={() => handleRemoveStock(index)} className="btn-danger">
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    {holdings.length === 0 && (
                        <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                                No assets in portfolio. Add one above!
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default Portfolio;