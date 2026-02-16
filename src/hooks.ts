import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { WebSocketClient } from './client';
import {
  WebSocketConfig,
  ConnectionState,
  WebSocketMessage,
  WebSocketEventMap,
} from './types';

/**
 * Options for the useWebSocket hook.
 */
export interface UseWebSocketOptions extends WebSocketConfig {
  /** Whether to connect automatically on mount. Default: true */
  autoConnect?: boolean;

  /** Callback invoked on every incoming message. */
  onMessage?: (message: WebSocketMessage) => void;

  /** Callback invoked when the connection opens. */
  onConnected?: () => void;

  /** Callback invoked when the connection closes. */
  onDisconnected?: (detail: WebSocketEventMap['disconnected']) => void;

  /** Callback invoked on connection error. */
  onError?: (error: Event) => void;

  /** Callback invoked on each reconnection attempt. */
  onReconnecting?: (detail: WebSocketEventMap['reconnecting']) => void;

  /** Callback invoked when all reconnection attempts are exhausted. */
  onReconnectFailed?: (detail: WebSocketEventMap['reconnect_failed']) => void;
}

/**
 * Return value from useWebSocket.
 */
export interface UseWebSocketReturn {
  /** Send a typed message. */
  send: <T = unknown>(message: WebSocketMessage<T>) => void;

  /** Send raw JSON data. */
  sendJSON: (data: unknown) => void;

  /** Current connection state. */
  state: ConnectionState;

  /** Manually connect. */
  connect: () => void;

  /** Manually disconnect. */
  disconnect: (code?: number, reason?: string) => void;

  /** The underlying WebSocketClient instance. */
  client: WebSocketClient | null;
}

/**
 * React hook that manages a WebSocket connection lifecycle.
 *
 * Handles connect/disconnect on mount/unmount, exposes reactive
 * connection state, and provides send helpers.
 *
 * @example
 * ```tsx
 * const { send, state } = useWebSocket({
 *   url: 'ws://localhost:8080/ws',
 *   onMessage: (msg) => console.log(msg),
 * });
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    autoConnect = true,
    onMessage,
    onConnected,
    onDisconnected,
    onError,
    onReconnecting,
    onReconnectFailed,
    ...config
  } = options;

  const [state, setState] = useState<ConnectionState>('disconnected');
  const clientRef = useRef<WebSocketClient | null>(null);

  // Keep callback refs stable to avoid re-subscribing on every render.
  const onMessageRef = useRef(onMessage);
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const onErrorRef = useRef(onError);
  const onReconnectingRef = useRef(onReconnecting);
  const onReconnectFailedRef = useRef(onReconnectFailed);

  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onConnectedRef.current = onConnected; }, [onConnected]);
  useEffect(() => { onDisconnectedRef.current = onDisconnected; }, [onDisconnected]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onReconnectingRef.current = onReconnecting; }, [onReconnecting]);
  useEffect(() => { onReconnectFailedRef.current = onReconnectFailed; }, [onReconnectFailed]);

  // Memoize the config URL so we only recreate the client when the URL changes.
  const configUrl = config.url;

  useEffect(() => {
    const client = new WebSocketClient(config);
    clientRef.current = client;

    const unsubs: Array<() => void> = [];

    unsubs.push(
      client.on('state_change', ({ to }) => {
        setState(to);
      }),
    );

    unsubs.push(
      client.on('message', (msg) => {
        onMessageRef.current?.(msg);
      }),
    );

    unsubs.push(
      client.on('connected', () => {
        onConnectedRef.current?.();
      }),
    );

    unsubs.push(
      client.on('disconnected', (detail) => {
        onDisconnectedRef.current?.(detail);
      }),
    );

    unsubs.push(
      client.on('error', (err) => {
        onErrorRef.current?.(err);
      }),
    );

    unsubs.push(
      client.on('reconnecting', (detail) => {
        onReconnectingRef.current?.(detail);
      }),
    );

    unsubs.push(
      client.on('reconnect_failed', (detail) => {
        onReconnectFailedRef.current?.(detail);
      }),
    );

    if (autoConnect) {
      client.connect();
    }

    return () => {
      unsubs.forEach((u) => u());
      client.dispose();
      clientRef.current = null;
    };
    // We intentionally only depend on URL and autoConnect to avoid
    // tearing down the connection on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configUrl, autoConnect]);

  const connect = useCallback(() => {
    clientRef.current?.connect();
  }, []);

  const disconnect = useCallback((code?: number, reason?: string) => {
    clientRef.current?.disconnect(code, reason);
  }, []);

  const send = useCallback(<T = unknown>(message: WebSocketMessage<T>) => {
    clientRef.current?.send(message);
  }, []);

  const sendJSON = useCallback((data: unknown) => {
    clientRef.current?.sendJSON(data);
  }, []);

  return useMemo(
    () => ({
      send,
      sendJSON,
      state,
      connect,
      disconnect,
      client: clientRef.current,
    }),
    [send, sendJSON, state, connect, disconnect],
  );
}

/**
 * Hook that subscribes to WebSocket messages of a specific type.
 *
 * @example
 * ```tsx
 * useWebSocketMessage(client, 'media_update', (msg) => {
 *   console.log('Media updated:', msg.payload);
 * });
 * ```
 */
export function useWebSocketMessage<T = unknown>(
  client: WebSocketClient | null,
  type: string,
  handler: (message: WebSocketMessage<T>) => void,
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!client) return;

    const unsub = client.on('message', (msg: WebSocketMessage) => {
      if (msg.type === type) {
        handlerRef.current(msg as WebSocketMessage<T>);
      }
    });

    return unsub;
  }, [client, type]);
}

/**
 * Hook that tracks the connection state of a WebSocketClient instance.
 *
 * Useful when you have a shared client and multiple components need to
 * react to state changes.
 *
 * @example
 * ```tsx
 * const state = useConnectionState(client);
 * return <Badge>{state}</Badge>;
 * ```
 */
export function useConnectionState(client: WebSocketClient | null): ConnectionState {
  const [state, setState] = useState<ConnectionState>(
    client?.getState() ?? 'disconnected',
  );

  useEffect(() => {
    if (!client) {
      setState('disconnected');
      return;
    }

    setState(client.getState());
    const unsub = client.on('state_change', ({ to }) => {
      setState(to);
    });

    return unsub;
  }, [client]);

  return state;
}
