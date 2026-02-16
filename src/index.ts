// Core client
export { WebSocketClient } from './client';

// React hooks
export { useWebSocket, useWebSocketMessage, useConnectionState } from './hooks';

// Types
export type {
  WebSocketConfig,
  ResolvedWebSocketConfig,
  ConnectionState,
  WebSocketMessage,
  WebSocketEventMap,
  WebSocketEventListener,
  MessageHandler,
} from './types';

export { DEFAULT_CONFIG } from './types';

// React hook types
export type { UseWebSocketOptions, UseWebSocketReturn } from './hooks';
