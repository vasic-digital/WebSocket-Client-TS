import {
  WebSocketConfig,
  ResolvedWebSocketConfig,
  ConnectionState,
  WebSocketMessage,
  WebSocketEventMap,
  WebSocketEventListener,
  DEFAULT_CONFIG,
} from './types';

/**
 * Generic WebSocket client with automatic reconnection (exponential backoff),
 * heartbeat/ping-pong support, typed message handling, message buffering,
 * and an event-driven API.
 *
 * Works in any environment that provides a global WebSocket constructor
 * (browsers, Node.js 21+, Deno, Bun, or polyfilled environments).
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: ResolvedWebSocketConfig;
  private state: ConnectionState = 'disconnected';
  private reconnectCount = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private messageBuffer: string[] = [];
  private intentionalClose = false;
  private disposed = false;

  // We use a looser internal type to avoid complex generic assignment issues.
  // The public API (on/off/once) ensures type safety at the call site.
  private listeners: Record<string, Set<(...args: any[]) => void>> = {};

  constructor(config: WebSocketConfig) {
    this.config = this.resolveConfig(config);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Open the WebSocket connection.
   * If already connected or connecting, this is a no-op.
   */
  connect(): void {
    if (this.disposed) {
      throw new Error('WebSocketClient has been disposed');
    }
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.intentionalClose = false;
    this.createConnection();
  }

  /**
   * Gracefully close the connection.
   * Stops reconnection attempts and clears heartbeat timers.
   */
  disconnect(code = 1000, reason = 'Client disconnect'): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.clearHeartbeat();

    if (this.ws) {
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.setState('disconnecting');
        this.ws.close(code, reason);
      }
    } else {
      this.setState('disconnected');
    }
  }

  /**
   * Send a typed message. If the socket is not connected and buffering is
   * enabled, the message is queued and flushed on reconnection.
   */
  send<T = unknown>(message: WebSocketMessage<T>): void;
  send(raw: string): void;
  send<T = unknown>(messageOrRaw: WebSocketMessage<T> | string): void {
    const serialized =
      typeof messageOrRaw === 'string'
        ? messageOrRaw
        : JSON.stringify(messageOrRaw);

    if (this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(serialized);
    } else if (this.config.bufferWhileDisconnected) {
      if (this.messageBuffer.length < this.config.maxBufferSize) {
        this.messageBuffer.push(serialized);
      }
    }
  }

  /**
   * Send a raw object as JSON.
   */
  sendJSON(data: unknown): void {
    this.send(JSON.stringify(data));
  }

  /**
   * Register an event listener.
   */
  on<K extends keyof WebSocketEventMap>(
    event: K,
    listener: WebSocketEventListener<K>,
  ): () => void {
    if (!this.listeners[event as string]) {
      this.listeners[event as string] = new Set();
    }
    const set = this.listeners[event as string];
    const fn = listener as (...args: any[]) => void;
    set.add(fn);

    // Return unsubscribe function
    return () => {
      set.delete(fn);
    };
  }

  /**
   * Remove a specific event listener.
   */
  off<K extends keyof WebSocketEventMap>(
    event: K,
    listener: WebSocketEventListener<K>,
  ): void {
    const set = this.listeners[event as string];
    if (set) {
      set.delete(listener as (...args: any[]) => void);
    }
  }

  /**
   * Register a one-time event listener.
   */
  once<K extends keyof WebSocketEventMap>(
    event: K,
    listener: WebSocketEventListener<K>,
  ): () => void {
    const wrapper = ((...args: unknown[]) => {
      this.off(event, wrapper as WebSocketEventListener<K>);
      (listener as (...a: unknown[]) => void)(...args);
    }) as WebSocketEventListener<K>;

    return this.on(event, wrapper);
  }

  /**
   * Current connection state.
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Whether the client is currently connected.
   */
  get connected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Number of buffered messages waiting to be sent.
   */
  get bufferedCount(): number {
    return this.messageBuffer.length;
  }

  /**
   * Current reconnection attempt count.
   */
  get reconnectAttempts(): number {
    return this.reconnectCount;
  }

  /**
   * Update the configuration. Takes effect on next connection attempt.
   */
  updateConfig(partial: Partial<WebSocketConfig>): void {
    this.config = this.resolveConfig({ ...this.config, ...partial });
  }

  /**
   * Permanently dispose the client. Disconnects and cleans up all resources.
   * The client cannot be reused after disposal.
   */
  dispose(): void {
    this.disposed = true;
    this.disconnect();
    this.listeners = {};
    this.messageBuffer = [];
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  private resolveConfig(config: WebSocketConfig): ResolvedWebSocketConfig {
    return {
      url: config.url,
      protocols: config.protocols ?? DEFAULT_CONFIG.protocols,
      reconnect: config.reconnect ?? DEFAULT_CONFIG.reconnect,
      reconnectInterval: config.reconnectInterval ?? DEFAULT_CONFIG.reconnectInterval,
      reconnectAttempts: config.reconnectAttempts ?? DEFAULT_CONFIG.reconnectAttempts,
      maxReconnectInterval: config.maxReconnectInterval ?? DEFAULT_CONFIG.maxReconnectInterval,
      reconnectBackoffMultiplier:
        config.reconnectBackoffMultiplier ?? DEFAULT_CONFIG.reconnectBackoffMultiplier,
      heartbeatInterval: config.heartbeatInterval ?? DEFAULT_CONFIG.heartbeatInterval,
      heartbeatMessage: config.heartbeatMessage ?? DEFAULT_CONFIG.heartbeatMessage,
      heartbeatResponseType:
        config.heartbeatResponseType ?? DEFAULT_CONFIG.heartbeatResponseType,
      heartbeatTimeout: config.heartbeatTimeout ?? DEFAULT_CONFIG.heartbeatTimeout,
      bufferWhileDisconnected:
        config.bufferWhileDisconnected ?? DEFAULT_CONFIG.bufferWhileDisconnected,
      maxBufferSize: config.maxBufferSize ?? DEFAULT_CONFIG.maxBufferSize,
    };
  }

  private createConnection(): void {
    this.setState('connecting');

    try {
      this.ws =
        this.config.protocols.length > 0
          ? new WebSocket(this.config.url, this.config.protocols)
          : new WebSocket(this.config.url);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      this.setState('disconnected');
      this.scheduleReconnect();
    }
  }

  private handleOpen(): void {
    this.setState('connected');
    this.reconnectCount = 0;
    this.flushBuffer();
    this.startHeartbeat();
    this.emit('connected');
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data as string);

      // Handle heartbeat pong
      if (
        this.config.heartbeatInterval > 0 &&
        data.type === this.config.heartbeatResponseType
      ) {
        this.clearHeartbeatTimeout();
        return;
      }

      const message: WebSocketMessage = {
        type: data.type ?? 'unknown',
        payload: data.payload ?? data,
        timestamp: data.timestamp ?? Date.now(),
      };

      this.emit('message', message);
    } catch {
      // If we cannot parse, wrap the raw data
      const message: WebSocketMessage<string> = {
        type: 'raw',
        payload: event.data as string,
        timestamp: Date.now(),
      };
      this.emit('message', message);
    }
  }

  private handleClose(event: CloseEvent): void {
    this.clearHeartbeat();

    const detail = {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
    };

    this.ws = null;
    this.setState('disconnected');
    this.emit('disconnected', detail);

    if (!this.intentionalClose && this.config.reconnect) {
      this.scheduleReconnect();
    }
  }

  private handleError(event: Event): void {
    this.emit('error', event);
  }

  // ---------------------------------------------------------------------------
  // Reconnection
  // ---------------------------------------------------------------------------

  private scheduleReconnect(): void {
    if (this.disposed) return;
    if (this.reconnectCount >= this.config.reconnectAttempts) {
      this.emit('reconnect_failed', { attempts: this.reconnectCount });
      return;
    }

    this.reconnectCount++;
    const delay = Math.min(
      this.config.reconnectInterval *
        Math.pow(this.config.reconnectBackoffMultiplier, this.reconnectCount - 1),
      this.config.maxReconnectInterval,
    );

    this.emit('reconnecting', {
      attempt: this.reconnectCount,
      maxAttempts: this.config.reconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.createConnection();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Heartbeat
  // ---------------------------------------------------------------------------

  private startHeartbeat(): void {
    if (this.config.heartbeatInterval <= 0) return;

    this.heartbeatTimer = setInterval(() => {
      if (this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(this.config.heartbeatMessage);
        this.startHeartbeatTimeout();
      }
    }, this.config.heartbeatInterval);
  }

  private startHeartbeatTimeout(): void {
    this.clearHeartbeatTimeout();
    this.heartbeatTimeoutTimer = setTimeout(() => {
      this.emit('heartbeat_timeout');
      // Force reconnect: the server did not respond in time
      if (this.ws) {
        this.ws.close(4000, 'Heartbeat timeout');
      }
    }, this.config.heartbeatTimeout);
  }

  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutTimer !== null) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearHeartbeatTimeout();
  }

  // ---------------------------------------------------------------------------
  // Buffer
  // ---------------------------------------------------------------------------

  private flushBuffer(): void {
    while (this.messageBuffer.length > 0) {
      const msg = this.messageBuffer.shift();
      if (msg && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(msg);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // State & Events
  // ---------------------------------------------------------------------------

  private setState(newState: ConnectionState): void {
    const oldState = this.state;
    if (oldState === newState) return;
    this.state = newState;
    this.emit('state_change', { from: oldState, to: newState });
  }

  private emit<K extends keyof WebSocketEventMap>(
    event: K,
    ...args: WebSocketEventMap[K] extends void ? [] : [WebSocketEventMap[K]]
  ): void {
    const set = this.listeners[event as string];
    if (!set) return;
    for (const listener of set) {
      try {
        if (args.length === 0) {
          listener();
        } else {
          listener(args[0]);
        }
      } catch (err) {
        console.error(`Error in WebSocket event listener [${event}]:`, err);
      }
    }
  }
}
