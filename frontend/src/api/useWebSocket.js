import { useEffect, useRef, useState } from 'react';
import { WS_BASE_URL } from './config';

export const useWebSocket = (symbolsToTrack = [], onMessageCallback) => {
    const wsRef = useRef(null);
    const [status, setStatus] = useState('connecting'); // 'connecting', 'connected', 'disconnected', 'training'
    const [trainingMessage, setTrainingMessage] = useState('');
    const reconnectDelayRef = useRef(1000); // Start reconnect delay at 1s
    const subscribedSymbolsRef = useRef(new Set());

    // Normalize symbols to an array of uppercase strings
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
            
            // Subscribe to all current symbols
            const uniqueSymbols = Array.from(new Set(symbolsArray));
            uniqueSymbols.forEach(symbol => {
                ws.send(JSON.stringify({ action: 'subscribe', ticker: symbol }));
                subscribedSymbolsRef.current.add(symbol);
            });
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // Handle local status updates from the backend
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
                
                // Trigger client callback
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
            
            // Exponential backoff reconnect
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

    // Initialize connection on mount and clean up on unmount
    useEffect(() => {
        connect();
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    // Synchronize dynamic symbol additions and removals
    useEffect(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const desiredSet = new Set(symbolsArray);
            
            // Unsubscribe removed symbols
            subscribedSymbolsRef.current.forEach(symbol => {
                if (!desiredSet.has(symbol)) {
                    wsRef.current.send(JSON.stringify({ action: 'unsubscribe', ticker: symbol }));
                    subscribedSymbolsRef.current.delete(symbol);
                }
            });
            
            // Subscribe newly added symbols
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
