import OpenAI from 'openai';
import { WebhookEvent, SystemMap, AnalysisReport, Hypothesis } from '../types';
import { analyzeImpact } from '../lib/systemMap';
import { logger } from '../lib/logger';
import { getRecentDiffs } from './github';

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

interface AnalysisContext {
  relatedEvents: WebhookEvent[];
  systemMap: SystemMap;
  environment?: string;
  recentDiffs?: string[];
}

export async function analyzeEvent(
  event: WebhookEvent,
  context: AnalysisContext
): Promise<AnalysisReport | null> {
  try {
    logger.info('AI_ANALYSIS_START', {
      eventType: event.eventType,
      correlationId: event.correlationId
    });

    // Get affected services from system map
    const affectedService = event.service || event.details.service || 'Unknown';
    const impact = analyzeImpact(affectedService, context.systemMap);

    // Get recent code changes if available
    const recentDiffs = await getRecentDiffs(affectedService);

    // Build context for AI
    const systemContext = buildSystemContext(event, context, impact, recentDiffs);

    // Generate hypotheses using AI
    const hypotheses = await generateHypotheses(systemContext);

    const report: AnalysisReport = {
      correlationId: event.correlationId || 'unknown',
      eventType: event.eventType,
      timestamp: new Date().toISOString(),
      hypotheses,
      affectedServices: [affectedService, ...impact.allDependents],
      summary: generateSummary(event, hypotheses)
    };

    logger.info('AI_ANALYSIS_COMPLETE', {
      correlationId: event.correlationId,
      hypothesesCount: hypotheses.length
    });

    return report;
  } catch (error) {
    logger.error('AI_ANALYSIS_ERROR', error as Error, {
      eventType: event.eventType
    });
    return null;
  }
}

function buildSystemContext(
  event: WebhookEvent,
  context: AnalysisContext,
  impact: ReturnType<typeof analyzeImpact>,
  recentDiffs?: string[]
): string {
  const relatedEventsSummary = context.relatedEvents
    .map(e => `- ${e.timestamp}: ${e.eventType} in ${e.service} (${e.level})`)
    .join('\n');

  return `
## Critical Event Analysis

**Primary Event**: ${event.eventType}
**Service**: ${event.service || 'Unknown'}
**Error Code**: ${event.metadata?.errorCode || 'N/A'}
**Timestamp**: ${event.timestamp}
**Environment**: ${context.environment || 'Unknown'}

**Event Details**:
${JSON.stringify(event.details, null, 2)}

**Related Events in Transaction**:
${relatedEventsSummary}

**System Architecture Impact**:
- Direct Dependencies: ${impact.dependencies.join(', ') || 'None'}
- Direct Dependents: ${impact.directDependents.join(', ') || 'None'}
- Potential Cascade Impact: ${impact.allDependents.join(', ') || 'None'}

**Recent Code Changes**:
${recentDiffs?.length ? recentDiffs.join('\n---\n') : 'No recent changes detected'}

Based on this information, identify the most likely root causes for this failure.
Focus on:
1. Service dependencies and potential cascade failures
2. Recent code changes that might have introduced the issue
3. Patterns in the related events that suggest the failure point
4. Specific error codes or details that indicate the problem

Provide actionable hypotheses with confidence levels.
`;
}

async function generateHypotheses(context: string): Promise<Hypothesis[]> {
  try {
    const client = getOpenAI();
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an expert debugging assistant analyzing system failures. 
          Provide specific, actionable hypotheses for the root cause of failures.
          Each hypothesis should include:
          - A clear title
          - Detailed description
          - Confidence level (0-100)
          - Supporting evidence
          - Suggested actions to verify or fix
          - Related services affected
          
          Format your response as a JSON array of hypotheses.`
        },
        {
          role: 'user',
          content: context
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    const hypotheses = result.hypotheses || [];

    return hypotheses.map((h: any, index: number) => ({
      id: `hyp-${Date.now()}-${index}`,
      title: h.title || 'Unknown Issue',
      description: h.description || '',
      confidence: h.confidence || 50,
      evidence: (h.evidence || []).map((e: any) => ({
        type: e.type || 'log',
        source: e.source || 'unknown',
        detail: e.detail || '',
        confidence: e.confidence || 50
      })),
      suggestedActions: h.suggestedActions || [],
      relatedServices: h.relatedServices || []
    }));
  } catch (error) {
    logger.error('AI_HYPOTHESIS_GENERATION_ERROR', error as Error);
    return getFallbackHypotheses(context);
  }
}

function getFallbackHypotheses(context: string): Hypothesis[] {
  // Basic rule-based fallback when AI fails
  return [{
    id: `hyp-${Date.now()}-0`,
    title: 'Service Dependency Failure',
    description: 'The failure appears to be related to a service dependency issue based on the error pattern.',
    confidence: 60,
    evidence: [{
      type: 'log',
      source: 'Event Analysis',
      detail: 'Critical error detected in service communication',
      confidence: 70
    }],
    suggestedActions: [
      'Check service health endpoints',
      'Review recent deployments',
      'Examine service logs for connection errors'
    ],
    relatedServices: []
  }];
}

function generateSummary(event: WebhookEvent, hypotheses: Hypothesis[]): string {
  const topHypothesis = hypotheses.sort((a, b) => b.confidence - a.confidence)[0];
  
  return `Critical ${event.eventType} event detected in ${event.service || 'unknown service'}. ` +
    `Most likely cause: ${topHypothesis?.title || 'Unknown'} ` +
    `(${topHypothesis?.confidence || 0}% confidence). ` +
    `${hypotheses.length} hypotheses generated for investigation.`;
}