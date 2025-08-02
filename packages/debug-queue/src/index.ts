import { DebugQueueClient } from './client';
import type { DebugQueueConfig, LogEvent, LogOptions, LogLevel, Priority } from './types';

export * from './types';

class DebugQueue {
  private client: DebugQueueClient;

  constructor(config?: DebugQueueConfig) {
    this.client = new DebugQueueClient(config);
  }

  configure(config: DebugQueueConfig): void {
    this.client = new DebugQueueClient(config);
  }

  async log(
    eventType: string,
    details: Record<string, any>,
    options: LogOptions = {}
  ): Promise<void> {
    const event: LogEvent = {
      eventType,
      details,
      correlationId: options.correlationId || this.generateCorrelationId(),
      level: options.level || 'info',
      priority: options.priority || 'medium',
    };

    await this.client.send(event);
  }

  async error(
    eventType: string,
    error: Error | string,
    details: Record<string, any> = {},
    options: LogOptions = {}
  ): Promise<void> {
    const errorDetails = {
      ...details,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    };

    await this.log(eventType, errorDetails, {
      ...options,
      level: 'error',
      priority: options.priority || 'high',
    });
  }

  async warn(
    eventType: string,
    details: Record<string, any>,
    options: LogOptions = {}
  ): Promise<void> {
    await this.log(eventType, details, {
      ...options,
      level: 'warn',
    });
  }

  async info(
    eventType: string,
    details: Record<string, any>,
    options: LogOptions = {}
  ): Promise<void> {
    await this.log(eventType, details, {
      ...options,
      level: 'info',
    });
  }

  async critical(
    eventType: string,
    details: Record<string, any>,
    options: LogOptions = {}
  ): Promise<void> {
    await this.log(eventType, details, {
      ...options,
      level: 'critical',
      priority: 'high',
    });
  }

  async flush(): Promise<void> {
    await this.client.flush();
  }

  destroy(): void {
    this.client.destroy();
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Default singleton instance
const debugQueue = new DebugQueue();

// Named exports
export { DebugQueue, debugQueue };

// Default export
export default debugQueue;