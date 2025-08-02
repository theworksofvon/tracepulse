// Internal logger for TracePulse - avoids circular dependency with DebugQueue

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class TracePulseLogger {
  private serviceName = 'tracepulse';

  private formatMessage(level: LogLevel, eventType: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${this.serviceName}] ${eventType}${contextStr}`;
  }

  debug(eventType: string, context?: LogContext): void {
    console.debug(this.formatMessage('debug', eventType, context));
  }

  info(eventType: string, context?: LogContext): void {
    console.info(this.formatMessage('info', eventType, context));
  }

  warn(eventType: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', eventType, context));
  }

  error(eventType: string, error?: Error | LogContext, context?: LogContext): void {
    if (error instanceof Error) {
      const errorContext = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...context
      };
      console.error(this.formatMessage('error', eventType, errorContext));
    } else {
      console.error(this.formatMessage('error', eventType, error));
    }
  }
}

// Export singleton instance
export const logger = new TracePulseLogger();