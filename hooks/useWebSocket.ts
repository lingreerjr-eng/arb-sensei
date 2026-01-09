import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = 'ws://localhost:3001/ws';

export interface WebSocketMessage {
  type: string;
  data?: any;
  error?: string;
}

export interface ArbitrageOpportunityData {
  id: string;
  canonicalMarketId: string;
  combinedCost: number;
  profitPotential: number;
  opinionYesPrice: number;
  opinionNoPrice: number;
  polymarketYesPrice: number;
  polymarketNoPrice: number;
  opinionLiquidity: number;
  polymarketLiquidity: number;
  recommendedSize: number;
  detectedAt: string;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunityData[]>([]);
  const [latestOpportunity, setLatestOpportunity] = useState<ArbitrageOpportunityData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'connected':
              console.log('WebSocket connection confirmed:', message.data);
              break;
            
            case 'arbitrage_opportunity':
              if (message.data) {
                const opp: ArbitrageOpportunityData = message.data;
                setLatestOpportunity(opp);
                setOpportunities((prev) => [opp, ...prev].slice(0, 50)); // Keep last 50
                console.log('New arbitrage opportunity:', opp);
              }
              break;
            
            case 'market_update':
              console.log('Market update:', message.data);
              break;
            
            case 'execution_success':
              console.log('Trade execution successful:', message.data);
              break;
            
            case 'execution_failed':
              console.error('Trade execution failed:', message.data);
              break;
            
            case 'error':
              console.error('WebSocket error:', message.error);
              break;
            
            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error('Max reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnected(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    opportunities,
    latestOpportunity,
    reconnect: connect,
  };
}

