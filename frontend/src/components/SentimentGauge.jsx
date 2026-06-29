import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api/config';

const SentimentGauge = ({ data: propData, symbol }) => {
    const [fetchedData, setFetchedData] = useState(null);

    useEffect(() => {
        const fetchSentiment = async () => {
            if (!symbol) return;
            try {
                const res = await axios.get(`${API_BASE_URL}/api/sentiment`, {
                    params: { symbol: symbol.toUpperCase() }
                });
                if (res.data) {
                    setFetchedData(res.data);
                }
            } catch (err) {
                console.error("Error fetching live sentiment:", err);
            }
        };
        fetchSentiment();
    }, [symbol]);

    const data = propData || fetchedData;

    const sentiment = data?.overall_sentiment || 'Neutral';
    const bullishRatio = data?.bullish_ratio !== undefined ? data.bullish_ratio : 0.33;
    const bearishRatio = data?.bearish_ratio !== undefined ? data.bearish_ratio : 0.33;
    const neutralRatio = data?.neutral_ratio !== undefined ? data.neutral_ratio : 0.34;
    const sentimentScore = data?.sentiment_score !== undefined ? data.sentiment_score : 0.0;
    const totalArticles = data?.total_articles || 0;

    // Convert sentiment score (-1.0 to +1.0) to needle angle (-90 to +90 degrees)
    const angle = Math.max(-90, Math.min(90, sentimentScore * 90));

    // Determine badge theme
    let badgeBg = '#f1f3f5';
    let badgeColor = '#121212';
    if (sentiment === 'Bullish') {
        badgeBg = 'var(--accent-lime)';
        badgeColor = '#121212';
    } else if (sentiment === 'Bearish') {
        badgeBg = '#fee2e2';
        badgeColor = '#b91c1c';
    }

    return (
        <div className="neo-card" style={{ padding: '28px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-dark)' }}>
                        NLP News Sentiment
                    </h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Real-time AI text processing ({symbol})
                    </span>
                </div>
                <span style={{
                    padding: '6px 16px',
                    borderRadius: '20px',
                    fontWeight: '800',
                    fontSize: '0.85rem',
                    backgroundColor: badgeBg,
                    color: badgeColor,
                    letterSpacing: '0.05em'
                }}>
                    {sentiment.toUpperCase()}
                </span>
            </div>

            {/* SVG Speedometer Meter */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '280px', margin: '0 auto 10px auto' }}>
                <svg viewBox="0 0 200 110" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                    {/* Background Gauge Arc */}
                    <path
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="18"
                        strokeLinecap="round"
                    />
                    {/* Bearish Arc Segment */}
                    <path
                        d="M 20 100 A 80 80 0 0 1 73 43"
                        fill="none"
                        stroke="#ff2a2a"
                        strokeWidth="18"
                        strokeLinecap="round"
                    />
                    {/* Neutral Arc Segment */}
                    <path
                        d="M 73 43 A 80 80 0 0 1 127 43"
                        fill="none"
                        stroke="#eab308"
                        strokeWidth="18"
                    />
                    {/* Bullish Arc Segment */}
                    <path
                        d="M 127 43 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke="#00d924"
                        strokeWidth="18"
                        strokeLinecap="round"
                    />

                    {/* Needle Indicator */}
                    <g transform="translate(100, 100)">
                        <g transform={`rotate(${angle})`}>
                            <line x1="0" y1="0" x2="0" y2="-70" stroke="#121212" strokeWidth="4" strokeLinecap="round" />
                            <polygon points="-6,0 0,-80 6,0" fill="#121212" />
                        </g>
                        <circle cx="0" cy="0" r="10" fill="#121212" />
                        <circle cx="0" cy="0" r="4" fill="#ffffff" />
                    </g>
                </svg>

                <div style={{ textAlign: 'center', marginTop: '-15px' }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-dark)' }}>
                        {((sentimentScore || 0) > 0 ? '+' : '') + (sentimentScore || 0).toFixed(2)}
                    </span>
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Sentiment Index (-1.0 to +1.0)
                    </div>
                </div>
            </div>

            {/* Sentiment Ratios Breakdown Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '15px' }}>
                <div style={{ backgroundColor: 'rgba(0, 217, 36, 0.08)', padding: '12px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(0, 217, 36, 0.2)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#00b01d', display: 'block' }}>BULLISH</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-dark)' }}>{((bullishRatio || 0) * 100).toFixed(0)}%</span>
                </div>
                <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.08)', padding: '12px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#ca8a04', display: 'block' }}>NEUTRAL</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-dark)' }}>{((neutralRatio || 0) * 100).toFixed(0)}%</span>
                </div>
                <div style={{ backgroundColor: 'rgba(255, 42, 42, 0.08)', padding: '12px', borderRadius: '16px', textAlign: 'center', border: '1px solid rgba(255, 42, 42, 0.2)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#dc2626', display: 'block' }}>BEARISH</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-dark)' }}>{((bearishRatio || 0) * 100).toFixed(0)}%</span>
                </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                Analyzed {totalArticles} recent Finnhub articles
            </div>
        </div>
    );
};

export default SentimentGauge;
