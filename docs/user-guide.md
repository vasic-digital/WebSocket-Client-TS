# WebSocket-Client-TS User Guide

## Installation

```bash
npm install websocket-client-ts
```

If you plan to use the React hooks, ensure React 18+ is installed as a peer dependency:

```bash
npm install react react-dom
```

## Quick Start

### Basic Client Usage (No Framework)

```typescript
import { WebSocketClient } from 'websocket-client-ts';

const client = new WebSocketClient({
  url: 'ws://localhost:8080/ws',
});

client.on('connected', () => {
  console.log('Connected to server');
});

client.on('message', (msg) => {
  console.log('Received:', msg.type, msg.payload);
});

client.on('disconnected', ({ code, reason }) => {
  console.log('Disconnected:', code, reason);
});

client.connect();
```

### Basic React Usage

```tsx
import { useWebSocket } from 'websocket-client-ts';

function ChatComponent() {
  const { send, state } = useWebSocket({
    url: 'ws://localhost:8080/ws',
    onMessage: (msg) => {
      console.log('Received:', msg);
    },
  });

  return (
    <div>
      <p>Status: {state}</p>
      <button
        onClick={() =>
          send({ type: 'chat', payload: 'Hello!', timestamp: Date.now() })
        }
      >
        Send Message
      </button>
    </div>
  );
}
```

## Configuration

All configuration options are optional except `url`.

```typescript
const client = new WebSocketClient({
  // Required
  url: 'wss://api.example.com/ws',

  // Sub-protocols (optional)
  protocols: ['v1.chat'],

  // Reconnection settings
  reconnect: true,                  // Enable auto-reconnect (default: true)
  reconnectInterval: 1000,          // Base delay in ms (default: 1000)
  reconnectAttempts: 10,            // Max attempts before giving up (default: 10)
  maxReconnectInterval: 30000,      // Maximum backoff delay in ms (default: 30000)
  reconnectBackoffMultiplier: 2,    // Exponential backoff multiplier (default: 2)

  // Heartbeat settings
  heartbeatInterval: 30000,         // Ping interval in ms, 0 to disable (default: 0)
  heartbeatMessage: '{"type":"ping"}', // Ping message string (default: '{"type":"ping"}')
  heartbeatResponseType: 'pong',    // Expected pong type field (default: 'pong')
  heartbeatTimeout: 5000,           // Pong wait timeout in ms (default: 5000)

  // Message buffering
  bufferWhileDisconnected: true,    // Queue messages while offline (default: true)
  maxBufferSize: 100,               // Max buffered messages (default: 100)
});
```

## Sending Messages

### Typed Messages

The library uses a `WebSocketMessage<T>` structure with `type`, `payload`, and `timestamp` fields:

```typescript
// Send a typed message
client.send({
  type: 'user_action',
  payload: { action: 'click', target: 'button-1' },
  timestamp: Date.now(),
});

// The generic parameter provides type safety for the payload
client.send<{ action: string; target: string }>({
  type: 'user_action',
  payload: { action: 'click', target: 'button-1' },
  timestamp: Date.now(),
});
```

### Raw Strings

```typescript
// Send a raw string (not wrapped in a message envelope)
client.send('plain text message');
```

### Arbitrary JSON

```typescript
// Send any serializable object as JSON
client.sendJSON({ event: 'ping', data: [1, 2, 3] });
```

## Listening to Events

### Available Events

| Event | Payload | Description |
|---|---|---|
| `connected` | `void` | WebSocket connection established |
| `disconnected` | `{ code, reason, wasClean }` | Connection closed |
| `message` | `WebSocketMessage` | Message received from server |
| `error` | `Event` | WebSocket error occurred |
| `reconnecting` | `{ attempt, maxAttempts, delay }` | Reconnection attempt starting |
| `reconnect_failed` | `{ attempts }` | All reconnection attempts exhausted |
| `heartbeat_timeout` | `void` | Server did not respond to heartbeat in time |
| `state_change` | `{ from, to }` | Connection state transition |

### Subscribing and Unsubscribing

```typescript
// Subscribe -- returns an unsubscribe function
const unsubscribe = client.on('message', (msg) => {
  console.log(msg.type, msg.payload);
});

// Later, unsubscribe
unsubscribe();

// Or use off() with the same listener reference
const listener = (msg) => console.log(msg);
client.on('message', listener);
client.off('message', listener);
```

### One-Time Listeners

```typescript
// Listen for the next connection only
client.once('connected', () => {
  console.log('First connection established');
});
```

### Monitoring Reconnection

```typescript
client.on('reconnecting', ({ attempt, maxAttempts, delay }) => {
  console.log(`Reconnecting: attempt ${attempt}/${maxAttempts} in ${delay}ms`);
});

client.on('reconnect_failed', ({ attempts }) => {
  console.error(`Failed to reconnect after ${attempts} attempts`);
});
```

### Tracking State Changes

```typescript
client.on('state_change', ({ from, to }) => {
  console.log(`State: ${from} -> ${to}`);
  // e.g., "disconnected -> connecting"
  // e.g., "connecting -> connected"
});
```

## Connection Lifecycle

### Manual Connect / Disconnect

```typescript
const client = new WebSocketClient({ url: 'ws://localhost:8080/ws' });

// Connect when ready
client.connect();

// Disconnect gracefully
client.disconnect();

// Disconnect with a custom close code and reason
client.disconnect(4001, 'User logged out');
```

### Checking Connection State

```typescript
// Get the current state as a string
const state = client.getState();
// Returns: 'connecting' | 'connected' | 'disconnecting' | 'disconnected'

// Boolean shorthand
if (client.connected) {
  client.send({ type: 'ping', payload: null, timestamp: Date.now() });
}
```

### Inspecting Buffers and Reconnect Count

```typescript
console.log('Buffered messages:', client.bufferedCount);
console.log('Reconnect attempts so far:', client.reconnectAttempts);
```

### Updating Configuration at Runtime

```typescript
// Change reconnection settings without creating a new client
client.updateConfig({
  reconnectInterval: 5000,
  reconnectAttempts: 20,
});
```

### Disposing the Client

When the client is no longer needed, call `dispose()` to release all resources:

```typescript
client.dispose();
// After disposal, calling connect() will throw an error
```

## React Hooks

### useWebSocket

The primary hook for managing a WebSocket connection within a React component. It handles the full lifecycle: creation, connection, event subscription, and cleanup on unmount.

```tsx
import { useWebSocket } from 'websocket-client-ts';

function LiveDashboard() {
  const { send, sendJSON, state, connect, disconnect, client } = useWebSocket({
    url: 'ws://localhost:8080/ws',
    autoConnect: true, // default: true

    // Event callbacks
    onMessage: (msg) => {
      console.log('Message:', msg.type, msg.payload);
    },
    onConnected: () => {
      console.log('Connected');
    },
    onDisconnected: ({ code, reason }) => {
      console.log('Disconnected:', code, reason);
    },
    onError: (error) => {
      console.error('Error:', error);
    },
    onReconnecting: ({ attempt, maxAttempts, delay }) => {
      console.log(`Reconnecting ${attempt}/${maxAttempts} in ${delay}ms`);
    },
    onReconnectFailed: ({ attempts }) => {
      console.error(`Failed after ${attempts} attempts`);
    },

    // All WebSocketConfig options are also accepted
    reconnect: true,
    reconnectAttempts: 5,
    heartbeatInterval: 30000,
  });

  return (
    <div>
      <p>Connection: {state}</p>
      <button onClick={connect} disabled={state === 'connected'}>
        Connect
      </button>
      <button onClick={() => disconnect()} disabled={state === 'disconnected'}>
        Disconnect
      </button>
      <button
        onClick={() =>
          send({
            type: 'subscribe',
            payload: { channel: 'metrics' },
            timestamp: Date.now(),
          })
        }
        disabled={state !== 'connected'}
      >
        Subscribe to Metrics
      </button>
    </div>
  );
}
```

#### Return Value

| Property | Type | Description |
|---|---|---|
| `send` | `(message: WebSocketMessage<T>) => void` | Send a typed message |
| `sendJSON` | `(data: unknown) => void` | Send arbitrary data as JSON |
| `state` | `ConnectionState` | Reactive connection state |
| `connect` | `() => void` | Manually open the connection |
| `disconnect` | `(code?, reason?) => void` | Manually close the connection |
| `client` | `WebSocketClient \| null` | The underlying client instance |

### useWebSocketMessage

Subscribes to messages of a specific type. Useful when multiple components need to react to different message types from the same client.

```tsx
import { useWebSocket, useWebSocketMessage } from 'websocket-client-ts';

interface MediaUpdate {
  mediaId: string;
  status: 'added' | 'removed' | 'updated';
  title: string;
}

function MediaFeed() {
  const { client, state } = useWebSocket({
    url: 'ws://localhost:8080/ws',
  });

  // Subscribe only to 'media_update' messages
  useWebSocketMessage<MediaUpdate>(client, 'media_update', (msg) => {
    console.log(`Media ${msg.payload.status}: ${msg.payload.title}`);
  });

  // Subscribe to 'notification' messages separately
  useWebSocketMessage(client, 'notification', (msg) => {
    showNotification(msg.payload);
  });

  return <div>Media feed - {state}</div>;
}
```

#### Parameters

| Parameter | Type | Description |
|---|---|---|
| `client` | `WebSocketClient \| null` | The client instance (from `useWebSocket`) |
| `type` | `string` | The message type to filter on |
| `handler` | `(message: WebSocketMessage<T>) => void` | Callback for matching messages |

### useConnectionState

Tracks the connection state of a `WebSocketClient` instance. Useful when a shared client is used across multiple components and each needs to react to state changes independently.

```tsx
import { useConnectionState } from 'websocket-client-ts';

function ConnectionBadge({ client }: { client: WebSocketClient | null }) {
  const state = useConnectionState(client);

  const colors = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500',
    disconnecting: 'bg-orange-500',
    disconnected: 'bg-red-500',
  };

  return (
    <span className={`px-2 py-1 rounded text-white text-sm ${colors[state]}`}>
      {state}
    </span>
  );
}
```

#### Parameters

| Parameter | Type | Description |
|---|---|---|
| `client` | `WebSocketClient \| null` | The client instance to observe |

#### Return Value

Returns a `ConnectionState` string: `'connecting'`, `'connected'`, `'disconnecting'`, or `'disconnected'`.

## Common Patterns

### Shared Client Across Components

Create the client at a higher level and pass it down via props or context:

```tsx
import { useWebSocket, useWebSocketMessage, useConnectionState } from 'websocket-client-ts';

function App() {
  const { client, state } = useWebSocket({
    url: 'ws://localhost:8080/ws',
  });

  return (
    <div>
      <StatusBar client={client} />
      <ChatPanel client={client} />
      <NotificationPanel client={client} />
    </div>
  );
}

function StatusBar({ client }: { client: WebSocketClient | null }) {
  const state = useConnectionState(client);
  return <header>Status: {state}</header>;
}

function ChatPanel({ client }: { client: WebSocketClient | null }) {
  useWebSocketMessage(client, 'chat', (msg) => {
    // Handle chat messages
  });
  return <div>Chat</div>;
}

function NotificationPanel({ client }: { client: WebSocketClient | null }) {
  useWebSocketMessage(client, 'notification', (msg) => {
    // Handle notifications
  });
  return <div>Notifications</div>;
}
```

### Deferred Connection

Connect only after user authentication:

```tsx
function AuthenticatedApp({ token }: { token: string }) {
  const { connect, state, send } = useWebSocket({
    url: `ws://localhost:8080/ws?token=${token}`,
    autoConnect: false, // Do not connect on mount
  });

  useEffect(() => {
    if (token) {
      connect();
    }
  }, [token, connect]);

  return <div>State: {state}</div>;
}
```

### Enabling Heartbeat

Keep the connection alive with periodic ping/pong messages:

```typescript
const client = new WebSocketClient({
  url: 'wss://api.example.com/ws',
  heartbeatInterval: 30000,   // Send a ping every 30 seconds
  heartbeatTimeout: 5000,     // Wait 5 seconds for pong
});

client.on('heartbeat_timeout', () => {
  console.warn('Server did not respond to heartbeat -- reconnecting');
});

client.connect();
```

### Message Buffering During Disconnection

Messages sent while offline are automatically queued and flushed upon reconnection:

```typescript
const client = new WebSocketClient({
  url: 'ws://localhost:8080/ws',
  bufferWhileDisconnected: true, // default
  maxBufferSize: 200,            // increase buffer capacity
});

// These messages will be buffered if the client is not yet connected
client.send({ type: 'init', payload: { user: 'alice' }, timestamp: Date.now() });
client.send({ type: 'subscribe', payload: { channel: 'updates' }, timestamp: Date.now() });

// Check how many messages are waiting
console.log('Buffered:', client.bufferedCount);

client.connect();
// On connection, buffered messages are sent in order automatically
```

### Disabling Auto-Reconnect

For cases where you want full manual control:

```typescript
const client = new WebSocketClient({
  url: 'ws://localhost:8080/ws',
  reconnect: false,
});

client.on('disconnected', ({ code, reason }) => {
  console.log(`Connection closed: ${code} ${reason}`);
  // Handle reconnection manually if desired
});
```

## Error Handling

Errors in event listeners are caught internally and logged to the console. They do not crash the client or prevent other listeners from executing:

```typescript
client.on('message', (msg) => {
  throw new Error('This will be caught and logged');
});

client.on('message', (msg) => {
  // This listener still executes normally
  console.log('Received:', msg);
});
```

For WebSocket-level errors:

```typescript
client.on('error', (event) => {
  console.error('WebSocket error:', event);
  // The client will automatically attempt reconnection
  // if reconnect is enabled
});
```

## TypeScript Types

All types are exported from the package entry point:

```typescript
import type {
  WebSocketConfig,
  ResolvedWebSocketConfig,
  ConnectionState,
  WebSocketMessage,
  WebSocketEventMap,
  WebSocketEventListener,
  MessageHandler,
  UseWebSocketOptions,
  UseWebSocketReturn,
} from 'websocket-client-ts';

import { DEFAULT_CONFIG } from 'websocket-client-ts';
```
