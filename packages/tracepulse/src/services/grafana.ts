import { logger } from '../lib/logger';

interface GrafanaConfig {
  lokiUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
}

interface LogQuery {
  query: string;
  start?: string;
  end?: string;
  limit?: number;
}

interface LogEntry {
  timestamp: string;
  line: string;
  labels: Record<string, string>;
}

interface LokiResponse {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      stream: Record<string, string>;
      values: Array<[string, string]>; // [timestamp, log line]
    }>;
  };
}

class GrafanaClient {
  private config: GrafanaConfig;

  constructor(config: GrafanaConfig) {
    this.config = config;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    } else if (this.config.username && this.config.password) {
      const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    return headers;
  }

  async queryLogs(query: LogQuery): Promise<LogEntry[]> {
    try {
      const params = new URLSearchParams({
        query: query.query,
        limit: (query.limit || 1000).toString(),
      });

      if (query.start) params.append('start', query.start);
      if (query.end) params.append('end', query.end);

      const url = `${this.config.lokiUrl}/loki/api/v1/query_range?${params}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Grafana query failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as LokiResponse;
      
      const logs: LogEntry[] = [];
      for (const result of data.data.result) {
        for (const [timestamp, line] of result.values) {
          logs.push({
            timestamp,
            line,
            labels: result.stream,
          });
        }
      }

      // Sort by timestamp (newest first)
      logs.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));

      return logs;
    } catch (error) {
      logger.error('GRAFANA_QUERY_ERROR', error as Error, { query: query.query });
      return [];
    }
  }

  async detectCriticalEvents(timeWindow: string = '5m'): Promise<LogEntry[]> {
    // Look for common error patterns in logs
    const errorQueries = [
      '{level="error"}',
      '{level="critical"}', 
      '{level="fatal"}',
      '{} |~ "(?i)(error|exception|failed|timeout|crash)"',
      '{} |~ "(?i)(session.*drop|payment.*fail|auth.*fail)"',
    ];

    const allEvents: LogEntry[] = [];
    const now = Date.now() * 1000000; // Loki uses nanoseconds
    const start = (now - (5 * 60 * 1000 * 1000000)).toString(); // 5 minutes ago

    for (const query of errorQueries) {
      const events = await this.queryLogs({
        query,
        start,
        limit: 100
      });
      allEvents.push(...events);
    }

    // Deduplicate by timestamp + line
    const unique = new Map<string, LogEntry>();
    for (const event of allEvents) {
      const key = `${event.timestamp}-${event.line}`;
      if (!unique.has(key)) {
        unique.set(key, event);
      }
    }

    return Array.from(unique.values());
  }

  async searchByCorrelationId(correlationId: string, timeWindow: string = '10m'): Promise<LogEntry[]> {
    const query = `{} |~ "${correlationId}"`;
    const now = Date.now() * 1000000;
    const start = (now - (10 * 60 * 1000 * 1000000)).toString(); // 10 minutes ago

    return this.queryLogs({
      query,
      start,
      limit: 500
    });
  }
}

// Create singleton client
let grafanaClient: GrafanaClient | null = null;

export function getGrafanaClient(): GrafanaClient {
  if (!grafanaClient) {
    const config: GrafanaConfig = {
      lokiUrl: process.env.GRAFANA_LOKI_URL || 'http://localhost:3100',
      apiKey: process.env.GRAFANA_API_KEY,
      username: process.env.GRAFANA_USERNAME,
      password: process.env.GRAFANA_PASSWORD,
    };
    grafanaClient = new GrafanaClient(config);
  }
  return grafanaClient;
}

export async function startLogMonitoring(): Promise<void> {
  logger.info('GRAFANA_MONITORING_START');
  
  // Poll for critical events every 30 seconds
  setInterval(async () => {
    try {
      const client = getGrafanaClient();
      const events = await client.detectCriticalEvents();
      
      if (events.length > 0) {
        logger.info('GRAFANA_CRITICAL_EVENTS_DETECTED', {
          eventCount: events.length,
          events: events.slice(0, 3).map(e => ({
            timestamp: e.timestamp,
            line: e.line.substring(0, 100),
            labels: e.labels
          }))
        });
        
        // TODO: Convert logs to WebhookEvents and process them
        // This is where we'll integrate with the existing event processor
      }
    } catch (error) {
      logger.error('GRAFANA_MONITORING_ERROR', error as Error);
    }
  }, 30000); // 30 seconds
}

export type { LogEntry, LogQuery };