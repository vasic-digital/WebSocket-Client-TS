import { describe, it, expect } from 'vitest';
import {
  WebSocketClient,
  useWebSocket,
  useWebSocketMessage,
  useConnectionState,
  DEFAULT_CONFIG,
} from '../index';

describe('index exports', () => {
  it('should export WebSocketClient class', () => {
    expect(WebSocketClient).toBeDefined();
    expect(typeof WebSocketClient).toBe('function');
  });

  it('should export React hooks', () => {
    expect(useWebSocket).toBeDefined();
    expect(typeof useWebSocket).toBe('function');

    expect(useWebSocketMessage).toBeDefined();
    expect(typeof useWebSocketMessage).toBe('function');

    expect(useConnectionState).toBeDefined();
    expect(typeof useConnectionState).toBe('function');
  });

  it('should export DEFAULT_CONFIG', () => {
    expect(DEFAULT_CONFIG).toBeDefined();
    expect(DEFAULT_CONFIG.reconnect).toBe(true);
    expect(DEFAULT_CONFIG.reconnectInterval).toBe(1000);
    expect(DEFAULT_CONFIG.reconnectAttempts).toBe(10);
  });
});
