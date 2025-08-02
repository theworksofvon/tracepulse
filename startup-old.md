# TracePulse MVP Implementation Guide

## Overview
**TracePulse** is an event-driven, human-in-the-loop debugging agent that reduces debugging time for system-wide bugs, like EV session failures. This guide outlines the MVP implementation for a TypeScript-based backend service, deployable in-cluster or on-edge, using **Bun** (runtime) and **Hono** (web framework). The agent monitors tagged logs, traces issues via a YAML-defined system map, and delivers real-time reports with a Slack-style chat UI.

## Requirements
- **Goal**: Build a lightweight backend service that:
  - Listens for DebugQueue log events via webhooks.
  - Traces failures using logs and GitHub diffs, guided by a YAML system map.
  - Delivers reports via Slack/email with a chat UI for feedback.
  - Targets EV session debugging (e.g., `SESSION_DROP` failures).
- **Tech Stack**: Bun (runtime), Hono (API framework), TypeScript, Redis (caching), OpenAI (for LLM).
- **Deployment**: Docker container for Kubernetes or edge (e.g., EV stations).
- **Latency**: <5 seconds from event trigger to report.
- **Accuracy**: ≥80% for hypothesizing failure sources.

## Architecture
- **Backend**: Hono server for webhook processing, log analysis, and report generation.
- **Frontend**: Minimal Hono-based chat UI (or static if needed), with basic auth (e.g., JWT).
- **Storage**: Redis for in-memory system map and cached GitHub diffs.
- **Integrations**:
  - Grafana Loki/ELK for log streams.
  - GitHub API for read-only diff access.
  - Slack/email for report delivery.
- **Deployment**: Dockerized for Kubernetes or edge, optimized for low-latency EV use cases.

## Implementation Steps
### 1. Setup Bun and Hono Project
- Initialize Bun project: `bun init tracepulse` (enable TypeScript in tsconfig.json).
- Install dependencies: `bun add hono js-yaml redis octokit openai @slack/web-api`.
- Set up Redis: Local or cloud instance for caching system map and diffs.
- Basic auth: Use JWT or simple API keys for chat UI access (e.g., via Hono middleware).

### 2. DebugQueue Logging Library
- **Goal**: Create an npm package (`debug-queue`) for tagging critical logs.
- **Implementation**:
  - Define TypeScript API:
    ```typescript
    interface LogDetails {
      service: string;
      errorCode: string;
      correlationId: string;
      details: Record<string, string>;
    }

    interface LogOptions {
      priority?: 'high' | 'low';
    }

    export function log(eventType: string, details: LogDetails, options?: LogOptions): void;
    ```
  - Example usage (for EV session):
    ```typescript
    import { debugQueue } from 'debug-queue';

    debugQueue.log('SESSION_DROP', {
      service: 'SessionManager',
      errorCode: 'TIMEOUT',
      correlationId: 'txn-456',
      details: { userId: '123', sessionId: 'abc', edgeDevice: 'EV-Station-01' }
    }, { priority: 'high' });
    ```
  - Send logs to Loki/ELK or TracePulse webhook (`POST /webhook/event`) using async HTTP requests (e.g., Bun's fetch).
  - Wrap existing loggers (e.g., console.log) to append tags without disrupting app logic.
  - Publish to npm and GitHub (open-source) for adoption.

### 3. System Map (YAML-defined Architecture Graph)
- **Goal**: Parse a YAML map to guide failure tracing.
- **Implementation**:
  - Define schema:
    ```yaml
    services:
      EdgeDevice:
        depends_on: [SessionManager]
      SessionManager:
        file: src/session.js
        functions: [startSession]
        depends_on: [ServiceA]
      ServiceA:
        depends_on: [ServiceB]
    ```
  - Parse YAML into an in-memory graph using `js-yaml` and store in Redis:
    ```typescript
    import { load } from 'js-yaml';
    import { createClient } from 'redis';

    const redis = createClient();
    await redis.connect();

    async function loadSystemMap(yamlContent: string) {
      const graph = load(yamlContent) as { services: Record<string, { depends_on: string[], file?: string, functions?: string[] }> };
      await redis.set('system_map', JSON.stringify(graph));
    }
    ```
  - Roadmap: Add OpenTelemetry/Istio auto-discovery for dynamic updates.

### 4. Real-Time Event Monitoring
- **Goal**: Trigger on DebugQueue logs for real-time analysis.
- **Implementation**:
  - Set up Hono server with webhook endpoint:
    ```typescript
    import { Hono } from 'hono';
    import { z } from 'zod';

    const app = new Hono();

    const webhookSchema = z.object({
      eventType: z.string(),
      correlationId: z.string(),
      details: z.object({ service: z.string(), errorCode: z.string() })
    });

    app.post('/webhook/event', async (c) => {
      const input = webhookSchema.parse(await c.req.json());
      // Trigger analysis
      await analyzeEvent(input);
      return c.json({ status: 'processed' });
    });

    Bun.serve({ fetch: app.fetch, port: 3000 });
    ```
  - Subscribe to Loki live tailing or ELK real-time indexing for log streams.
  - Query logs by `correlationId` within a 5-minute transaction window.

### 5. GitHub Integration
- **Goal**: Monitor code diffs for relevant files/functions.
- **Implementation**:
  - Use GitHub API with OAuth for read-only access:
    ```typescript
    import { Octokit } from '@octokit/rest';

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    async function getRecentDiffs(repo: string, file: string) {
      const { data } = await octokit.repos.getContent({ owner: 'org', repo, path: file });
      const diffs = await octokit.repos.compareCommits({ owner: 'org', repo, base: 'HEAD^', head: 'HEAD' });
      return diffs.data.files.filter(f => f.filename === file);
    }
    ```
  - Cache diffs in Redis for speed.

### 6. AI-Powered Correlation
- **Goal**: Hypothesize failure causes with ≥80% accuracy.
- **Implementation**:
  - MVP: Rule-based matching (e.g., “`TIMEOUT` + recent retry change = flag SessionManager”).
  - Use GPT-4 Turbo with few-shot prompts:
    ```typescript
    import OpenAI from 'openai';

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    async function hypothesize(logs: string[], diffs: string[], map: string) {
      const prompt = `Given logs: ${logs.join('\n')}, diffs: ${diffs.join('\n')}, system map: ${map}, hypothesize root cause.`;
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
      });
      return response.choices[0].message.content;
    }
    ```
  - Post-MVP: Fine-tune DeepSeek-V3 on EV debug datasets.

### 7. Actionable Reports
- **Goal**: Deliver reports with hypotheses and chat UI.
- **Implementation**:
  - Send reports via Slack/email:
    ```typescript
    import { WebClient } from '@slack/web-api';

    const slack = new WebClient(process.env.SLACK_TOKEN);

    async function sendReport(hypothesis: string, logs: string[], commit: string) {
      await slack.chat.postMessage({
        channel: '#debug',
        text: `SESSION_DROP in SessionManager.startSession, likely due to ${commit}. Check logs: ${logs.join('\n')}. Chat: http://tracepulse.app/chat`
      });
    }
    ```
  - Build Hono-based chat UI endpoint:
    ```typescript
    app.get('/chat', (c) => {
      // Simple HTML/JSON for Slack-style chat; use WebSocket for real-time if needed
      return c.html('<div>TracePulse Chat UI</div>');
    });

    app.post('/chat/feedback', async (c) => {
      const { feedback, userId } = await c.req.json();
      // Store feedback in Redis and refine model
      await redis.set(`feedback:${userId}`, feedback);
      return c.json({ status: 'refined' });
    });
    ```

### Deployment
- Package as Docker container: `docker build -t tracepulse .`.
- Deploy to Kubernetes or edge (e.g., EV stations) with `kubectl apply` or edge runtime.
- Configure env vars: Loki/ELK endpoints, GitHub token, Slack token, OpenAI key.

### Next Steps
- Publish `debug-queue` to npm/GitHub.
- Test with synthetic EV session logs.
- Beta with EV startups for feedback.
- Add OpenTelemetry auto-discovery post-MVP.

**Contact**: Ready to build TracePulse? Let’s debug EV sessions faster!
