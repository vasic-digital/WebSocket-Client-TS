# WebSocket-Client-TS API Reference

## Table of Contents

- [WebSocketClient](#websocketclient)
- [React Hooks](#react-hooks)
  - [useWebSocket](#usewebsocket)
  - [useWebSocketMessage](#usewebsocketmessage)
  - [useConnectionState](#useconnectionstate)
- [Types](#types)
  - [WebSocketConfig](#websocketconfig)
  - [ResolvedWebSocketConfig](#resolvedwebsocketconfig)
  - [ConnectionState](#connectionstate)
  - [WebSocketMessage](#websocketmessage)
  - [WebSocketEventMap](#websocketeventmap)
  - [WebSocketEventListener](#websocketeventlistener)
  - [MessageHandler](#messagehandler)
  - [UseWebSocketOptions](#usewebsocketoptions)
  - [UseWebSocketReturn](#usewebsocketreturn)
- [Constants](#constants)
  - [DEFAULT_CONFIG](#default_config)

---

## WebSocketClient

```typescript
class WebSocketClient
```

Generic WebSocket client with automatic reconnection (exponential backoff), heartbeat/ping-pong support, typed message handling, message buffering, and an event-driven API. Works in any environment that provides a global `WebSocket` constructor (browsers, Node.js 21+, Deno, Bun, or polyfilled environments).

### Constructor

```typescript
constructor(config: WebSocketConfig)
```

Creates a new `WebSocketClient` instance with the given configuration. All configuration properties except `url` have sensible defaults.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `config` | `WebSocketConfig` | Connection and behavior configuration |

### Methods

#### connect()

```typescript
connect(): void
```

Opens the WebSocket connection. If the client is already in the `connected` or `connecting` state, this is a no-op. Throws an `Error` if the client has been disposed.

---

#### disconnect()

```typescript
disconnect(code?: number, reason?: string): void
```

Gracefully closes the connection. Stops all reconnection attempts and clears heartbeat timers. The connection will not auto-reconnect after an intentional disconnect.

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `code` | `number` | `1000` | WebSocket close code |
| `reason` | `string` | `'Client disconnect'` | Human-readable close reason |

---

#### send()

```typescript
send<T = unknown>(message: WebSocketMessage<T>): void
send(raw: string): void
```

Sends a message over the WebSocket connection. Accepts either a typed `WebSocketMessage<T>` object (serialized to JSON) or a raw string.

If the socket is not connected and `bufferWhileDisconnected` is enabled, the message is queued in the internal buffer (up to `maxBufferSize`) and flushed automatically upon reconnection.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `message` | `WebSocketMessage<T>` | A typed message object with `type`, `payload`, and `timestamp` |
| `raw` | `string` | A raw string to send without transformation |

---

#### sendJSON()

```typescript
sendJSON(data: unknown): void
```

Serializes `data` to JSON via `JSON.stringify()` and sends the resulting string. This is a convenience wrapper around `send(raw)`.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `data` | `unknown` | Any JSON-serializable value |

---

#### on()

```typescript
on<K extends keyof WebSocketEventMap>(
  event: K,
  listener: WebSocketEventListener<K>
): () => void
```

Registers an event listener for the specified event. Returns an unsubscribe function that removes the listener when called.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `event` | `K` | Event name (see [WebSocketEventMap](#websocketeventmap)) |
| `listener` | `WebSocketEventListener<K>` | Callback function matching the event's payload type |

**Returns:** `() => void` -- A function that unsubscribes the listener.

---

#### off()

```typescript
off<K extends keyof WebSocketEventMap>(
  event: K,
  listener: WebSocketEventListener<K>
): void
```

Removes a previously registered event listener. The `listener` reference must be the same function that was passed to `on()`.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `event` | `K` | Event name |
| `listener` | `WebSocketEventListener<K>` | The listener function to remove |

---

#### once()

```typescript
once<K extends keyof WebSocketEventMap>(
  event: K,
  listener: WebSocketEventListener<K>
): () => void
```

Registers a one-time event listener. The listener is automatically removed after its first invocation. Returns an unsubscribe function for early removal.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `event` | `K` | Event name |
| `listener` | `WebSocketEventListener<K>` | Callback function invoked once |

**Returns:** `() => void` -- A function that unsubscribes the listener before it fires.

---

#### getState()

```typescript
getState(): ConnectionState
```

Returns the current connection state as a string.

**Returns:** `ConnectionState` -- One of `'connecting'`, `'connected'`, `'disconnecting'`, `'disconnected'`.

---

#### updateConfig()

```typescript
updateConfig(partial: Partial<WebSocketConfig>): void
```

Merges the provided partial configuration into the current configuration. Changes take effect on the next connection attempt; they do not affect the active connection.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `partial` | `Partial<WebSocketConfig>` | Configuration properties to update |

---

#### dispose()

```typescript
dispose(): void
```

Permanently disposes the client. Disconnects the active connection, clears all event listeners, and empties the message buffer. After disposal, calling `connect()` will throw an error. The client cannot be reused.

### Properties

#### connected

```typescript
get connected(): boolean
```

Read-only property. Returns `true` if the current state is `'connected'`.

---

#### bufferedCount

```typescript
get bufferedCount(): number
```

Read-only property. Returns the number of messages currently in the send buffer.

---

#### reconnectAttempts

```typescript
get reconnectAttempts(): number
```

Read-only property. Returns the number of reconnection attempts made since the last successful connection. Resets to `0` upon connection.

---

## React Hooks

### useWebSocket

```typescript
function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn
```

React hook that manages the full lifecycle of a `WebSocketClient`. Creates the client on mount, subscribes to events, and disposes it on unmount. The client is recreated when `url` or `autoConnect` changes.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `options` | `UseWebSocketOptions` | Configuration and event callbacks |

**Returns:** `UseWebSocketReturn` -- An object with send functions, reactive state, and connection controls.

**Behavior:**
- Creates a new `WebSocketClient` on mount (or when `url` changes).
- If `autoConnect` is `true` (default), calls `connect()` immediately.
- Subscribes to `state_change` and all callback events, keeping React state in sync.
- On unmount, unsubscribes all listeners and calls `dispose()` on the client.
- Callback refs are used internally so that changing callback props does not trigger reconnection.

---

### useWebSocketMessage

```typescript
function useWebSocketMessage<T = unknown>(
  client: WebSocketClient | null,
  type: string,
  handler: (message: WebSocketMessage<T>) => void
): void
```

React hook that subscribes to WebSocket messages of a specific `type`. The handler is called only when `message.type` matches the provided `type` string.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `client` | `WebSocketClient \| null` | The client instance to subscribe to |
| `type` | `string` | Message type to filter on |
| `handler` | `(message: WebSocketMessage<T>) => void` | Callback for matching messages |

**Behavior:**
- Subscribes to the `message` event on the client.
- Filters messages by `type` before calling `handler`.
- Uses a ref for the handler to avoid re-subscribing on every render.
- Automatically unsubscribes when the component unmounts or when `client` or `type` changes.

---

### useConnectionState

```typescript
function useConnectionState(client: WebSocketClient | null): ConnectionState
```

React hook that tracks the connection state of a `WebSocketClient` instance. Returns a reactive `ConnectionState` value that updates on every state transition.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `client` | `WebSocketClient \| null` | The client instance to observe |

**Returns:** `ConnectionState` -- The current state: `'connecting'`, `'connected'`, `'disconnecting'`, or `'disconnected'`.

**Behavior:**
- Reads the initial state from `client.getState()` on mount.
- Subscribes to `state_change` events and updates React state on each transition.
- Returns `'disconnected'` if `client` is `null`.

---

## Types

### WebSocketConfig

```typescript
interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  reconnectAttempts?: number;
  maxReconnectInterval?: number;
  reconnectBackoffMultiplier?: number;
  heartbeatInterval?: number;
  heartbeatMessage?: string;
  heartbeatResponseType?: string;
  heartbeatTimeout?: number;
  bufferWhileDisconnected?: boolean;
  maxBufferSize?: number;
}
```

Configuration for WebSocket client initialization. Only `url` is required; all other properties have defaults defined in `DEFAULT_CONFIG`.

| Property | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | (required) | WebSocket server URL (`ws://` or `wss://`) |
| `protocols` | `string[]` | `[]` | Sub-protocols to negotiate with the server |
| `reconnect` | `boolean` | `true` | Enable automatic reconnection on disconnection |
| `reconnectInterval` | `number` | `1000` | Base interval in ms between reconnection attempts |
| `reconnectAttempts` | `number` | `10` | Maximum number of reconnection attempts |
| `maxReconnectInterval` | `number` | `30000` | Maximum backoff delay in ms |
| `reconnectBackoffMultiplier` | `number` | `2` | Multiplier for exponential backoff |
| `heartbeatInterval` | `number` | `0` | Interval in ms for heartbeat pings (0 = disabled) |
| `heartbeatMessage` | `string` | `'{"type":"ping"}'` | String sent as the heartbeat ping |
| `heartbeatResponseType` | `string` | `'pong'` | Expected `type` field in heartbeat response |
| `heartbeatTimeout` | `number` | `5000` | Timeout in ms for heartbeat response |
| `bufferWhileDisconnected` | `boolean` | `true` | Buffer messages sent while disconnected |
| `maxBufferSize` | `number` | `100` | Maximum number of buffered messages |

---

### ResolvedWebSocketConfig

```typescript
interface ResolvedWebSocketConfig {
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
```

Fully resolved configuration with all defaults applied. All properties are required (non-optional). This is the internal type used by `WebSocketClient` after merging user config with `DEFAULT_CONFIG`.

---

### ConnectionState

```typescript
type ConnectionState = 'connecting' | 'connected' | 'disconnecting' | 'disconnected';
```

The four possible states of a WebSocket connection.

| Value | Description |
|---|---|
| `'connecting'` | `new WebSocket()` has been called; waiting for `onopen` or `onclose` |
| `'connected'` | WebSocket is open and ready for communication |
| `'disconnecting'` | `disconnect()` was called; `close()` issued but `onclose` not yet received |
| `'disconnected'` | No active connection; idle or awaiting reconnect timer |

---

### WebSocketMessage

```typescript
interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
}
```

Typed message envelope used for sending and receiving messages.

| Property | Type | Description |
|---|---|---|
| `type` | `string` | Message type identifier (e.g., `'chat'`, `'notification'`) |
| `payload` | `T` | The message data, generic over `T` |
| `timestamp` | `number` | Unix timestamp in milliseconds |

When the client receives a message it cannot parse as JSON, it wraps the raw data in a message with `type: 'raw'` and `payload` as the raw string.

---

### WebSocketEventMap

```typescript
interface WebSocketEventMap {
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
```

Defines all events emitted by `WebSocketClient` and their payload types.

| Event | Payload | Description |
|---|---|---|
| `connecting` | `void` | State changed to connecting |
| `connected` | `void` | Connection established |
| `disconnected` | `{ code: number; reason: string; wasClean: boolean }` | Connection closed |
| `error` | `Event` | WebSocket error |
| `message` | `WebSocketMessage` | Message received from server |
| `reconnecting` | `{ attempt: number; maxAttempts: number; delay: number }` | Reconnection attempt starting |
| `reconnect_failed` | `{ attempts: number }` | All reconnection attempts exhausted |
| `heartbeat_timeout` | `void` | Heartbeat pong not received within timeout |
| `state_change` | `{ from: ConnectionState; to: ConnectionState }` | Any state transition |

---

### WebSocketEventListener

```typescript
type WebSocketEventListener<K extends keyof WebSocketEventMap> =
  WebSocketEventMap[K] extends void
    ? () => void
    : (data: WebSocketEventMap[K]) => void;
```

Type-safe listener function for a specific event. Events with `void` payload produce a no-argument callback; all others receive the payload as a single argument.

---

### MessageHandler

```typescript
interface MessageHandler<T = unknown> {
  type?: string;
  handler: (message: WebSocketMessage<T>) => void;
}
```

Utility interface for defining message handlers with optional type filtering.

| Property | Type | Description |
|---|---|---|
| `type` | `string \| undefined` | If provided, the handler is only called for messages with this type |
| `handler` | `(message: WebSocketMessage<T>) => void` | The callback function |

---

### UseWebSocketOptions

```typescript
interface UseWebSocketOptions extends WebSocketConfig {
  autoConnect?: boolean;
  onMessage?: (message: WebSocketMessage) => void;
  onConnected?: () => void;
  onDisconnected?: (detail: WebSocketEventMap['disconnected']) => void;
  onError?: (error: Event) => void;
  onReconnecting?: (detail: WebSocketEventMap['reconnecting']) => void;
  onReconnectFailed?: (detail: WebSocketEventMap['reconnect_failed']) => void;
}
```

Options for the `useWebSocket` hook. Extends `WebSocketConfig` with React-specific callback properties.

| Property | Type | Default | Description |
|---|---|---|---|
| `autoConnect` | `boolean` | `true` | Whether to connect automatically on component mount |
| `onMessage` | `(message: WebSocketMessage) => void` | -- | Callback for every incoming message |
| `onConnected` | `() => void` | -- | Callback when connection opens |
| `onDisconnected` | `(detail) => void` | -- | Callback when connection closes |
| `onError` | `(error: Event) => void` | -- | Callback on WebSocket error |
| `onReconnecting` | `(detail) => void` | -- | Callback on each reconnection attempt |
| `onReconnectFailed` | `(detail) => void` | -- | Callback when all reconnection attempts fail |

All `WebSocketConfig` properties are also accepted and forwarded to the `WebSocketClient` constructor.

---

### UseWebSocketReturn

```typescript
interface UseWebSocketReturn {
  send: <T = unknown>(message: WebSocketMessage<T>) => void;
  sendJSON: (data: unknown) => void;
  state: ConnectionState;
  connect: () => void;
  disconnect: (code?: number, reason?: string) => void;
  client: WebSocketClient | null;
}
```

Return value from the `useWebSocket` hook.

| Property | Type | Description |
|---|---|---|
| `send` | `(message: WebSocketMessage<T>) => void` | Send a typed message (stable reference via `useCallback`) |
| `sendJSON` | `(data: unknown) => void` | Send arbitrary JSON data (stable reference) |
| `state` | `ConnectionState` | Reactive connection state, triggers re-render on change |
| `connect` | `() => void` | Manually open the connection (stable reference) |
| `disconnect` | `(code?, reason?) => void` | Manually close the connection (stable reference) |
| `client` | `WebSocketClient \| null` | The underlying client instance for advanced operations |

---

## Constants

### DEFAULT_CONFIG

```typescript
const DEFAULT_CONFIG: Omit<ResolvedWebSocketConfig, 'url'> = {
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
```

Default configuration values applied when properties are not explicitly set in `WebSocketConfig`. Exported for inspection and extension.
