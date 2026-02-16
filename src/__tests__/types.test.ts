import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONFIG,
  type WebSocketConfig,
  type ResolvedWebSocketConfig,
  type ConnectionState,
  type WebSocketMessage,
  type WebSocketEventMap,
  type MessageHandler,
} from '../types';

describe('types', () => {
  // -------------------------------------------------------------------------
  // DEFAULT_CONFIG
  // -------------------------------------------------------------------------

  describe('DEFAULT_CONFIG', () => {
    it('should have correct default reconnection settings', () => {
      expect(DEFAULT_CONFIG.reconnect).toBe(true);
      expect(DEFAULT_CONFIG.reconnectInterval).toBe(1000);
      expect(DEFAULT_CONFIG.reconnectAttempts).toBe(10);
      expect(DEFAULT_CONFIG.maxReconnectInterval).toBe(30000);
      expect(DEFAULT_CONFIG.reconnectBackoffMultiplier).toBe(2);
    });

    it('should have correct default heartbeat settings', () => {
      expect(DEFAULT_CONFIG.heartbeatInterval).toBe(0);
      expect(DEFAULT_CONFIG.heartbeatMessage).toBe('{"type":"ping"}');
      expect(DEFAULT_CONFIG.heartbeatResponseType).toBe('pong');
      expect(DEFAULT_CONFIG.heartbeatTimeout).toBe(5000);
    });

    it('should have correct default buffer settings', () => {
      expect(DEFAULT_CONFIG.bufferWhileDisconnected).toBe(true);
      expect(DEFAULT_CONFIG.maxBufferSize).toBe(100);
    });

    it('should have empty protocols array by default', () => {
      expect(DEFAULT_CONFIG.protocols).toEqual([]);
    });

    it('should not include url in DEFAULT_CONFIG', () => {
      // DEFAULT_CONFIG is Omit<ResolvedWebSocketConfig, 'url'>
      expect('url' in DEFAULT_CONFIG).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Type structure validation
  // -------------------------------------------------------------------------

  describe('WebSocketMessage structure', () => {
    it('should conform to expected message structure', () => {
      const message: WebSocketMessage<{ id: number }> = {
        type: 'test',
        payload: { id: 42 },
        timestamp: Date.now(),
      };

      expect(message.type).toBe('test');
      expect(message.payload).toEqual({ id: 42 });
      expect(typeof message.timestamp).toBe('number');
    });

    it('should support unknown payload type by default', () => {
      const message: WebSocketMessage = {
        type: 'generic',
        payload: 'any data',
        timestamp: 0,
      };

      expect(message.type).toBe('generic');
      expect(message.payload).toBe('any data');
    });
  });

  describe('ConnectionState', () => {
    it('should support all valid connection states', () => {
      const states: ConnectionState[] = ['connecting', 'connected', 'disconnecting', 'disconnected'];

      expect(states).toHaveLength(4);
      states.forEach((state) => {
        expect(typeof state).toBe('string');
      });
    });
  });

  describe('MessageHandler', () => {
    it('should support handler with optional type filter', () => {
      const handler: MessageHandler<string> = {
        type: 'notification',
        handler: (msg) => {
          expect(msg.type).toBe('notification');
        },
      };

      expect(handler.type).toBe('notification');
      expect(typeof handler.handler).toBe('function');
    });

    it('should support handler without type filter', () => {
      const handler: MessageHandler = {
        handler: () => {},
      };

      expect(handler.type).toBeUndefined();
      expect(typeof handler.handler).toBe('function');
    });
  });
});
