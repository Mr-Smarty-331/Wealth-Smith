import React, { useState } from 'react';
import { calculatePortfolioMetrics } from '../utils/portfolioMath';

const Portfolio = ({ holdings, setHoldings, livePrices }) => {
    // These states track the input fields of the form
    const [ticker, setTicker] = useState('');
    const [shares, setShares] = useState('');
    const [buyPrice, setBuyPrice] = useState('');

    const metrics = calculatePortfolioMetrics(holdings, livePrices);
    const isProfit = metrics.netProfit >= 0;

    const handleAddStock = (e) => {
        e.preventDefault();

        if (!ticker || !shares || !buyPrice) return;

        const newAsset = {
            ticker: ticker.toUpperCase(),
            shares: Number(shares),
            buyPrice: Number(buyPrice)
        };

        setHoldings([...holdings, newAsset]);

        setTicker('');
        setShares('');
        setBuyPrice('');
    };

    const handleRemoveStock = (indexToRemove) => {
        setHoldings(holdings.filter((_, index) => index !== indexToRemove));
    };

    return (
        <div className="portfolio-card">
            <h2 className="section-title">My Portfolio</h2>

            {/* --- METRICS SUMMARY --- */}
            <div className="portfolio-metrics-row">
                <div className="portfolio-metric-box">
                    <span className="stock-metric-label">Total Invested</span>
                    <span className="portfolio-metric-num">${metrics.totalInvested.toLocaleString()}</span>
                </div>
                <div className="portfolio-metric-box">
                    <span className="stock-metric-label">Current Value</span>
                    <span className="portfolio-metric-num">${metrics.currentValue.toLocaleString()}</span>
                </div>
                <div className="portfolio-metric-box">
                    <span className="stock-metric-label">Net Profit</span>
                    <span className={`portfolio-metric-num ${isProfit ? 'text-green' : 'text-red'}`}>
                        {isProfit ? '+' : ''}${metrics.netProfit.toLocaleString()} ({metrics.netProfitPercent}%)
                    </span>
                </div>
            </div>

            {/* --- ADD STOCK FORM --- */}
            <form onSubmit={handleAddStock} className="portfolio-form-pill">
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
                <button type="submit" className="btn-primary-pill">Add Asset</button>
            </form>

            {/* --- HOLDINGS TABLE --- */}
            <div className="custom-table-container">
                <table className="custom-table">
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
                                    <td>
                                        <span className="table-asset-tag">{stock.ticker}</span>
                                    </td>
                                    <td>{stock.shares}</td>
                                    <td>${stock.buyPrice.toFixed(2)}</td>
                                    <td>${currentPrice.toFixed(2)}</td>
                                    <td>
                                        <button 
                                            onClick={() => handleRemoveStock(index)} 
                                            className="btn-danger-pill"
                                        >
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {holdings.length === 0 && (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                    No assets in portfolio. Add one above!
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Portfolio;