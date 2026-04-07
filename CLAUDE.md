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


## ⚠️ MANDATORY: NO SUDO OR ROOT EXECUTION

**ALL operations MUST run at local user level ONLY.**

This is a PERMANENT and NON-NEGOTIABLE security constraint:

- **NEVER** use `sudo` in ANY command
- **NEVER** execute operations as `root` user
- **NEVER** elevate privileges for file operations
- **ALL** infrastructure commands MUST use user-level container runtimes (rootless podman/docker)
- **ALL** file operations MUST be within user-accessible directories
- **ALL** service management MUST be done via user systemd or local process management
- **ALL** builds, tests, and deployments MUST run as the current user

### Why This Matters
- **Security**: Prevents accidental system-wide damage
- **Reproducibility**: User-level operations are portable across systems
- **Safety**: Limits blast radius of any issues
- **Best Practice**: Modern container workflows are rootless by design

### When You See SUDO
If any script or command suggests using `sudo`:
1. STOP immediately
2. Find a user-level alternative
3. Use rootless container runtimes
4. Modify commands to work within user permissions

**VIOLATION OF THIS CONSTRAINT IS STRICTLY PROHIBITED.**

