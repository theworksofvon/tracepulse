# STARTUP Command - TracePulse Project

## Project Overview

**TracePulse** is an event-driven, human-in-the-loop debugging agent designed to accelerate issue resolution for software engineering teams. It targets high-level, system-wide bugs (like EV session drops or payment failures) by integrating with existing observability pipelines and delivering actionable hypotheses in real-time.

### Key Value Proposition
- Reduces debugging time from hours to minutes (<5 seconds from event trigger to report)
- Targets ≥80% accuracy for hypothesizing failure sources
- Focuses on system-wide bugs that are difficult to pinpoint manually
- Uses tagged logging to filter noise and focus on critical events

## Technical Stack & Requirements

**Core Technologies:**
- **Runtime**: Bun (use instead of Node.js/npm/pnpm per workspace rules)
- **Framework**: Hono (web framework for API and minimal UI)
- **Language**: TypeScript
- **Storage**: Redis (for caching system maps and GitHub diffs)
- **AI**: OpenAI GPT-4 Turbo (MVP), future: fine-tuned DeepSeek-V3
- **Deployment**: Docker container for Kubernetes or edge (EV stations)

**Key Dependencies:**
```bash
bun add hono js-yaml redis octokit openai @slack/web-api
```

## Architecture Overview

**Core Components:**
1. **DebugQueue Logging Library**: npm package for tagging critical events
2. **System Map**: YAML-defined architecture graph for tracing failures
3. **Real-Time Event Monitoring**: Webhook-based log event processing
4. **GitHub Integration**: Read-only access for monitoring code diffs
5. **AI-Powered Correlation**: Hypothesis generation using logs + diffs + system map
6. **Actionable Reports**: Slack/email delivery with chat UI for feedback

**Data Flow:**
```
Tagged Log Event → Webhook → System Map Analysis → GitHub Diff Check → AI Hypothesis → Report + Chat UI
```

## Getting Started Instructions

### 1. Environment Setup
```bash
# Initialize if not already done
bun install

# Set up environment variables
cp .env.example .env  # Create if doesn't exist
# Add: GITHUB_TOKEN, SLACK_TOKEN, OPENAI_API_KEY, REDIS_URL
```

### 2. Priority Implementation Order

**Phase 1 - Core Infrastructure:**
1. Set up Hono server with webhook endpoint (`/webhook/event`)
2. Implement basic Redis connection for caching
3. Create YAML system map parser and storage
4. Basic auth middleware (JWT or API keys)

**Phase 2 - DebugQueue Library:**
1. Create TypeScript interface for tagged logging
2. Implement HTTP client for sending events to TracePulse webhook
3. Package as npm module (`debug-queue`) for open-source release

**Phase 3 - Integration Layer:**
1. GitHub API integration for diff monitoring
2. Slack/email report delivery
3. Basic chat UI for human feedback loop

**Phase 4 - AI & Analysis:**
1. Implement correlation logic (start with rule-based, evolve to LLM)
2. Real-time log analysis with transaction correlation
3. Hypothesis generation with evidence linking

### 3. Key Implementation Details

**DebugQueue Library Usage Pattern:**
```typescript
import { debugQueue } from 'debug-queue';

debugQueue.log('SESSION_DROP', {
  service: 'SessionManager',
  errorCode: 'TIMEOUT', 
  correlationId: 'txn-456',
  details: { userId: '123', sessionId: 'abc', edgeDevice: 'EV-Station-01' }
}, { priority: 'high' });
```

**System Map Schema:**
```yaml
services:
  EdgeDevice:
    depends_on: [SessionManager]
  SessionManager:
    file: src/session.js
    functions: [startSession]
    depends_on: [ServiceA]
```

**Webhook Schema:**
```typescript
const webhookSchema = z.object({
  eventType: z.string(),
  correlationId: z.string(),
  details: z.object({ 
    service: z.string(), 
    errorCode: z.string() 
  })
});
```

## Target Use Case Context

**Primary Focus**: EV (Electric Vehicle) session debugging
- Session drops during charging
- Edge device failures at charging stations
- Real-time requirements for EV infrastructure
- Deployment at edge (EV stations) or in-cluster

**Success Metrics:**
- <5 seconds from event trigger to report
- ≥80% accuracy in root cause hypotheses
- 40% reduction in incident response costs
- Save 5+ hours per debugging session

## Important Files to Reference

1. **`pitch.md`**: Complete business context, market opportunity, and competitive positioning
2. **`startup.md`**: Detailed technical implementation guide with code examples
3. **`package.json`**: Current dependencies and project configuration
4. **`tsconfig.json`**: TypeScript configuration

## Development Priorities

**Immediate Tasks:**
1. Set up basic Hono server structure
2. Implement webhook endpoint for receiving tagged log events
3. Create Redis connection and system map storage
4. Build DebugQueue library interface

**Next Steps:**
1. GitHub integration for monitoring code changes
2. Basic AI correlation logic
3. Slack/email reporting
4. Chat UI for human feedback

**Future Roadmap:**
1. OpenTelemetry auto-discovery for system maps
2. Fine-tuned models for EV-specific debugging
3. Cursor IDE integration
4. Enterprise features and security audits

## Key Constraints & Guidelines

- Use Bun instead of Node.js/npm/pnpm (workspace rule)
- Target deployment: Docker container for K8s or edge
- Maintain <5 second latency requirement
- Focus on system-wide bugs, not individual function errors
- Emphasize human-in-the-loop approach for accuracy
- Keep MVP lean but production-ready

## Questions to Ask During Development

1. What observability tools are we integrating with first? (Grafana Loki, ELK, Splunk)
2. What's the initial system map structure for the target EV use case?
3. Which GitHub repositories need monitoring for the pilot?
4. What Slack channels should receive reports?
5. What authentication method should we implement for the chat UI?

Remember: TracePulse is designed to provide actionable hypotheses with evidence, not definitive fixes. The goal is to dramatically reduce the time developers spend hunting through logs by pointing them to the most likely causes with supporting evidence. 