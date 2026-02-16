/**
 * Configuration for WebSocket client initialization.
 */
export interface WebSocketConfig {
  /** WebSocket server URL (ws:// or wss://) */
  url: string;

  /** Optional sub-protocols to negotiate with the server */
  protocols?: string[];

  /** Whether to automatically reconnect on disconnection. Default: true */
  reconnect?: boolean;

  /** Base interval in ms between reconnection attempts. Default: 1000 */
  reconnectInterval?: number;

  /** Maximum number of reconnection attempts before giving up. Default: 10 */
  reconnectAttempts?: number;

  /** Maximum backoff delay in ms. Default: 30000 */
  maxReconnectInterval?: number;

  /** Backoff multiplier for exponential backoff. Default: 2 */
  reconnectBackoffMultiplier?: number;

  /** Interval in ms for sending heartbeat pings. 0 to disable. Default: 0 */
  heartbeatInterval?: number;

  /** Message to send as heartbeat ping. Default: '{"type":"ping"}' */
  heartbeatMessage?: string;

  /** Expected pong response type field. Default: 'pong' */
  heartbeatResponseType?: string;

  /** Timeout in ms to wait for heartbeat response before considering connection dead. Default: 5000 */
  heartbeatTimeout?: number;

  /** Whether to buffer messages sent while disconnected and flush on reconnect. Default: true */
  bufferWhileDisconnected?: boolean;

  /** Maximum number of messages to buffer while disconnected. Default: 100 */
  maxBufferSize?: number;
}

/**
 * Resolved configuration with all defaults applied.
 */
export interface ResolvedWebSocketConfig {
  url: string;
  protocols: string[];
  reconnect: boolean;
  reconnectInterval: number;
  reconnectAttempts: number;
  maxReconnectInterval: number;
  reconnectBackoffMultiplier: number;
  heartbeatInterval: number;
  heartbeatMessage: string;
  heartbeatResponseType: string;
  heartbeatTimeout: number;
  bufferWhileDisconnected: boolean;
  maxBufferSize: number;
}

/**
 * Connection state of the WebSocket client.
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnecting' | 'disconnected';

/**
 * Typed WebSocket message structure.
 */
export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
}

/**
 * Event types emitted by the WebSocket client.
 */
export interface WebSocketEventMap {
  connecting: void;
  connected: void;
  disconnected: { code: number; reason: string; wasClean: boolean };
  error: Event;
  message: WebSocketMessage;
  reconnecting: { attempt: number; maxAttempts: number; delay: number };
  reconnect_failed: { attempts: number };
  heartbeat_timeout: void;
  state_change: { from: ConnectionState; to: ConnectionState };
}

/**
 * Listener function type for events.
 */
export type WebSocketEventListener<K extends keyof WebSocketEventMap> =
  WebSocketEventMap[K] extends void ? () => void : (data: WebSocketEventMap[K]) => void;

/**
 * Message handler with optional type filter.
 */
export interface MessageHandler<T = unknown> {
  type?: string;
  handler: (message: WebSocketMessage<T>) => void;
}

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: Omit<ResolvedWebSocketConfig, 'url'> = {
  protocols: [],
  reconnect: true,
  reconnectInterval: 1000,
  reconnectAttempts: 10,
  maxReconnectInterval: 30000,
  reconnectBackoffMultiplier: 2,
  heartbeatInterval: 0,
  heartbeatMessage: '{"type":"ping"}',
  heartbeatResponseType: 'pong',
  heartbeatTimeout: 5000,
  bufferWhileDisconnected: true,
  maxBufferSize: 100,
};
