# CLAUDE.md

## Overview

Standalone, generic WebSocket client library for TypeScript/JavaScript. Provides a core `WebSocketClient` class with automatic reconnection (exponential backoff), heartbeat/ping-pong, typed message handling, message buffering, and an event-driven API. Also includes React hooks (`useWebSocket`, `useWebSocketMessage`, `useConnectionState`) for seamless integration.

## Commands

```bash
npm install          # install dependencies
npm run build        # build CJS + ESM + type declarations via tsup
npm run test         # run tests (vitest)
npm run test:watch   # run tests in watch mode
npm run lint         # type-check without emitting (tsc --noEmit)
npm run clean        # remove dist/
```

## Architecture

- `src/types.ts` - All shared types, interfaces, configuration defaults
- `src/client.ts` - Core `WebSocketClient` class (framework-agnostic)
- `src/hooks.ts` - React hooks: `useWebSocket`, `useWebSocketMessage`, `useConnectionState`
- `src/index.ts` - Public barrel export

## Conventions

- TypeScript strict mode enabled
- Dual CJS/ESM output via tsup
- React is an optional peer dependency (hooks are tree-shakeable)
- Tests use vitest with mock WebSocket
- All event listeners return an unsubscribe function
- Messages follow `{ type, payload, timestamp }` structure
