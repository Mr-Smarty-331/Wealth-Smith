import React from 'react';

const StockCard = ({ data }) => {
    if (!data) return null;

    const isPositive = data.change >= 0;

    return (
        <div className="card">
            <div className="card-header">
                <h3>{data.symbol}</h3>
                <span className="timestamp">
                    Last Updated: {new Date(data.timestamp).toLocaleTimeString()}
                </span>
            </div>

            <div className="price-section">
                <h2 className="current-price">${data.currentPrice.toFixed(2)}</h2>
                <p className={`change ${isPositive ? 'positive' : 'negative'}`}>
                    {isPositive ? '▲' : '▼'} {Math.abs(data.change)} ({Math.abs(data.changePercent)}%)
                </p>
            </div>

            <div className="metrics-grid">
                <div className="metric">
                    <span className="label">Open : </span>
                    <span className="value">${data.openPrice.toFixed(2)}</span>
                </div>
                <div className="metric">
                    <span className="label">Prev Close : </span>
                    <span className="value">${data.previousClose.toFixed(2)}</span>
                </div>
                <div className="metric">
                    <span className="label">High : </span>
                    <span className="value">${data.highPrice.toFixed(2)}</span>
                </div>
                <div className="metric">
                    <span className="label">Low : </span>
                    <span className="value">${data.lowPrice.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
};

export default StockCard;