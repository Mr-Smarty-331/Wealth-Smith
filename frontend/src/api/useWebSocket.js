import { useEffect, useRef, useState } from 'react';

export const useWebSocket = (activeSymbol, onMessageCallback) => {
    const wsRef = useRef(null);
    const [status, setStatus] = useState('connecting'); // 'connecting', 'connected', 'disconnected', 'training'
    const [trainingMessage, setTrainingMessage] = useState('');
    const reconnectDelayRef = useRef(1000); // Start reconnect delay at 1s
    const prevSymbolRef = useRef(null);

    const connect = () => {
        const url = 'ws://localhost:8000/ws/predict';
        console.log(`Connecting to WebSocket at ${url}...`);
        
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket connection established.');
            setStatus('connected');
            reconnectDelayRef.current = 1000; // Reset reconnect delay on success
            
            // Subscribe to activeSymbol
            if (activeSymbol) {
                ws.send(JSON.stringify({ action: 'subscribe', ticker: activeSymbol }));
                prevSymbolRef.current = activeSymbol;
            }
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('WebSocket received message:', data);
                
                // Handle local status updates from the backend (e.g. training triggers)
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

    // Handle active symbol change
    useEffect(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            // Unsubscribe from previous symbol
            if (prevSymbolRef.current && prevSymbolRef.current !== activeSymbol) {
                wsRef.current.send(JSON.stringify({ action: 'unsubscribe', ticker: prevSymbolRef.current }));
            }
            
            // Subscribe to new symbol
            if (activeSymbol) {
                wsRef.current.send(JSON.stringify({ action: 'subscribe', ticker: activeSymbol }));
                prevSymbolRef.current = activeSymbol;
            }
        }
    }, [activeSymbol]);

    return { status, trainingMessage };
};
export default useWebSocket;
