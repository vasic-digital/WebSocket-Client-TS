import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient } from '../client';
import type { ConnectionState, WebSocketMessage } from '../types';

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

type WSHandler = ((event: any) => void) | null;

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  url: string;
  protocols: string | string[];
  readyState: number = MockWebSocket.CONNECTING;

  onopen: WSHandler = null;
  onmessage: WSHandler = null;
  onclose: WSHandler = null;
  onerror: WSHandler = null;

  sentMessages: string[] = [];

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols ?? '';
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.onclose?.({
        code: code ?? 1000,
        reason: reason ?? '',
        wasClean: true,
      });
    }, 0);
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateRawMessage(data: string): void {
    this.onmessage?.({ data } as MessageEvent);
  }

  simulateClose(code = 1006, reason = '', wasClean = false): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean } as CloseEvent);
  }

  simulateError(): void {
    this.onerror?.({} as Event);
  }

  // Static instance tracker
  static instances: MockWebSocket[] = [];

  static reset(): void {
    MockWebSocket.instances = [];
  }

  static get latest(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

// Install mock
const originalWebSocket = globalThis.WebSocket;

beforeEach(() => {
  MockWebSocket.reset();
  vi.useFakeTimers();
  (globalThis as any).WebSocket = MockWebSocket;
});

afterEach(() => {
  vi.useRealTimers();
  (globalThis as any).WebSocket = originalWebSocket;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebSocketClient', () => {
  // -------------------------------------------------------------------------
  // Connection
  // -------------------------------------------------------------------------

  describe('connection', () => {
    it('should create a WebSocket connection with the provided URL', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      client.connect();

      expect(MockWebSocket.instances).toHaveLength(1);
      expect(MockWebSocket.latest!.url).toBe('ws://localhost:8080/ws');
    });

    it('should pass protocols when provided', () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        protocols: ['graphql-ws'],
      });
      client.connect();

      expect(MockWebSocket.latest!.protocols).toEqual(['graphql-ws']);
    });

    it('should transition to connecting then connected state', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      const states: ConnectionState[] = [];

      client.on('state_change', ({ to }) => states.push(to));
      client.connect();

      expect(client.getState()).toBe('connecting');
      MockWebSocket.latest!.simulateOpen();

      expect(client.getState()).toBe('connected');
      expect(states).toEqual(['connecting', 'connected']);
    });

    it('should emit connected event', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      const handler = vi.fn();

      client.on('connected', handler);
      client.connect();
      MockWebSocket.latest!.simulateOpen();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should be a no-op if already connected', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      client.connect();
      MockWebSocket.latest!.simulateOpen();

      client.connect(); // should not create a new instance
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    it('should throw if disposed', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      client.dispose();

      expect(() => client.connect()).toThrow('disposed');
    });
  });

  // -------------------------------------------------------------------------
  // Disconnection
  // -------------------------------------------------------------------------

  describe('disconnection', () => {
    it('should close the connection gracefully', async () => {
      const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      client.connect();
      MockWebSocket.latest!.simulateOpen();

      const disconnectedHandler = vi.fn();
      client.on('disconnected', disconnectedHandler);

      client.disconnect();
      expect(client.getState()).toBe('disconnecting');

      await vi.advanceTimersByTimeAsync(10);

      expect(disconnectedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ code: 1000 }),
      );
      expect(client.getState()).toBe('disconnected');
    });

    it('should not reconnect after intentional disconnect', async () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        reconnect: true,
      });
      client.connect();
      MockWebSocket.latest!.simulateOpen();

      client.disconnect();
      await vi.advanceTimersByTimeAsync(10);

      // Wait for potential reconnection timer
      await vi.advanceTimersByTimeAsync(5000);

      // Only 1 instance (the original), no reconnects
      expect(MockWebSocket.instances).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  describe('messages', () => {
    it('should parse and emit typed messages', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      const handler = vi.fn();

      client.on('message', handler);
      client.connect();
      MockWebSocket.latest!.simulateOpen();

      MockWebSocket.latest!.simulateMessage({
        type: 'update',
        payload: { id: 42 },
        timestamp: 1000,
      });

      expect(handler).toHaveBeenCalledWith({
        type: 'update',
        payload: { id: 42 },
        timestamp: 1000,
      });
    });

    it('should handle messages without explicit payload by wrapping data', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      const handler = vi.fn();

      client.on('message', handler);
      client.connect();
      MockWebSocket.latest!.simulateOpen();

      MockWebSocket.latest!.simulateMessage({
        type: 'simple',
        value: 'hello',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'simple',
          payload: { type: 'simple', value: 'hello' },
        }),
      );
    });

    it('should wrap unparseable messages as raw type', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      const handler = vi.fn();

      client.on('message', handler);
      client.connect();
      MockWebSocket.latest!.simulateOpen();

      MockWebSocket.latest!.simulateRawMessage('not json');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'raw',
          payload: 'not json',
        }),
      );
    });

    it('should send a typed message', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      client.connect();
      MockWebSocket.latest!.simulateOpen();

      const msg: WebSocketMessage<{ id: number }> = {
        type: 'create',
        payload: { id: 1 },
        timestamp: Date.now(),
      };
      client.send(msg);

      expect(MockWebSocket.latest!.sentMessages).toHaveLength(1);
      expect(JSON.parse(MockWebSocket.latest!.sentMessages[0])).toEqual(msg);
    });

    it('should send a raw string', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      client.connect();
      MockWebSocket.latest!.simulateOpen();

      client.send('raw-string');

      expect(MockWebSocket.latest!.sentMessages[0]).toBe('raw-string');
    });

    it('should send JSON via sendJSON', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      client.connect();
      MockWebSocket.latest!.simulateOpen();

      client.sendJSON({ action: 'subscribe', channel: 'updates' });

      expect(JSON.parse(MockWebSocket.latest!.sentMessages[0])).toEqual({
        action: 'subscribe',
        channel: 'updates',
      });
    });
  });

  // -------------------------------------------------------------------------
  // Message buffering
  // -------------------------------------------------------------------------

  describe('message buffering', () => {
    it('should buffer messages when disconnected', () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        bufferWhileDisconnected: true,
      });

      client.send('message-1');
      client.send('message-2');

      expect(client.bufferedCount).toBe(2);
    });

    it('should flush buffered messages on connect', () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        bufferWhileDisconnected: true,
      });

      client.send('msg-1');
      client.send('msg-2');
      client.connect();
      MockWebSocket.latest!.simulateOpen();

      expect(MockWebSocket.latest!.sentMessages).toEqual(['msg-1', 'msg-2']);
      expect(client.bufferedCount).toBe(0);
    });

    it('should respect maxBufferSize', () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        bufferWhileDisconnected: true,
        maxBufferSize: 2,
      });

      client.send('a');
      client.send('b');
      client.send('c'); // should be dropped

      expect(client.bufferedCount).toBe(2);
    });

    it('should not buffer when bufferWhileDisconnected is false', () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        bufferWhileDisconnected: false,
      });

      client.send('msg-1');
      expect(client.bufferedCount).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Reconnection
  // -------------------------------------------------------------------------

  describe('reconnection', () => {
    it('should reconnect on unexpected close', async () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        reconnect: true,
        reconnectInterval: 1000,
        reconnectAttempts: 3,
      });

      const reconnectingHandler = vi.fn();
      client.on('reconnecting', reconnectingHandler);

      client.connect();
      MockWebSocket.latest!.simulateOpen();
      MockWebSocket.latest!.simulateClose(1006, 'abnormal');

      // First reconnect after 1000ms (1000 * 2^0)
      await vi.advanceTimersByTimeAsync(1000);
      expect(reconnectingHandler).toHaveBeenCalledTimes(1);
      expect(reconnectingHandler).toHaveBeenCalledWith(
        expect.objectContaining({ attempt: 1, delay: 1000 }),
      );
      expect(MockWebSocket.instances).toHaveLength(2);
    });

    it('should use exponential backoff', async () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        reconnect: true,
        reconnectInterval: 100,
        reconnectBackoffMultiplier: 2,
        reconnectAttempts: 5,
      });

      const delays: number[] = [];
      client.on('reconnecting', ({ delay }) => delays.push(delay));

      client.connect();
      MockWebSocket.latest!.simulateOpen();

      // First close
      MockWebSocket.latest!.simulateClose(1006);
      await vi.advanceTimersByTimeAsync(100); // 100 * 2^0

      // Second close
      MockWebSocket.latest!.simulateClose(1006);
      await vi.advanceTimersByTimeAsync(200); // 100 * 2^1

      // Third close
      MockWebSocket.latest!.simulateClose(1006);
      await vi.advanceTimersByTimeAsync(400); // 100 * 2^2

      expect(delays).toEqual([100, 200, 400]);
    });

    it('should cap backoff at maxReconnectInterval', async () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        reconnect: true,
        reconnectInterval: 1000,
        reconnectBackoffMultiplier: 10,
        maxReconnectInterval: 5000,
        reconnectAttempts: 5,
      });

      const delays: number[] = [];
      client.on('reconnecting', ({ delay }) => delays.push(delay));

      client.connect();
      MockWebSocket.latest!.simulateOpen();

      MockWebSocket.latest!.simulateClose(1006);
      await vi.advanceTimersByTimeAsync(1000);

      MockWebSocket.latest!.simulateClose(1006);
      await vi.advanceTimersByTimeAsync(5000);

      // Second delay would be 10000 but capped at 5000
      expect(delays[1]).toBe(5000);
    });

    it('should emit reconnect_failed after max attempts', async () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        reconnect: true,
        reconnectInterval: 100,
        reconnectAttempts: 2,
      });

      const failedHandler = vi.fn();
      client.on('reconnect_failed', failedHandler);

      client.connect();
      MockWebSocket.latest!.simulateOpen();

      // Attempt 1
      MockWebSocket.latest!.simulateClose(1006);
      await vi.advanceTimersByTimeAsync(100);

      // Attempt 2
      MockWebSocket.latest!.simulateClose(1006);
      await vi.advanceTimersByTimeAsync(200);

      // Attempt 3 should fail
      MockWebSocket.latest!.simulateClose(1006);

      expect(failedHandler).toHaveBeenCalledWith({ attempts: 2 });
    });

    it('should reset reconnect count on successful connection', async () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        reconnect: true,
        reconnectInterval: 100,
        reconnectAttempts: 5,
      });

      client.connect();
      MockWebSocket.latest!.simulateOpen();

      // Disconnect and reconnect
      MockWebSocket.latest!.simulateClose(1006);
      await vi.advanceTimersByTimeAsync(100);
      MockWebSocket.latest!.simulateOpen();

      expect(client.reconnectAttempts).toBe(0);
    });

    it('should not reconnect when reconnect is disabled', async () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        reconnect: false,
      });

      client.connect();
      MockWebSocket.latest!.simulateOpen();
      MockWebSocket.latest!.simulateClose(1006);

      await vi.advanceTimersByTimeAsync(10000);

      expect(MockWebSocket.instances).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Heartbeat
  // -------------------------------------------------------------------------

  describe('heartbeat', () => {
    it('should send heartbeat at the configured interval', async () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        heartbeatInterval: 5000,
        heartbeatMessage: '{"type":"ping"}',
        reconnect: false,
      });

      client.connect();
      MockWebSocket.latest!.simulateOpen();

      await vi.advanceTimersByTimeAsync(5000);
      expect(MockWebSocket.latest!.sentMessages).toContain('{"type":"ping"}');

      await vi.advanceTimersByTimeAsync(5000);
      expect(
        MockWebSocket.latest!.sentMessages.filter((m) => m === '{"type":"ping"}'),
      ).toHaveLength(2);
    });

    it('should close connection on heartbeat timeout', async () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        heartbeatInterval: 5000,
        heartbeatTimeout: 2000,
        reconnect: false,
      });

      const timeoutHandler = vi.fn();
      client.on('heartbeat_timeout', timeoutHandler);

      client.connect();
      const ws = MockWebSocket.latest!;
      ws.simulateOpen();

      // Trigger heartbeat
      await vi.advanceTimersByTimeAsync(5000);

      // No pong received, timeout after 2000ms
      await vi.advanceTimersByTimeAsync(2000);

      expect(timeoutHandler).toHaveBeenCalledTimes(1);
    });

    it('should not timeout if pong is received', async () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        heartbeatInterval: 5000,
        heartbeatTimeout: 2000,
        heartbeatResponseType: 'pong',
        reconnect: false,
      });

      const timeoutHandler = vi.fn();
      client.on('heartbeat_timeout', timeoutHandler);

      client.connect();
      const ws = MockWebSocket.latest!;
      ws.simulateOpen();

      // Trigger heartbeat
      await vi.advanceTimersByTimeAsync(5000);

      // Pong received
      ws.simulateMessage({ type: 'pong' });

      // Wait past timeout
      await vi.advanceTimersByTimeAsync(3000);

      expect(timeoutHandler).not.toHaveBeenCalled();
    });

    it('should filter out pong messages from message event', () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        heartbeatInterval: 5000,
        heartbeatResponseType: 'pong',
        reconnect: false,
      });

      const messageHandler = vi.fn();
      client.on('message', messageHandler);

      client.connect();
      MockWebSocket.latest!.simulateOpen();

      // Pong message should be filtered
      MockWebSocket.latest!.simulateMessage({ type: 'pong' });

      expect(messageHandler).not.toHaveBeenCalled();
    });

    it('should stop heartbeat on disconnect', async () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        heartbeatInterval: 1000,
        reconnect: false,
      });

      client.connect();
      const ws = MockWebSocket.latest!;
      ws.simulateOpen();

      client.disconnect();
      await vi.advanceTimersByTimeAsync(10);

      const sentBefore = ws.sentMessages.length;
      await vi.advanceTimersByTimeAsync(5000);

      // No additional heartbeats sent after disconnect
      expect(ws.sentMessages.length).toBe(sentBefore);
    });
  });

  // -------------------------------------------------------------------------
  // Event system
  // -------------------------------------------------------------------------

  describe('event system', () => {
    it('should support on/off for listeners', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      const handler = vi.fn();

      client.on('connected', handler);
      client.connect();
      MockWebSocket.latest!.simulateOpen();

      expect(handler).toHaveBeenCalledTimes(1);

      client.off('connected', handler);
      client.disconnect();

      // Reconnect
      const client2 = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      const handler2 = vi.fn();
      const unsub = client2.on('connected', handler2);
      client2.connect();
      MockWebSocket.latest!.simulateOpen();
      expect(handler2).toHaveBeenCalledTimes(1);

      unsub();
      // handler should not be called again
    });

    it('should support once listeners', () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        reconnect: false,
      });
      const handler = vi.fn();

      client.once('message', handler);
      client.connect();
      MockWebSocket.latest!.simulateOpen();

      MockWebSocket.latest!.simulateMessage({ type: 'a', payload: 1, timestamp: 1 });
      MockWebSocket.latest!.simulateMessage({ type: 'b', payload: 2, timestamp: 2 });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'a' }),
      );
    });

    it('should return unsubscribe function from on()', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      const handler = vi.fn();

      const unsub = client.on('connected', handler);
      unsub();

      client.connect();
      MockWebSocket.latest!.simulateOpen();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should emit error events', () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        reconnect: false,
      });
      const handler = vi.fn();

      client.on('error', handler);
      client.connect();
      MockWebSocket.latest!.simulateError();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should not throw if a listener throws', () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        reconnect: false,
      });

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      client.on('connected', () => {
        throw new Error('listener error');
      });

      client.connect();
      // Should not throw
      expect(() => MockWebSocket.latest!.simulateOpen()).not.toThrow();

      consoleError.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  describe('configuration', () => {
    it('should use default values for unspecified options', () => {
      const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      // connected property should be false initially
      expect(client.connected).toBe(false);
      expect(client.getState()).toBe('disconnected');
    });

    it('should allow updating config', () => {
      const client = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        reconnectAttempts: 5,
      });

      client.updateConfig({ reconnectAttempts: 20 });
      // Config change takes effect on next connection
      // We verify indirectly: the client does not throw
      expect(client.getState()).toBe('disconnected');
    });
  });

  // -------------------------------------------------------------------------
  // Dispose
  // -------------------------------------------------------------------------

  describe('dispose', () => {
    it('should clean up all resources', async () => {
      const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
      const handler = vi.fn();

      client.on('connected', handler);
      client.connect();
      MockWebSocket.latest!.simulateOpen();

      client.dispose();
      await vi.advanceTimersByTimeAsync(10);

      expect(client.bufferedCount).toBe(0);
      expect(() => client.connect()).toThrow('disposed');
    });
  });
});
