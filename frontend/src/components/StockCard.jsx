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
                <div className="stock-card-icon">
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

            {(data.signal || data.prediction || data.ultimate_score !== undefined) && (
                <div className="stock-card-prediction" style={{ marginTop: '14px', padding: '14px 16px', borderRadius: '18px', backgroundColor: data.signal === 'BUY' || data.prediction === 'UP' || data.final_decision === 'UP' ? 'rgba(196, 255, 0, 0.15)' : 'rgba(255, 42, 42, 0.1)', border: data.signal === 'BUY' || data.prediction === 'UP' || data.final_decision === 'UP' ? '1.5px solid var(--accent-lime)' : '1.5px solid #ff2a2a' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                            Multimodal AI Signal
                        </span>
                        {data.accuracyMetrics?.accuracy_pct && (
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                                Accuracy: {data.accuracyMetrics.accuracy_pct}%
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: data.ts_prediction ? '10px' : '0' }}>
                        <span style={{ 
                            fontSize: '1.2rem', 
                            fontWeight: '800', 
                            color: data.signal === 'BUY' || data.prediction === 'UP' || data.final_decision === 'UP' ? '#121212' : '#ff2a2a',
                            backgroundColor: data.signal === 'BUY' || data.prediction === 'UP' || data.final_decision === 'UP' ? 'var(--accent-lime)' : '#fee2e2',
                            padding: '4px 12px',
                            borderRadius: '12px'
                        }}>
                            {data.signal === 'BUY' || data.prediction === 'UP' || data.final_decision === 'UP' ? '▲ BUY (UP)' : '▼ SELL (DOWN)'}
                        </span>
                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-dark)' }}>
                            {data.confidence ? `${data.confidence}% Conf.` : data.confidence_up ? `${data.confidence_up}% Conf.` : ''}
                        </span>
                    </div>

                    {/* Multimodal Dual-Inference Breakdown Pills */}
                    {data.ts_prediction && (
                        <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-light)' }}>
                            <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.7)', padding: '6px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-dark)', textAlign: 'center' }}>
                                📈 TS: {data.ts_prediction} ({Math.round((data.ts_confidence || 0.5) * 100)}%)
                            </div>
                            <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.7)', padding: '6px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-dark)', textAlign: 'center' }}>
                                📰 NLP: {data.nlp_sentiment || 'Neutral'}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StockCard;