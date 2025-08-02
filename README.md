# TracePulse - Event-Driven Debugging Agent

TracePulse is an AI-powered debugging agent that accelerates issue resolution by analyzing tagged log events, system architecture, and recent code changes to provide actionable hypotheses in real-time.

## 🚀 Quick Start

### Prerequisites
- Bun (latest version)
- Redis (running on localhost:6379 or configured via REDIS_URL)
- OpenAI API key (for AI analysis)
- Optional: Slack bot token (for alerts)
- Optional: GitHub token (for code diff analysis)

### Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

3. **Start Redis (if not running):**
   ```bash
   redis-server
   ```

4. **Start TracePulse server:**
   ```bash
   bun dev
   ```
   The server will start on http://localhost:3000

5. **Test the webhook:**
   ```bash
   bun run test-webhook.ts
   ```

## 📦 Project Structure

```
observability-ai/
├── packages/
│   ├── debug-queue/          # NPM package for event logging
│   │   └── src/
│   │       ├── index.ts      # Main API
│   │       ├── client.ts     # HTTP client
│   │       └── types.ts      # TypeScript types
│   └── tracepulse/          # Main debugging service
│       └── src/
│           ├── server.ts     # Hono server
│           ├── routes/       # API endpoints
│           ├── services/     # Integrations (Redis, AI, Slack, GitHub)
│           └── lib/          # Core logic
├── system-map.yaml          # System architecture definition
└── test-webhook.ts          # Test script
```

## 🔧 Using DebugQueue

Install the debug-queue package in your application:

```bash
npm install debug-queue
# or
bun add debug-queue
```

Use it to tag critical events:

```typescript
import { debugQueue } from 'debug-queue';

// Log a critical error
debugQueue.critical('SESSION_DROP', {
  service: 'SessionManager',
  errorCode: 'TIMEOUT',
  userId: '123',
  sessionId: 'abc'
}, { 
  priority: 'high',
  correlationId: 'txn-456' 
});
```

## 🗺️ System Map

Define your system architecture in `system-map.yaml`:

```yaml
services:
  SessionManager:
    description: "Manages user sessions"
    file: "src/services/session.js"
    functions: [startSession, endSession]
    depends_on: [PaymentService, UserService]
```

## 🔍 How It Works

1. **Event Collection**: Applications use debug-queue to send tagged events
2. **Correlation**: TracePulse groups events by correlation ID
3. **Analysis**: AI analyzes events with system map context and recent code changes
4. **Hypothesis Generation**: Generates ranked hypotheses with evidence
5. **Reporting**: Sends actionable reports via Slack/email

## 🛠️ Development

### Run in development mode:
```bash
bun dev
```

### Run tests:
```bash
bun test
```

### Build for production:
```bash
bun run build
```

## 🐳 Docker Deployment

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY . .
RUN bun install
CMD ["bun", "start"]
```

## 📊 Environment Variables

Key configuration options:

- `REDIS_URL` - Redis connection string
- `OPENAI_API_KEY` - OpenAI API key for AI analysis
- `SLACK_TOKEN` - Slack bot token for alerts
- `GITHUB_TOKEN` - GitHub token for code analysis
- `SYSTEM_MAP_PATH` - Path to system map YAML file

See `.env.example` for all options.

## 🎯 Target Use Cases

- EV charging session debugging
- Payment processing failures
- Distributed system failures
- Real-time incident response

## 📈 Success Metrics

- <5 seconds from event to report
- ≥80% accuracy in root cause identification
- 40% reduction in debugging time

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details
