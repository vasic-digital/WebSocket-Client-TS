/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket, useWebSocketMessage, useConnectionState } from '../hooks';
import { WebSocketClient } from '../client';
import type { ConnectionState, WebSocketMessage } from '../types';

// ---------------------------------------------------------------------------
// Mock WebSocket (same pattern as client.test.ts)
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

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateClose(code = 1006, reason = '', wasClean = false): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean } as CloseEvent);
  }

  simulateError(): void {
    this.onerror?.({} as Event);
  }

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
// useWebSocket tests
// ---------------------------------------------------------------------------

describe('useWebSocket', () => {
  it('should return initial disconnected state', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8080/ws', autoConnect: false }),
    );

    expect(result.current.state).toBe('disconnected');
    expect(result.current.client).toBeNull();
  });

  it('should auto-connect by default', () => {
    renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8080/ws' }),
    );

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.latest!.url).toBe('ws://localhost:8080/ws');
  });

  it('should not auto-connect when autoConnect is false', () => {
    renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8080/ws', autoConnect: false }),
    );

    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('should transition to connected state on open', async () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8080/ws' }),
    );

    act(() => {
      MockWebSocket.latest!.simulateOpen();
    });

    expect(result.current.state).toBe('connected');
  });

  it('should invoke onMessage callback when message arrives', () => {
    const onMessage = vi.fn();
    renderHook(() =>
      useWebSocket({
        url: 'ws://localhost:8080/ws',
        onMessage,
      }),
    );

    act(() => {
      MockWebSocket.latest!.simulateOpen();
    });

    act(() => {
      MockWebSocket.latest!.simulateMessage({
        type: 'update',
        payload: { id: 1 },
        timestamp: 1000,
      });
    });

    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'update', payload: { id: 1 } }),
    );
  });

  it('should invoke onConnected callback', () => {
    const onConnected = vi.fn();
    renderHook(() =>
      useWebSocket({
        url: 'ws://localhost:8080/ws',
        onConnected,
      }),
    );

    act(() => {
      MockWebSocket.latest!.simulateOpen();
    });

    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it('should invoke onDisconnected callback', async () => {
    const onDisconnected = vi.fn();
    renderHook(() =>
      useWebSocket({
        url: 'ws://localhost:8080/ws',
        onDisconnected,
        reconnect: false,
      }),
    );

    act(() => {
      MockWebSocket.latest!.simulateOpen();
    });

    act(() => {
      MockWebSocket.latest!.simulateClose(1000, 'Normal closure', true);
    });

    expect(onDisconnected).toHaveBeenCalledWith(
      expect.objectContaining({ code: 1000, wasClean: true }),
    );
  });

  it('should invoke onError callback', () => {
    const onError = vi.fn();
    renderHook(() =>
      useWebSocket({
        url: 'ws://localhost:8080/ws',
        onError,
      }),
    );

    act(() => {
      MockWebSocket.latest!.simulateError();
    });

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('should allow manual connect and disconnect', async () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8080/ws', autoConnect: false }),
    );

    // Manual connect
    act(() => {
      result.current.connect();
    });

    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => {
      MockWebSocket.latest!.simulateOpen();
    });

    expect(result.current.state).toBe('connected');

    // Manual disconnect
    act(() => {
      result.current.disconnect();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.state).toBe('disconnected');
  });

  it('should dispose on unmount', async () => {
    const { unmount } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8080/ws' }),
    );

    act(() => {
      MockWebSocket.latest!.simulateOpen();
    });

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Client should be disposed, no further reconnections
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('should send messages via send and sendJSON', () => {
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:8080/ws' }),
    );

    act(() => {
      MockWebSocket.latest!.simulateOpen();
    });

    const msg: WebSocketMessage = { type: 'test', payload: { v: 1 }, timestamp: Date.now() };
    act(() => {
      result.current.send(msg);
    });

    expect(MockWebSocket.latest!.sentMessages).toHaveLength(1);
    expect(JSON.parse(MockWebSocket.latest!.sentMessages[0])).toEqual(msg);

    act(() => {
      result.current.sendJSON({ action: 'subscribe' });
    });

    expect(MockWebSocket.latest!.sentMessages).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// useWebSocketMessage tests
// ---------------------------------------------------------------------------

describe('useWebSocketMessage', () => {
  it('should subscribe to messages of a specific type', () => {
    const handler = vi.fn();
    const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
    client.connect();
    MockWebSocket.latest!.simulateOpen();

    renderHook(() => useWebSocketMessage(client, 'media_update', handler));

    // Emit a matching message
    act(() => {
      MockWebSocket.latest!.simulateMessage({
        type: 'media_update',
        payload: { id: 42 },
        timestamp: 1000,
      });
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'media_update', payload: { id: 42 } }),
    );
  });

  it('should not invoke handler for non-matching message types', () => {
    const handler = vi.fn();
    const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
    client.connect();
    MockWebSocket.latest!.simulateOpen();

    renderHook(() => useWebSocketMessage(client, 'media_update', handler));

    act(() => {
      MockWebSocket.latest!.simulateMessage({
        type: 'scan_update',
        payload: { id: 1 },
        timestamp: 1000,
      });
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle null client gracefully', () => {
    const handler = vi.fn();

    // Should not throw
    renderHook(() => useWebSocketMessage(null, 'media_update', handler));

    expect(handler).not.toHaveBeenCalled();
  });

  it('should unsubscribe on unmount', () => {
    const handler = vi.fn();
    const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
    client.connect();
    MockWebSocket.latest!.simulateOpen();

    const { unmount } = renderHook(() =>
      useWebSocketMessage(client, 'media_update', handler),
    );

    unmount();

    act(() => {
      MockWebSocket.latest!.simulateMessage({
        type: 'media_update',
        payload: { id: 42 },
        timestamp: 1000,
      });
    });

    expect(handler).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useConnectionState tests
// ---------------------------------------------------------------------------

describe('useConnectionState', () => {
  it('should return disconnected for null client', () => {
    const { result } = renderHook(() => useConnectionState(null));
    expect(result.current).toBe('disconnected');
  });

  it('should return current state of client', () => {
    const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });
    client.connect();

    const { result } = renderHook(() => useConnectionState(client));
    expect(result.current).toBe('connecting');

    act(() => {
      MockWebSocket.latest!.simulateOpen();
    });

    expect(result.current).toBe('connected');
  });

  it('should update when state changes', () => {
    const client = new WebSocketClient({
      url: 'ws://localhost:8080/ws',
      reconnect: false,
    });
    client.connect();
    MockWebSocket.latest!.simulateOpen();

    const { result } = renderHook(() => useConnectionState(client));
    expect(result.current).toBe('connected');

    act(() => {
      MockWebSocket.latest!.simulateClose(1006);
    });

    expect(result.current).toBe('disconnected');
  });

  it('should unsubscribe from state changes on unmount', () => {
    const client = new WebSocketClient({
      url: 'ws://localhost:8080/ws',
      reconnect: false,
    });
    client.connect();
    MockWebSocket.latest!.simulateOpen();

    const { result, unmount } = renderHook(() => useConnectionState(client));
    expect(result.current).toBe('connected');

    unmount();

    // After unmount, state should not update
    // (we can't directly test this since result is no longer valid,
    // but we verify no errors are thrown)
    act(() => {
      MockWebSocket.latest!.simulateClose(1006);
    });
  });
});
