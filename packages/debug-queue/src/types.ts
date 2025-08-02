export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';
export type Priority = 'low' | 'medium' | 'high';

export interface DebugQueueConfig {
  endpoint?: string;
  apiKey?: string;
  service?: string;
  environment?: string;
  batchSize?: number;
  flushInterval?: number;
  enabled?: boolean;
}

export interface LogEvent {
  eventType: string;
  correlationId?: string;
  service?: string;
  level?: LogLevel;
  priority?: Priority;
  timestamp?: string;
  details: Record<string, any>;
  metadata?: {
    errorCode?: string;
    userId?: string;
    sessionId?: string;
    edgeDevice?: string;
    [key: string]: any;
  };
}

export interface LogOptions {
  correlationId?: string;
  priority?: Priority;
  level?: LogLevel;
}