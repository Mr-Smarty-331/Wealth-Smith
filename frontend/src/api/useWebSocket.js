import { useEffect, useRef, useState } from 'react';
import { WS_BASE_URL } from './config';

export const useWebSocket = (symbolsToTrack = [], onMessageCallback) => {
    const wsRef = useRef(null);
    const [status, setStatus] = useState('connecting'); // WebSocket states
    const [trainingMessage, setTrainingMessage] = useState('');
    const reconnectDelayRef = useRef(1000); // 1s initial delay
    const subscribedSymbolsRef = useRef(new Set());

    // Normalize symbols to uppercase strings
    const symbolsArray = Array.isArray(symbolsToTrack) 
        ? symbolsToTrack.filter(Boolean).map(s => String(s).toUpperCase().strip ? String(s).toUpperCase().strip() : String(s).toUpperCase().trim())
        : (symbolsToTrack ? [String(symbolsToTrack).toUpperCase().trim()] : []);

    const symbolsKey = Array.from(new Set(symbolsArray)).sort().join(',');

    const connect = () => {
        const url = `${WS_BASE_URL}/ws/predict`;
        console.log(`Connecting to WebSocket at ${url}...`);
        
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket connection established.');
            setStatus('connected');
            reconnectDelayRef.current = 1000;
            subscribedSymbolsRef.current.clear();
            
            // Subscribe to symbols
            const uniqueSymbols = Array.from(new Set(symbolsArray));
            uniqueSymbols.forEach(symbol => {
                ws.send(JSON.stringify({ action: 'subscribe', ticker: symbol }));
                subscribedSymbolsRef.current.add(symbol);
            });
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // Handle backend status updates
                if (data.type === 'status') {
                    if (data.status === 'training') {
                        setStatus('training');
                        setTrainingMessage(data.message);
                    } else if (data.status === 'success') {
                        setStatus('connected');
                        setTrainingMessage('');
                    } else if (data.status === 'error') {
                        setStatus('connected');
                        setTrainingMessage('');
                        console.error('Subscription error:', data.message);
                    }
                }
                
                // Run callback
                if (onMessageCallback) {
                    onMessageCallback(data);
                }
            } catch (err) {
                console.error('Error parsing WebSocket message:', err);
            }
        };

        ws.onclose = (event) => {
            console.log(`WebSocket connection closed. Reconnecting in ${reconnectDelayRef.current}ms...`, event);
            setStatus('disconnected');
            
            // Reconnect with backoff
            setTimeout(() => {
                reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000);
                connect();
            }, reconnectDelayRef.current);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            ws.close();
        };
    };

    // Connect on mount, clean up on unmount
    useEffect(() => {
        connect();
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    // Sync symbol changes
    useEffect(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const desiredSet = new Set(symbolsArray);
            
            // Unsubscribe dropped symbols
            subscribedSymbolsRef.current.forEach(symbol => {
                if (!desiredSet.has(symbol)) {
                    wsRef.current.send(JSON.stringify({ action: 'unsubscribe', ticker: symbol }));
                    subscribedSymbolsRef.current.delete(symbol);
                }
            });
            
            // Subscribe new symbols
            desiredSet.forEach(symbol => {
                if (!subscribedSymbolsRef.current.has(symbol)) {
                    wsRef.current.send(JSON.stringify({ action: 'subscribe', ticker: symbol }));
                    subscribedSymbolsRef.current.add(symbol);
                }
            });
        }
    }, [symbolsKey]);

    return { status, trainingMessage };
};
export default useWebSocket;
