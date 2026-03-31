# Architecture -- WebSocket-Client-TS

## Purpose

Generic WebSocket client library for TypeScript with automatic reconnection (exponential backoff), heartbeat/ping-pong with timeout detection, typed message handling, message buffering while disconnected, an event-driven API, and React hooks for seamless integration. Zero runtime dependencies.

## Structure

```
src/
  types.ts     All shared types, interfaces, configuration defaults
  client.ts    Core WebSocketClient class (framework-agnostic)
  hooks.ts     React hooks: useWebSocket, useWebSocketMessage, useConnectionState
  index.ts     Public barrel export
```

## Key Components

- **`WebSocketClient`** -- Core class managing connection lifecycle, reconnection with exponential backoff, heartbeat ping/pong, typed message buffering, and event emission
- **`useWebSocket`** -- React hook providing send, state, and client with automatic connect/disconnect on mount/unmount
- **`useWebSocketMessage`** -- Hook for subscribing to specific message types with a callback
- **`useConnectionState`** -- Hook returning current connection state (connecting, connected, disconnected, reconnecting)
- **Events** -- connecting, connected, disconnected, error, message, reconnecting, reconnect_failed, heartbeat_timeout, state_change

## Data Flow

```
client.connect() -> WebSocket open -> "connected" event
    |
    client.send(message) -> WebSocket.send(JSON.stringify(message))
        (if disconnected and bufferWhileDisconnected) -> buffer queue
    |
    WebSocket.onmessage -> parse JSON -> "message" event -> typed listeners
    |
    heartbeat: setInterval(ping) -> wait for pong -> timeout? close + reconnect
    |
    disconnect -> reconnect loop (exponential backoff) -> "reconnecting" events
```

## Dependencies

- Zero runtime dependencies
- React as optional peer dependency (hooks are tree-shakeable)
- `vitest` for testing

## Testing Strategy

Vitest with mock WebSocket. Tests cover connection lifecycle, reconnection with backoff, heartbeat timeout detection, message buffering and flush on reconnect, event emission ordering, and React hook integration.
