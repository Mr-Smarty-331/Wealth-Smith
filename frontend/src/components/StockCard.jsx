import React from 'react';

const StockCard = ({ data, onClick, isActive, companyName }) => {
    if (!data) return null;

    const isPositive = data.change >= 0;

    // Get first letter of ticker to show as icon placeholder
    const firstLetter = data.symbol ? data.symbol.charAt(0) : '';

    // Resolve display company name
    const displayName = companyName || data.companyName || 'Live Market Data';

    return (
        <div 
            className={`neo-card ${isActive ? 'active' : ''}`}
            onClick={onClick}
            style={{ 
                cursor: onClick ? 'pointer' : 'default', 
                border: isActive ? '2px solid var(--accent-lime)' : '2px solid transparent',
                transition: 'all 0.2s ease'
            }}
        >
            <div className="stock-card-header">
                <div className="stock-card-icon" style={{ backgroundColor: '#e2f0d9' }}>
                    {firstLetter}
                </div>
                <div className="stock-card-names">
                    <span className="stock-ticker">{data.symbol}</span>
                    <span className="stock-name">{displayName}</span>
                </div>
            </div>

            <div className="stock-card-metrics" style={{ borderTop: 'none', marginTop: '0', paddingTop: '0' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '2rem', fontWeight: '750', color: 'var(--text-dark)' }}>
                        ${data.currentPrice.toFixed(2)}
                    </span>
                    <span className={`stock-metric-val ${isPositive ? 'up' : 'down'}`} style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                        {isPositive ? '▲' : '▼'} {Math.abs(data.change).toFixed(2)} ({Math.abs(data.changePercent).toFixed(2)}%)
                    </span>
                </div>
            </div>

            <div className="stock-card-metrics">
                <div className="stock-metric-col">
                    <span className="stock-metric-label">Open</span>
                    <span className="stock-metric-val">${data.openPrice.toFixed(2)}</span>
                </div>
                <div className="stock-metric-col">
                    <span className="stock-metric-label">Prev Close</span>
                    <span className="stock-metric-val">${data.previousClose.toFixed(2)}</span>
                </div>
            </div>

            <div className="stock-card-metrics" style={{ borderTop: 'none', paddingTop: '8px', marginTop: '0' }}>
                <div className="stock-metric-col">
                    <span className="stock-metric-label">Daily High</span>
                    <span className="stock-metric-val">${data.highPrice.toFixed(2)}</span>
                </div>
                <div className="stock-metric-col">
                    <span className="stock-metric-label">Daily Low</span>
                    <span className="stock-metric-val">${data.lowPrice.toFixed(2)}</span>
                </div>
            </div>

            {data.predictedPrice && (
                <div className="stock-card-prediction" style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '16px', backgroundColor: '#f9fafb', border: '1px dashed var(--accent-lime)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.05em' }}>
                        AI Predicted Next Close
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-dark)' }}>
                            ${data.predictedPrice.toFixed(2)}
                        </span>
                        {data.accuracyMetrics && (
                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                                Error Margin: ±{data.accuracyMetrics.mape_pct.toFixed(2)}%
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockCard;