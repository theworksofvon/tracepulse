# debug-queue

Event-driven debugging library for TracePulse. Tag critical events in your application for intelligent debugging and analysis.

## Installation

```bash
bun add debug-queue
# or
npm install debug-queue
```

## Usage

```typescript
import { debugQueue } from 'debug-queue';

// Log a critical event
debugQueue.log('SESSION_DROP', {
  service: 'SessionManager',
  errorCode: 'TIMEOUT',
  details: { 
    userId: '123', 
    sessionId: 'abc', 
    edgeDevice: 'EV-Station-01' 
  }
}, { 
  priority: 'high',
  correlationId: 'txn-456' 
});

// Log an error
debugQueue.error('PAYMENT_FAILED', new Error('Gateway timeout'), {
  userId: '123',
  amount: 100,
  currency: 'USD'
});

// Log a warning
debugQueue.warn('HIGH_LATENCY', {
  endpoint: '/api/charge',
  responseTime: 5000
});

// Configure (optional)
debugQueue.configure({
  endpoint: 'https://your-tracepulse-instance.com/webhook/event',
  apiKey: 'your-api-key',
  service: 'payment-service',
  environment: 'production'
});
```

## Configuration

Configure via constructor or environment variables:

```typescript
import { DebugQueue } from 'debug-queue';

const customQueue = new DebugQueue({
  endpoint: 'https://tracepulse.example.com/webhook/event',
  apiKey: 'your-api-key',
  service: 'my-service',
  environment: 'production',
  batchSize: 20,
  flushInterval: 10000,
  enabled: true
});
```

Environment variables:
- `TRACEPULSE_ENDPOINT` - TracePulse webhook endpoint
- `TRACEPULSE_API_KEY` - API key for authentication
- `SERVICE_NAME` - Name of your service
- `NODE_ENV` - Environment (development/production)

## API

### Methods

- `log(eventType, details, options)` - Log a general event
- `error(eventType, error, details, options)` - Log an error event
- `warn(eventType, details, options)` - Log a warning
- `info(eventType, details, options)` - Log an info event
- `critical(eventType, details, options)` - Log a critical event
- `flush()` - Manually flush the event queue
- `destroy()` - Clean up and flush remaining events

### Options

- `correlationId` - Track related events across services
- `priority` - Event priority: 'low' | 'medium' | 'high'
- `level` - Log level: 'debug' | 'info' | 'warn' | 'error' | 'critical'

## License

MIT