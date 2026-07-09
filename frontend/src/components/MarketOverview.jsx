import React, { useState, useEffect } from 'react';
import { getStockQuote, getCompanyProfile } from '../api/stockService';

const TOP_MARKET_TICKERS = [
    { symbol: 'AAPL', defaultName: 'Apple Inc.' },
    { symbol: 'MSFT', defaultName: 'Microsoft Corp.' },
    { symbol: 'GOOGL', defaultName: 'Alphabet Inc.' },
    { symbol: 'AMZN', defaultName: 'Amazon.com Inc.' },
    { symbol: 'TSLA', defaultName: 'Tesla Inc.' },
    { symbol: 'NVDA', defaultName: 'NVIDIA Corp.' },
    { symbol: 'META', defaultName: 'Meta Platforms Inc.' },
    { symbol: 'NFLX', defaultName: 'Netflix Inc.' },
    { symbol: 'AMD', defaultName: 'Advanced Micro Devices' },
    { symbol: 'DIS', defaultName: 'Walt Disney Co.' },
    { symbol: 'JPM', defaultName: 'JPMorgan Chase & Co.' },
    { symbol: 'V', defaultName: 'Visa Inc.' },
];

export const MarketOverview = ({ activeSymbol, setActiveSymbol, livePrices, onExecuteTrade }) => {
    const [marketQuotes, setMarketQuotes] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllMarketData = async () => {
            try {
                setLoading(true);
                const quotePromises = TOP_MARKET_TICKERS.map(async (item) => {
                    try {
                        const quote = await getStockQuote(item.symbol);
                        return {
                            symbol: item.symbol,
                            name: item.defaultName,
                            currentPrice: quote?.currentPrice || 0,
                            previousClose: quote?.previousClose || 0,
                            change: quote?.change || 0,
                            changePercent: quote?.percentChange || quote?.changePercent || 0
                        };
                    } catch (err) {
                        return {
                            symbol: item.symbol,
                            name: item.defaultName,
                            currentPrice: 0,
                            previousClose: 0,
                            change: 0,
                            changePercent: 0
                        };
                    }
                });

                const results = await Promise.all(quotePromises);
                const quotesMap = {};
                results.forEach(res => {
                    quotesMap[res.symbol] = res;
                });
                setMarketQuotes(quotesMap);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching market overview live quotes:", err);
                setLoading(false);
            }
        };

        fetchAllMarketData();
    }, []);

    const handleQuickTrade = (e, action, symbol, price) => {
        e.stopPropagation(); // Stop click bubble
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
            {loading && Object.keys(marketQuotes).length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600' }}>
                    Fetching live market quotes...
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {TOP_MARKET_TICKERS.map((item) => {
                        const fetchedData = marketQuotes[item.symbol] || {};
                        const companyName = fetchedData.name || item.defaultName;
                        const prevClose = fetchedData.previousClose || 100;
                        
                        // Merge live socket prices
                        const currentPrice = livePrices[item.symbol] || fetchedData.currentPrice || prevClose;
                        const change = currentPrice - prevClose;
                        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
                        const isPositive = change >= 0;
                        const isActive = activeSymbol === item.symbol;
                        
                        return (
                            <div 
                                key={item.symbol}
                                className={`horizontal-stock-tile ${isActive ? 'active' : ''}`}
                                onClick={() => setActiveSymbol(item.symbol)}
                            >
                                <div className="tile-info-col">
                                    <div className="tile-avatar" style={{ backgroundColor: isPositive ? 'rgba(0, 217, 36, 0.08)' : 'rgba(255, 42, 42, 0.08)' }}>
                                        {item.symbol.charAt(0)}
                                    </div>
                                    <div className="tile-symbol-name">
                                        <span className="tile-ticker">{item.symbol}</span>
                                        <span className="tile-name">{companyName}</span>
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
                                        onClick={(e) => handleQuickTrade(e, 'BUY', item.symbol, currentPrice)}
                                    >
                                        BUY
                                    </button>
                                    <button 
                                        className="btn-tile-trade sell"
                                        onClick={(e) => handleQuickTrade(e, 'SELL', item.symbol, currentPrice)}
                                    >
                                        SELL
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MarketOverview;
