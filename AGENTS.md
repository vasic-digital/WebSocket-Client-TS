# AGENTS.md

## Agent Instructions

When working on this project, follow these guidelines:

### Code Style
- Use TypeScript strict mode at all times
- Prefer explicit return types on public API methods
- Use JSDoc comments on all exported functions, classes, and types
- Follow the existing event-driven pattern for adding new features

### Testing
- All new features must have corresponding tests in `src/__tests__/`
- Use the `MockWebSocket` class from `client.test.ts` for WebSocket mocking
- Use `vi.useFakeTimers()` for any time-dependent tests (reconnection, heartbeat)
- Run `npm run test` before committing

### Architecture Rules
- The core `WebSocketClient` in `src/client.ts` must remain framework-agnostic (no React imports)
- React-specific code belongs exclusively in `src/hooks.ts`
- All public types must be defined in `src/types.ts` and re-exported from `src/index.ts`
- Do not add runtime dependencies; this library should be zero-dependency

### Adding New Features
- New event types: add to `WebSocketEventMap` in `src/types.ts`
- New configuration options: add to `WebSocketConfig` and `ResolvedWebSocketConfig` with defaults in `DEFAULT_CONFIG`
- New React hooks: add to `src/hooks.ts` and export from `src/index.ts`


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

