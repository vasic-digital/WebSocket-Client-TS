# @vasic-digital/websocket-client

Generic WebSocket client library for TypeScript with automatic reconnection, heartbeat support, typed messages, and React hooks.

## Features

- Automatic reconnection with configurable exponential backoff
- Heartbeat/ping-pong with timeout detection
- Typed message sending and receiving (`{ type, payload, timestamp }`)
- Message buffering while disconnected with automatic flush on reconnect
- Event-driven API with typed listeners
- React hooks for seamless integration (`useWebSocket`, `useWebSocketMessage`, `useConnectionState`)
- Zero runtime dependencies
- Dual CJS/ESM output with full type declarations

## Installation

```bash
npm install @vasic-digital/websocket-client
```

## Quick Start

### Standalone (No Framework)

```typescript
import { WebSocketClient } from '@vasic-digital/websocket-client';

const client = new WebSocketClient({
  url: 'ws://localhost:8080/ws',
  reconnect: true,
  reconnectAttempts: 10,
  heartbeatInterval: 30000,
});

client.on('connected', () => {
  console.log('Connected');
  client.send({ type: 'subscribe', payload: { channel: 'updates' }, timestamp: Date.now() });
});

client.on('message', (msg) => {
  console.log(`[${msg.type}]`, msg.payload);
});

client.on('disconnected', ({ code, reason }) => {
  console.log(`Disconnected: ${code} ${reason}`);
});

client.on('reconnecting', ({ attempt, maxAttempts, delay }) => {
  console.log(`Reconnecting ${attempt}/${maxAttempts} in ${delay}ms`);
});

client.connect();
```

### React

```tsx
import { useWebSocket, useWebSocketMessage } from '@vasic-digital/websocket-client';

function App() {
  const { send, state, client } = useWebSocket({
    url: 'ws://localhost:8080/ws',
    heartbeatInterval: 30000,
    onMessage: (msg) => console.log('Message:', msg),
    onConnected: () => console.log('Connected'),
  });

  // Subscribe to specific message types
  useWebSocketMessage(client, 'notification', (msg) => {
    alert(msg.payload);
  });

  return (
    <div>
      <p>Status: {state}</p>
      <button onClick={() => send({ type: 'ping', payload: null, timestamp: Date.now() })}>
        Ping
      </button>
    </div>
  );
}
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | required | WebSocket server URL |
| `protocols` | `string[]` | `[]` | Sub-protocols to negotiate |
| `reconnect` | `boolean` | `true` | Auto-reconnect on disconnect |
| `reconnectInterval` | `number` | `1000` | Base reconnect delay (ms) |
| `reconnectAttempts` | `number` | `10` | Max reconnect attempts |
| `maxReconnectInterval` | `number` | `30000` | Max backoff delay (ms) |
| `reconnectBackoffMultiplier` | `number` | `2` | Backoff multiplier |
| `heartbeatInterval` | `number` | `0` | Heartbeat interval (ms), 0 to disable |
| `heartbeatMessage` | `string` | `'{"type":"ping"}'` | Heartbeat ping message |
| `heartbeatResponseType` | `string` | `'pong'` | Expected pong type field |
| `heartbeatTimeout` | `number` | `5000` | Pong response timeout (ms) |
| `bufferWhileDisconnected` | `boolean` | `true` | Buffer messages while offline |
| `maxBufferSize` | `number` | `100` | Max buffered messages |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `connecting` | `void` | Connection attempt started |
| `connected` | `void` | Connection established |
| `disconnected` | `{ code, reason, wasClean }` | Connection closed |
| `error` | `Event` | WebSocket error |
| `message` | `WebSocketMessage` | Incoming message |
| `reconnecting` | `{ attempt, maxAttempts, delay }` | Reconnection attempt |
| `reconnect_failed` | `{ attempts }` | All reconnection attempts exhausted |
| `heartbeat_timeout` | `void` | Heartbeat response not received |
| `state_change` | `{ from, to }` | Connection state changed |

## License

MIT
