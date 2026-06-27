import React from 'react';

const BASELINE_STOCKS = [
    { symbol: 'AAPL', name: 'Apple Inc.', basePrice: 175.50, prevClose: 174.20 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', basePrice: 415.60, prevClose: 412.30 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', basePrice: 151.20, prevClose: 150.10 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', basePrice: 178.40, prevClose: 179.10 },
    { symbol: 'TSLA', name: 'Tesla Inc.', basePrice: 179.20, prevClose: 175.50 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', basePrice: 875.10, prevClose: 850.30 },
    { symbol: 'META', name: 'Meta Platforms Inc.', basePrice: 485.40, prevClose: 482.10 },
    { symbol: 'NFLX', name: 'Netflix Inc.', basePrice: 610.50, prevClose: 605.20 },
    { symbol: 'AMD', name: 'Advanced Micro Devices', basePrice: 160.30, prevClose: 162.10 },
    { symbol: 'DIS', name: 'Walt Disney Co.', basePrice: 112.40, prevClose: 111.10 },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', basePrice: 195.80, prevClose: 194.50 },
    { symbol: 'V', name: 'Visa Inc.', basePrice: 275.20, prevClose: 273.80 },
];

export const MarketOverview = ({ activeSymbol, setActiveSymbol, livePrices, onExecuteTrade }) => {
    
    const handleQuickTrade = (e, action, symbol, price) => {
        e.stopPropagation(); // Avoid triggering card click selection
        const qty = prompt(`How many shares of ${symbol} would you like to ${action}?`, "10");
        if (qty === null) return;
        const shares = Number(qty);
        if (isNaN(shares) || shares <= 0) {
            alert("Please enter a valid positive number of shares.");
            return;
        }
        
        const success = onExecuteTrade(action, symbol, shares, price);
        if (success) {
            alert(`Successfully executed ${action} order: ${shares} shares of ${symbol} at $${price.toFixed(2)}.`);
        }
    };

    return (
        <div className="market-overview-container">
            <h2 className="section-title">Markets Overview (Top 12 Gainers & Indices)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {BASELINE_STOCKS.map((stock) => {
                    // Resolve live price from WebSocket if available, fallback to baseline
                    const currentPrice = livePrices[stock.symbol] || stock.basePrice;
                    const change = currentPrice - stock.prevClose;
                    const changePercent = (change / stock.prevClose) * 100;
                    const isPositive = change >= 0;
                    const isActive = activeSymbol === stock.symbol;
                    
                    return (
                        <div 
                            key={stock.symbol}
                            className={`horizontal-stock-tile ${isActive ? 'active' : ''}`}
                            onClick={() => setActiveSymbol(stock.symbol)}
                        >
                            <div className="tile-info-col">
                                <div className="tile-avatar" style={{ backgroundColor: isPositive ? 'rgba(0, 217, 36, 0.08)' : 'rgba(255, 42, 42, 0.08)' }}>
                                    {stock.symbol.charAt(0)}
                                </div>
                                <div className="tile-symbol-name">
                                    <span className="tile-ticker">{stock.symbol}</span>
                                    <span className="tile-name">{stock.name}</span>
                                </div>
                            </div>
                            
                            <div className="tile-price-trend">
                                <span className="tile-price">${currentPrice.toFixed(2)}</span>
                                <span className={`tile-change-badge ${isPositive ? 'up' : 'down'}`}>
                                    {isPositive ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
                                </span>
                            </div>
                            
                            <div className="tile-actions">
                                <button 
                                    className="btn-tile-trade buy"
                                    onClick={(e) => handleQuickTrade(e, 'BUY', stock.symbol, currentPrice)}
                                >
                                    BUY
                                </button>
                                <button 
                                    className="btn-tile-trade sell"
                                    onClick={(e) => handleQuickTrade(e, 'SELL', stock.symbol, currentPrice)}
                                >
                                    SELL
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MarketOverview;
