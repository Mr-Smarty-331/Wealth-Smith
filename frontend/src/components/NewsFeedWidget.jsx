import React, { useState, useEffect } from 'react';
import axios from 'axios';

const NewsFeedWidget = ({ symbol }) => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchNews = async () => {
            if (!symbol) return;
            try {
                setLoading(true);
                // Fetch live company news from Finnhub API via client proxy or direct endpoint
                const response = await axios.get(`https://finnhub.io/api/v1/company-news`, {
                    params: {
                        symbol: symbol.toUpperCase(),
                        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        to: new Date().toISOString().split('T')[0],
                        token: 'd8s361hr01qlj6ffrq20d8s361hr01qlj6ffrq2g'
                    }
                });
                
                if (Array.isArray(response.data)) {
                    setNews(response.data.slice(0, 10)); // Top 10 articles
                }
                setLoading(false);
            } catch (err) {
                console.error("Error fetching news articles:", err);
                setLoading(false);
            }
        };

        fetchNews();
    }, [symbol]);

    return (
        <div className="neo-card" style={{ padding: '28px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-dark)' }}>
                    Live Financial News Feed ({symbol})
                </h3>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                    Finnhub Stream
                </span>
            </div>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600' }}>
                    Fetching live articles...
                </div>
            ) : news.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600' }}>
                    No recent news articles found for {symbol}.
                </div>
            ) : (
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '6px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '420px' }}>
                    {news.map((item, idx) => {
                        const dateStr = item.datetime ? new Date(item.datetime * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                        return (
                            <div key={item.id || idx} style={{
                                padding: '16px',
                                borderRadius: '16px',
                                backgroundColor: 'var(--bg-app)',
                                border: '1px solid var(--border-light)',
                                transition: 'all 0.2s ease'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        {item.source || 'Financial Media'}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                                        {dateStr}
                                    </span>
                                </div>
                                <a 
                                    href={item.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-dark)', textDecoration: 'none', display: 'block', marginBottom: '6px', lineHeight: '1.3' }}
                                >
                                    {item.headline}
                                </a>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {item.summary}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default NewsFeedWidget;
