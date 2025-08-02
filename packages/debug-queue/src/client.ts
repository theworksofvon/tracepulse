import type { LogEvent, DebugQueueConfig } from './types';

export class DebugQueueClient {
  private config: Required<DebugQueueConfig>;
  private queue: LogEvent[] = [];
  private flushTimer?: Timer;

  constructor(config: DebugQueueConfig = {}) {
    this.config = {
      endpoint: config.endpoint || process.env.TRACEPULSE_ENDPOINT || 'http://localhost:3000/webhook/event',
      apiKey: config.apiKey || process.env.TRACEPULSE_API_KEY || '',
      service: config.service || process.env.SERVICE_NAME || 'unknown',
      environment: config.environment || process.env.NODE_ENV || 'development',
      batchSize: config.batchSize || 10,
      flushInterval: config.flushInterval || 5000,
      enabled: config.enabled !== undefined ? config.enabled : process.env.NODE_ENV !== 'test'
    };

    if (this.config.enabled && this.config.flushInterval > 0) {
      this.startFlushTimer();
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  async send(event: LogEvent): Promise<void> {
    if (!this.config.enabled) return;

    const enrichedEvent: LogEvent = {
      ...event,
      service: event.service || this.config.service,
      timestamp: event.timestamp || new Date().toISOString(),
    };

    this.queue.push(enrichedEvent);

    if (this.queue.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
        },
        body: JSON.stringify({
          events,
          environment: this.config.environment,
        }),
      });

      if (!response.ok) {
        console.error(`DebugQueue: Failed to send events: ${response.status} ${response.statusText}`);
        // Put events back in queue for retry
        this.queue.unshift(...events);
      }
    } catch (error) {
      console.error('DebugQueue: Failed to send events:', error);
      // Put events back in queue for retry
      this.queue.unshift(...events);
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush(); // Final flush
  }
}