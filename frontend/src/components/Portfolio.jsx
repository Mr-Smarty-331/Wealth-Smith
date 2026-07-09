import React, { useState, useEffect } from 'react';
import { calculatePortfolioMetrics } from '../utils/portfolioMath';
import { getStockQuote } from '../api/stockService';

const Portfolio = ({
    holdings,
    setHoldings,
    livePrices,
    cash,
    setCash,
    onExecuteTrade,
    startingCash = 100000,
    activeSymbol,
    setActiveSymbol
}) => {
    const [action, setAction] = useState('BUY'); // BUY or SELL
    const [tradeTicker, setTradeTicker] = useState(activeSymbol || '');
    const [tradeShares, setTradeShares] = useState('');
    const [price, setPrice] = useState(0);
    const [fetchingPrice, setFetchingPrice] = useState(false);
    const [priceError, setPriceError] = useState(null);

    const metrics = calculatePortfolioMetrics(holdings, livePrices);
    const netWorth = cash + metrics.currentValue;
    const netWorthProfitPercent = Number(((netWorth - startingCash) / startingCash * 100).toFixed(2));
    const isProfit = netWorth >= startingCash;

    // Sync ticker and price when activeSymbol changes
    useEffect(() => {
        if (activeSymbol) {
            setTradeTicker(activeSymbol);
            const currentPrice = livePrices[activeSymbol];
            if (currentPrice) {
                setPrice(currentPrice);
                setPriceError(null);
            } else {
                fetchTickerPrice(activeSymbol);
            }
        }
    }, [activeSymbol]);

    // Update price when livePrices change
    useEffect(() => {
        if (tradeTicker) {
            const currentPrice = livePrices[tradeTicker.toUpperCase().trim()];
            if (currentPrice) {
                setPrice(currentPrice);
                setPriceError(null);
            }
        }
    }, [livePrices, tradeTicker]);

    const fetchTickerPrice = async (symbol) => {
        if (!symbol) return;
        try {
            setFetchingPrice(true);
            setPriceError(null);
            const quote = await getStockQuote(symbol);
            if (quote && quote.currentPrice) {
                setPrice(quote.currentPrice);
            } else {
                setPriceError("Could not retrieve price");
            }
        } catch (err) {
            setPriceError("Error checking price");
        } finally {
            setFetchingPrice(false);
        }
    };

    const handleTickerBlur = () => {
        const symbol = tradeTicker.toUpperCase().trim();
        if (symbol && symbol !== activeSymbol) {
            fetchTickerPrice(symbol);
        }
    };

    const handleTradeSubmit = async (e) => {
        e.preventDefault();
        const symbol = tradeTicker.toUpperCase().trim();
        const sharesVal = Number(tradeShares);

        if (!symbol || isNaN(sharesVal) || sharesVal <= 0 || price <= 0) {
            alert("Please enter a valid ticker and shares quantity.");
            return;
        }

        const success = await onExecuteTrade(action, symbol, sharesVal, price);
        if (success) {
            setTradeShares('');
        }
    };

    const handleResetSimulation = () => {
        if (window.confirm("Are you sure you want to reset the trading simulation? This will clear all holdings and restore cash to $100,000.")) {
            setHoldings([]);
            setCash(startingCash);
            localStorage.removeItem('wealth_smith_cash');
            localStorage.removeItem('wealth_smith_holdings');
        }
    };

    const estimatedTotal = (Number(tradeShares) || 0) * price;

    // Get owned shares count for ticker
    const ownedHolding = holdings.find(h => h.ticker === tradeTicker.toUpperCase().trim());
    const ownedShares = ownedHolding ? ownedHolding.shares : 0;

    return (
        <div className="portfolio-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h2 className="section-title" style={{ marginBottom: 0 }}>My Portfolio</h2>
                <button
                    onClick={handleResetSimulation}
                    className="btn-black-pill"
                    style={{ fontSize: '0.8rem', padding: '8px 16px', opacity: 0.8 }}
                >
                    Reset Simulation
                </button>
            </div>

            {/* Metrics */}
            <div className="portfolio-metrics-row">
                <div className="portfolio-metric-box">
                    <span className="stock-metric-label">Uninvested Cash</span>
                    <span className="portfolio-metric-num">${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="portfolio-metric-box">
                    <span className="stock-metric-label">Holdings Value</span>
                    <span className="portfolio-metric-num">${metrics.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="portfolio-metric-box">
                    <span className="stock-metric-label">Net Assets</span>
                    <span className={`portfolio-metric-num ${isProfit ? 'text-green' : 'text-red'}`}>
                        ${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                <div className="portfolio-metric-box">
                    <span className="stock-metric-label">Total Profit/Loss</span>
                    <span className={`portfolio-metric-num ${isProfit ? 'text-green' : 'text-red'}`} style={{ fontSize: '1.2rem', fontWeight: '700' }}>
                        {isProfit ? '▲' : '▼'} {Math.abs(netWorthProfitPercent)}%
                    </span>
                </div>
            </div>

            {/* Trade Panel */}
            <div className="neo-card" style={{ padding: '24px', marginBottom: '30px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Simulated Trade Panel</h3>
                    <div className="segmented-control" style={{ marginBottom: 0 }}>
                        <button
                            type="button"
                            className={`segmented-btn ${action === 'BUY' ? 'active buy' : ''}`}
                            onClick={() => setAction('BUY')}
                        >
                            BUY
                        </button>
                        <button
                            type="button"
                            className={`segmented-btn ${action === 'SELL' ? 'active sell' : ''}`}
                            onClick={() => setAction('SELL')}
                        >
                            SELL
                        </button>
                    </div>
                </div>

                <form onSubmit={handleTradeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ticker Symbol</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    placeholder="e.g. TSLA"
                                    value={tradeTicker}
                                    onChange={(e) => setTradeTicker(e.target.value)}
                                    onBlur={handleTickerBlur}
                                    style={{
                                        width: '100%',
                                        padding: '12px 20px',
                                        border: '1px solid var(--border-light)',
                                        borderRadius: 'var(--radius-pill)',
                                        backgroundColor: 'var(--bg-app)',
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        color: 'var(--text-dark)'
                                    }}
                                    required
                                />
                                {fetchingPrice && (
                                    <span style={{ position: 'absolute', right: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Checking...</span>
                                )}
                            </div>
                        </div>

                        <div style={{ flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Shares Quantity</label>
                            <input
                                type="number"
                                placeholder="Shares (e.g. 10)"
                                value={tradeShares}
                                onChange={(e) => setTradeShares(e.target.value)}
                                min="0.001"
                                step="any"
                                style={{
                                    padding: '12px 20px',
                                    border: '1px solid var(--border-light)',
                                    borderRadius: 'var(--radius-pill)',
                                    backgroundColor: 'var(--bg-app)',
                                    fontSize: '0.95rem',
                                    outline: 'none',
                                    fontWeight: 600,
                                    color: 'var(--text-dark)'
                                }}
                                required
                            />
                        </div>
                    </div>

                    {/* Trade Info */}
                    <div className="trade-details-box" style={{ margin: 0 }}>
                        <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                                {tradeTicker.toUpperCase().trim() || 'Asset'} Live Price
                            </span>
                            <span className="trade-price-tag">
                                {priceError ? (
                                    <span style={{ color: '#ff2a2a', fontSize: '0.9rem' }}>{priceError}</span>
                                ) : price > 0 ? (
                                    `$${price.toFixed(2)}`
                                ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Enter ticker to verify price</span>
                                )}
                            </span>
                        </div>
                        <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                                Available to {action === 'BUY' ? 'Spend' : 'Sell'}
                            </span>
                            <span style={{ fontWeight: 700 }}>
                                {action === 'BUY'
                                    ? `$${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : `${ownedShares} shares owned`
                                }
                            </span>
                        </div>
                        <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                                Est. Total {action === 'BUY' ? 'Cost' : 'Proceeds'}
                            </span>
                            <span className="trade-total-tag">
                                ${estimatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn-primary-pill"
                        style={{
                            padding: '14px',
                            backgroundColor: action === 'BUY' ? 'var(--bg-dark)' : '#ff2a2a',
                            color: action === 'BUY' ? 'var(--accent-lime)' : 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-pill)',
                            fontWeight: 700,
                            fontSize: '1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            textAlign: 'center'
                        }}
                    >
                        Execute {action} trade for {tradeTicker.toUpperCase().trim() || 'Stock'}
                    </button>
                </form>
            </div>

            {/* Holdings */}
            <div className="custom-table-container">
                <table className="custom-table">
                    <thead>
                        <tr>
                            <th>Asset</th>
                            <th>Shares</th>
                            <th>Avg Cost</th>
                            <th>Current Price</th>
                            <th>Market Value</th>
                            <th>Total Profit/Loss</th>
                            <th>Quick Trade Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {holdings.map((stock, index) => {
                            const currentPrice = livePrices[stock.ticker] || stock.buyPrice;
                            const marketValue = stock.shares * currentPrice;
                            const costBasis = stock.shares * stock.buyPrice;
                            const profit = marketValue - costBasis;
                            const profitPercent = costBasis > 0 ? (profit / costBasis) * 100 : 0;
                            const isStockProfit = profit >= 0;

                            return (
                                <tr key={index}>
                                    <td>
                                        <span
                                            className="table-asset-tag"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => setActiveSymbol(stock.ticker)}
                                            title="Click to view chart"
                                        >
                                            {stock.ticker}
                                        </span>
                                    </td>
                                    <td>{stock.shares.toLocaleString()}</td>
                                    <td>${stock.buyPrice.toFixed(2)}</td>
                                    <td>${currentPrice.toFixed(2)}</td>
                                    <td>${marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className={isStockProfit ? 'text-green' : 'text-red'} style={{ fontWeight: 600 }}>
                                        {isStockProfit ? '+' : ''}${profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({profitPercent.toFixed(2)}%)
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => {
                                                    setActiveSymbol(stock.ticker);
                                                    setAction('BUY');
                                                }}
                                                className="btn-primary-pill"
                                                style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700 }}
                                            >
                                                Buy More
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setActiveSymbol(stock.ticker);
                                                    setAction('SELL');
                                                }}
                                                className="btn-danger-pill"
                                                style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700 }}
                                            >
                                                Sell
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {holdings.length === 0 && (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                    No assets in portfolio. Search a stock above or input a ticker to execute a trade!
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