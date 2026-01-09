import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface ReconnectOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

export class ReconnectHandler extends EventEmitter {
  private retryCount: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isReconnecting: boolean = false;
  private options: Required<ReconnectOptions>;

  constructor(options: ReconnectOptions = {}) {
    super();
    this.options = {
      maxRetries: options.maxRetries ?? 10,
      initialDelay: options.initialDelay ?? 1000,
      maxDelay: options.maxDelay ?? 30000,
      backoffMultiplier: options.backoffMultiplier ?? 2,
    };
  }

  scheduleReconnect(connectFn: () => Promise<void>): void {
    if (this.isReconnecting) {
      return;
    }

    if (this.retryCount >= this.options.maxRetries) {
      logger.error('Max reconnection retries reached', { retryCount: this.retryCount });
      this.emit('maxRetriesReached');
      return;
    }

    this.isReconnecting = true;
    const delay = Math.min(
      this.options.initialDelay * Math.pow(this.options.backoffMultiplier, this.retryCount),
      this.options.maxDelay
    );

    logger.info('Scheduling reconnection', {
      retryCount: this.retryCount + 1,
      delayMs: delay,
    });

    this.reconnectTimer = setTimeout(async () => {
      try {
        this.retryCount++;
        await connectFn();
        this.reset();
        this.emit('reconnected');
        logger.info('Reconnection successful', { retryCount: this.retryCount });
      } catch (error) {
        logger.error('Reconnection attempt failed', { error, retryCount: this.retryCount });
        this.isReconnecting = false;
        this.scheduleReconnect(connectFn);
      }
    }, delay);
  }

  reset(): void {
    this.retryCount = 0;
    this.isReconnecting = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  cancel(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isReconnecting = false;
  }

  getRetryCount(): number {
    return this.retryCount;
  }
}

