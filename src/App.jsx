import { useState, useEffect } from 'react';
import StockCard from './components/StockCard';
import { getStockQuote, getHistoricalData } from './api/stockService';
import LineChart from './components/LineChart';
import Portfolio from './components/Portfolio';
import { calculatePortfolioMetrics } from './utils/portfolioMath';
import './index.css';

// Clean SVG Icon Components to replace emojis
const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
);

const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
);

const SummaryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
);

const MarketsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
);

const TickersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
);

const CompareIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
);

const ScannersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>
);

const PortfolioIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
);

const InboxIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>
);

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
);

const HelpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
);

const STOCK_NAMES = {
  AAPL: 'Apple Inc.',
  MSFT: 'Microsoft Co.',
  TSLA: 'Tesla Inc.',
  GOOGL: 'Alphabet Inc.',
  AMZN: 'Amazon.com Inc.',
  NFLX: 'Netflix Inc.',
  NVDA: 'NVIDIA Corp.',
  META: 'Meta Platforms',
};

const getStockName = (symbol) => {
  return STOCK_NAMES[symbol.toUpperCase()] || '';
};

function App() {
  const [activeSymbol, setActiveSymbol] = useState('AAPL');
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historicalData, setHistoricalData] = useState([]);
  const [error, setError] = useState(null);

  // Lift holdings state up so the sidebar can reflect values dynamically
  const [holdings, setHoldings] = useState([
    { ticker: 'AAPL', shares: 10, buyPrice: 150.00 },
    { ticker: 'MSFT', shares: 5, buyPrice: 280.00 }
  ]);

  // Comparison form inputs
  const [inputSymbol1, setInputSymbol1] = useState('AAPL');
  const [inputSymbol2, setInputSymbol2] = useState('MSFT');

  // Timeframe filter state
  const [activeTimeframe, setActiveTimeframe] = useState('6 Months');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch quote and history for the active symbol
        const [quote, history] = await Promise.all([
          getStockQuote(activeSymbol),
          getHistoricalData(activeSymbol)
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
  }, [activeSymbol]);

  // Compute livePrices for math calculations
  const livePrices = stockData ? { [stockData.symbol]: stockData.currentPrice } : {};
  const metrics = calculatePortfolioMetrics(holdings, livePrices);
  const isTrendUp = metrics.netProfitPercent >= 0;

  // Handle stock comparison
  const handleCompare = (e) => {
    e.preventDefault();
    if (inputSymbol1) {
      setActiveSymbol(inputSymbol1.toUpperCase());
    }
  };

  // Get current date string for sidebar
  const currentDateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="app-layout">
      {/* --- SIDEBAR --- */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">i</div>
          <span>Investo</span>
        </div>

        {/* Sidebar Portfolio Widget */}
        <div className="sidebar-portfolio-card">
          <div className="sidebar-portfolio-header">
            <span>Your Portfolio</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{currentDateStr}</span>
          </div>
          <div className="sidebar-portfolio-body">
            <div className="sidebar-portfolio-label">Current Value</div>
            <div className="sidebar-portfolio-value">${metrics.currentValue.toLocaleString()}</div>
            <div className="sidebar-portfolio-trend">
              {isTrendUp ? '▲' : '▼'} {Math.abs(metrics.netProfitPercent)}%
            </div>
          </div>
        </div>

        {/* Sidebar Menu */}
        <nav className="sidebar-menu">
          <a className="sidebar-menu-item active">
            <span className="flex-align-center" style={{ gap: '10px' }}><SummaryIcon /> Stock Summary</span>
          </a>
          <a className="sidebar-menu-item">
            <span className="flex-align-center" style={{ gap: '10px' }}><MarketsIcon /> Stock Markets</span>
          </a>
          <a className="sidebar-menu-item">
            <span className="flex-align-center" style={{ gap: '10px' }}><TickersIcon /> Tickers</span>
          </a>
          <a className="sidebar-menu-item">
            <span className="flex-align-center" style={{ gap: '10px' }}><CompareIcon /> Stock Comparison</span>
          </a>
          <a className="sidebar-menu-item">
            <span className="flex-align-center" style={{ gap: '10px' }}><ScannersIcon /> Scanners</span>
          </a>
          <a className="sidebar-menu-item">
            <span className="flex-align-center" style={{ gap: '10px' }}><PortfolioIcon /> Portfolio</span>
          </a>
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <a className="sidebar-menu-item">
            <span className="flex-align-center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <span className="flex-align-center" style={{ gap: '10px' }}><InboxIcon /> Inbox</span>
              <span style={{ background: '#c4ff00', color: '#121212', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>6</span>
            </span>
          </a>
          <a className="sidebar-menu-item">
            <span className="flex-align-center" style={{ gap: '10px' }}><SettingsIcon /> Settings</span>
          </a>
          <a className="sidebar-menu-item">
            <span className="flex-align-center" style={{ gap: '10px' }}><HelpIcon /> Help</span>
          </a>
          <div className="sidebar-menu-item" style={{ cursor: 'default' }}>
            <span className="flex-align-center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <span className="flex-align-center" style={{ gap: '10px' }}><MoonIcon /> Dark Mode</span>
              <input type="checkbox" style={{ cursor: 'pointer' }} />
            </span>
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="main-content">
        {/* Top Header */}
        <header className="dashboard-header">
          <div className="header-search">
            <span className="header-search-icon" style={{ zIndex: 1 }}><SearchIcon /></span>
            <input type="text" placeholder="What do you want to find?" />
          </div>
          
          <div className="header-actions">
            <button className="notification-btn"><BellIcon /></button>
            <div className="profile-widget">
              <img 
                className="profile-avatar" 
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80" 
                alt="Profile Avatar" 
              />
              <span className="profile-name">Jonathan Bautista</span>
            </div>
          </div>
        </header>

        {/* Search / Compare Stocks Panel */}
        <section className="compare-container">
          <h2 className="section-title">Search Stocks to Compare</h2>
          <form onSubmit={handleCompare} className="compare-inputs-row">
            <div className="compare-input-wrapper">
              <span className="input-label-tag">1st Stock</span>
              <input 
                type="text" 
                className="stock-input-field" 
                value={inputSymbol1} 
                onChange={(e) => setInputSymbol1(e.target.value)} 
                required 
              />
              {getStockName(inputSymbol1) && (
                <span className="resolved-stock-name">{getStockName(inputSymbol1)}</span>
              )}
              <span className="input-icon-right"><SearchIcon /></span>
            </div>
            <div className="compare-input-wrapper">
              <span className="input-label-tag">2nd Stock</span>
              <input 
                type="text" 
                className="stock-input-field" 
                value={inputSymbol2} 
                onChange={(e) => setInputSymbol2(e.target.value)} 
                required 
              />
              {getStockName(inputSymbol2) && (
                <span className="resolved-stock-name">{getStockName(inputSymbol2)}</span>
              )}
              <span className="input-icon-right"><SearchIcon /></span>
            </div>
            <button type="submit" className="btn-black-pill">Compare Now</button>
          </form>
        </section>

        {/* Overview Header */}
        <h2 className="section-subtitle">Overview</h2>

        {/* Status / Error display */}
        {loading && <p style={{ color: 'var(--text-muted)' }}>Fetching live market data...</p>}
        {error && <p style={{ color: 'red', fontWeight: 'bold' }}>Error: {error}</p>}

        {/* Stock Overview Cards Grid */}
        <div className="overview-grid">
          {stockData && <StockCard data={stockData} />}
          {/* Static placeholder card to mimic side-by-side style in screenshot */}
          <div className="neo-card">
            <div className="stock-card-header">
              <div className="stock-card-icon" style={{ backgroundColor: '#e2f0d9' }}>M</div>
              <div className="stock-card-names">
                <span className="stock-ticker">MSFT</span>
                <span className="stock-name">Microsoft Corp.</span>
              </div>
            </div>
            <div className="stock-card-metrics">
              <div className="stock-metric-col">
                <span className="stock-metric-label">Revenue</span>
                <span className="stock-metric-val text-green">$394.33B ▲</span>
              </div>
              <div className="stock-metric-col">
                <span className="stock-metric-label">Market Cap</span>
                <span className="stock-metric-val">$1780.09B</span>
              </div>
            </div>
          </div>
        </div>

        {/* Price Comparison / Line Chart section */}
        <section className="chart-card">
          <div className="chart-card-header">
            <div className="chart-info">
              <span style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-muted)' }}>Price Comparison</span>
              {stockData && (
                <>
                  <span className="chart-price" style={{ marginLeft: '10px' }}>${stockData.currentPrice.toFixed(2)}</span>
                  <span className={`chart-change ${isTrendUp ? 'up' : 'down'}`} style={{ marginLeft: '10px' }}>
                    {isTrendUp ? '+' : ''}{stockData.changePercent}%
                  </span>
                </>
              )}
            </div>

            {/* Timeframe Filter Tabs */}
            <div className="time-tabs">
              {['1 Day', '1 Week', '1 Month', '3 Months', '6 Months', '1 Year', '5 Years', 'All Time'].map((tab) => (
                <button 
                  key={tab} 
                  className={`time-tab-btn ${activeTimeframe === tab ? 'active' : ''}`}
                  onClick={() => setActiveTimeframe(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* D3 Area Line Chart */}
          {historicalData.length > 0 && (
            <LineChart data={historicalData} symbol={stockData?.symbol || activeSymbol} />
          )}
        </section>

        {/* Portfolio Tracker Section */}
        <Portfolio 
          holdings={holdings} 
          setHoldings={setHoldings} 
          livePrices={livePrices} 
        />
      </main>
    </div>
  );
}

export default App;