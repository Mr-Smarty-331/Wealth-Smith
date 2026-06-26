import { useState, useEffect } from 'react';
import StockCard from './components/StockCard';
import { getStockQuote, getHistoricalData, getCompanyProfile } from './api/stockService';
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

const WealthSmithLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', color: 'var(--accent-lime)' }}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
);

const UserAvatar = () => (
  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-dark)', color: 'var(--accent-lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>FB</div>
);

const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><polyline points="15 18 9 12 15 6"></polyline></svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><polyline points="9 18 15 12 9 6"></polyline></svg>
);

// Dynamic stock profiles and quotes are fetched directly from Finnhub & Polygon APIs

const STARTING_CASH = 100000;

function App() {
  const [activeSymbol, setActiveSymbol] = useState('AAPL');
  const [stockData1, setStockData1] = useState(null);
  const [stockData2, setStockData2] = useState(null);
  const [name1, setName1] = useState('');
  const [name2, setName2] = useState('');
  const [loading, setLoading] = useState(true);
  const [historicalData, setHistoricalData] = useState([]);
  const [error, setError] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Persistent cash and holdings state with localStorage
  const [cash, setCash] = useState(() => {
    const saved = localStorage.getItem('wealth_smith_cash');
    return saved !== null ? Number(saved) : 100000;
  });
  const [holdings, setHoldings] = useState(() => {
    const saved = localStorage.getItem('wealth_smith_holdings');
    return saved !== null ? JSON.parse(saved) : [];
  });

  // Track live prices map in state
  const [livePrices, setLivePrices] = useState({});

  // Sync cash & holdings to localStorage
  useEffect(() => {
    localStorage.setItem('wealth_smith_cash', cash.toString());
  }, [cash]);

  useEffect(() => {
    localStorage.setItem('wealth_smith_holdings', JSON.stringify(holdings));
  }, [holdings]);

  // Comparison form inputs
  const [inputSymbol1, setInputSymbol1] = useState('AAPL');
  const [inputSymbol2, setInputSymbol2] = useState('MSFT');

  // Timeframe filter state
  const [activeTimeframe, setActiveTimeframe] = useState('6 Months');

  const fetchComparisonData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [q1, q2, p1, p2] = await Promise.all([
        getStockQuote(inputSymbol1),
        getStockQuote(inputSymbol2),
        getCompanyProfile(inputSymbol1),
        getCompanyProfile(inputSymbol2)
      ]);

      setStockData1(q1);
      setStockData2(q2);
      setName1(p1 ? p1.name : q1?.symbol || inputSymbol1.toUpperCase());
      setName2(p2 ? p2.name : q2?.symbol || inputSymbol2.toUpperCase());

      // Update livePrices cache
      setLivePrices(prev => {
        const next = { ...prev };
        if (q1) next[q1.symbol] = q1.currentPrice;
        if (q2) next[q2.symbol] = q2.currentPrice;
        return next;
      });
      setLoading(false);
    } catch (err) {
      if (err.response && err.response.status === 429) {
        setError("Rate limit reached (5 requests/min on free plan). Please wait a moment.");
      } else {
        setError(err.message);
      }
      setLoading(false);
    }
  };

  // Run on mount to fetch defaults (AAPL vs MSFT)
  useEffect(() => {
    fetchComparisonData();
  }, []);

  // Fetch chart data when activeSymbol or activeTimeframe changes
  useEffect(() => {
    const fetchChartData = async () => {
      try {
        setError(null);
        const history = await getHistoricalData(activeSymbol, activeTimeframe);
        setHistoricalData(history);
      } catch (err) {
        if (err.response && err.response.status === 429) {
          setError("Rate limit reached for historical D3 chart data. Please wait a minute.");
        } else {
          setError(err.message);
        }
      }
    };

    fetchChartData();
  }, [activeSymbol, activeTimeframe]);

  // Resolve whichever stock quote is currently selected/active
  const activeStockQuote = (stockData2 && activeSymbol === stockData2.symbol) ? stockData2 : stockData1;

  // Merge price dynamically into livePrices if available
  const activePriceMap = activeStockQuote ? { ...livePrices, [activeStockQuote.symbol]: activeStockQuote.currentPrice } : livePrices;

  const metrics = calculatePortfolioMetrics(holdings, activePriceMap);
  const netWorth = cash + metrics.currentValue;
  const netWorthProfitPercent = Number(((netWorth - STARTING_CASH) / STARTING_CASH * 100).toFixed(2));
  const isNetWorthUp = netWorthProfitPercent >= 0;
  const isTrendUp = activeStockQuote ? activeStockQuote.change >= 0 : true;

  // Handle stock trading: buy and sell
  const handleExecuteTrade = (action, ticker, shares, price) => {
    const symbol = ticker.toUpperCase();
    const qty = Number(shares);
    const cost = qty * price;

    if (action === 'BUY') {
      if (cost > cash) {
        alert(`Insufficient cash balance! Purchase cost ($${cost.toLocaleString()}) exceeds remaining cash ($${cash.toLocaleString()}).`);
        return false;
      }
      
      setCash(prev => prev - cost);
      setHoldings(prevHoldings => {
        const existing = prevHoldings.find(h => h.ticker === symbol);
        if (existing) {
          const totalShares = existing.shares + qty;
          const avgPrice = ((existing.shares * existing.buyPrice) + (qty * price)) / totalShares;
          return prevHoldings.map(h => 
            h.ticker === symbol 
              ? { ...h, shares: totalShares, buyPrice: Number(avgPrice.toFixed(2)) }
              : h
          );
        } else {
          return [...prevHoldings, { ticker: symbol, shares: qty, buyPrice: price }];
        }
      });
      return true;
    } else if (action === 'SELL') {
      const existing = holdings.find(h => h.ticker === symbol);
      if (!existing || existing.shares < qty) {
        alert(`You do not own enough shares of ${symbol} to sell! Owned: ${existing ? existing.shares : 0}, trying to sell: ${qty}.`);
        return false;
      }

      setCash(prev => prev + cost);
      setHoldings(prevHoldings => {
        return prevHoldings.map(h => {
          if (h.ticker === symbol) {
            return { ...h, shares: h.shares - qty };
          }
          return h;
        }).filter(h => h.shares > 0);
      });
      return true;
    }
    return false;
  };

  // Handle stock comparison
  const handleCompare = (e) => {
    e.preventDefault();
    fetchComparisonData();
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
    <div className={`app-layout ${isCollapsed ? 'collapsed' : ''}`}>
      {/* --- SIDEBAR --- */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Fixed Top Segment */}
        <div className="sidebar-top">
          <div className="logo-container">
            <div className="logo-icon" style={{ backgroundColor: 'transparent' }}><WealthSmithLogo /></div>
            {!isCollapsed && <span>Wealth Smith</span>}
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)} 
              className="sidebar-toggle-btn"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </button>
          </div>

          {/* Sidebar Portfolio Widget - Hidden when collapsed */}
          {!isCollapsed && (
            <div className="sidebar-portfolio-card">
              <div className="sidebar-portfolio-header">
                <span>Your Net Assets</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{currentDateStr}</span>
              </div>
              <div className="sidebar-portfolio-body">
                <div className="sidebar-portfolio-label">Total Value</div>
                <div className="sidebar-portfolio-value">${netWorth.toLocaleString()}</div>
                <div className="sidebar-portfolio-trend">
                  {isNetWorthUp ? '▲' : '▼'} {Math.abs(netWorthProfitPercent)}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Middle Segment */}
        <nav className="sidebar-menu">
          <a className="sidebar-menu-item active">
            <span className="flex-align-center" style={{ gap: '10px' }}>
              <SummaryIcon /> 
              {!isCollapsed && <span>Stock Summary</span>}
            </span>
          </a>
          <a className="sidebar-menu-item">
            <span className="flex-align-center" style={{ gap: '10px' }}>
              <MarketsIcon /> 
              {!isCollapsed && <span>Stock Markets</span>}
            </span>
          </a>
          <a className="sidebar-menu-item">
            <span className="flex-align-center" style={{ gap: '10px' }}>
              <TickersIcon /> 
              {!isCollapsed && <span>Tickers</span>}
            </span>
          </a>
          <a className="sidebar-menu-item">
            <span className="flex-align-center" style={{ gap: '10px' }}>
              <CompareIcon /> 
              {!isCollapsed && <span>Stock Comparison</span>}
            </span>
          </a>
          <a className="sidebar-menu-item">
            <span className="flex-align-center" style={{ gap: '10px' }}>
              <ScannersIcon /> 
              {!isCollapsed && <span>Scanners</span>}
            </span>
          </a>
          <a className="sidebar-menu-item">
            <span className="flex-align-center" style={{ gap: '10px' }}>
              <PortfolioIcon /> 
              {!isCollapsed && <span>Portfolio</span>}
            </span>
          </a>
        </nav>

        {/* Fixed Bottom Segment */}
        <div className="sidebar-footer">
          <a className="sidebar-menu-item">
            <span className="flex-align-center" style={{ width: '100%', justifyContent: isCollapsed ? 'center' : 'space-between' }}>
              <span className="flex-align-center" style={{ gap: '10px' }}>
                <InboxIcon /> 
                {!isCollapsed && <span>Inbox</span>}
              </span>
              {!isCollapsed && (
                <span style={{ background: '#c4ff00', color: '#121212', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>6</span>
              )}
            </span>
          </a>
          <a className="sidebar-menu-item">
            <span className="flex-align-center" style={{ gap: '10px' }}>
              <SettingsIcon /> 
              {!isCollapsed && <span>Settings</span>}
            </span>
          </a>
          <a className="sidebar-menu-item">
            <span className="flex-align-center" style={{ gap: '10px' }}>
              <HelpIcon /> 
              {!isCollapsed && <span>Help</span>}
            </span>
          </a>
          <div className="sidebar-menu-item" style={{ cursor: 'default' }}>
            <span className="flex-align-center" style={{ width: '100%', justifyContent: isCollapsed ? 'center' : 'space-between' }}>
              <span className="flex-align-center" style={{ gap: '10px' }}>
                <MoonIcon /> 
                {!isCollapsed && <span>Dark Mode</span>}
              </span>
              {!isCollapsed && <input type="checkbox" style={{ cursor: 'pointer' }} />}
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
              <UserAvatar />
              <span className="profile-name" style={{ marginLeft: '8px' }}>FinBro</span>
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
              {name1 && (
                <span className="resolved-stock-name">{name1}</span>
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
              {name2 && (
                <span className="resolved-stock-name">{name2}</span>
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

        {/* Stock Overview Cards Grid - Dynamic comparison side-by-side */}
        <div className="overview-grid">
          {stockData1 && (
            <StockCard 
              data={stockData1} 
              companyName={name1}
              onClick={() => setActiveSymbol(stockData1.symbol)} 
              isActive={activeSymbol === stockData1.symbol}
            />
          )}
          {stockData2 && (
            <StockCard 
              data={stockData2} 
              companyName={name2}
              onClick={() => setActiveSymbol(stockData2.symbol)} 
              isActive={activeSymbol === stockData2.symbol}
            />
          )}
        </div>

        {/* Price Comparison / Line Chart section */}
        <section className="chart-card">
          <div className="chart-card-header">
            <div className="chart-info">
              <span style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-muted)' }}>Price Comparison</span>
              {activeStockQuote && (
                <>
                  <span className="chart-price" style={{ marginLeft: '10px' }}>${activeStockQuote.currentPrice.toFixed(2)}</span>
                  <span className={`chart-change ${isTrendUp ? 'up' : 'down'}`} style={{ marginLeft: '10px' }}>
                    {isTrendUp ? '+' : ''}{activeStockQuote.changePercent}%
                  </span>
                </>
              )}
            </div>

            {/* Timeframe Filter Tabs */}
            <div className="time-tabs">
              {['1 Day', '1 Week', '1 Month', '3 Months', '6 Months', '1 Year', '2 Years'].map((tab) => (
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
            <LineChart data={historicalData} symbol={activeSymbol} />
          )}
        </section>

        {/* Portfolio Tracker Section */}
        <Portfolio 
          holdings={holdings} 
          setHoldings={setHoldings} 
          livePrices={activePriceMap} 
          cash={cash}
          setCash={setCash}
          onExecuteTrade={handleExecuteTrade}
          startingCash={STARTING_CASH}
          activeSymbol={activeSymbol}
          setActiveSymbol={setActiveSymbol}
        />
      </main>
    </div>
  );
}

export default App;