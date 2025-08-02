import type { WebhookEvent } from '../types';
import { logger } from '../lib/logger';
import { getSystemMap } from '../lib/systemMap';
import { analyzeEvent } from './ai';

export async function processEvents(events: WebhookEvent[], environment?: string): Promise<void> {
  logger.info('EVENT_PROCESSING_START', {
    eventCount: events.length,
    environment
  });

  // Group events by correlation ID
  const correlatedEvents = new Map<string, WebhookEvent[]>();
  
  for (const event of events) {
    const correlationId = event.correlationId || 'uncorrelated';
    if (!correlatedEvents.has(correlationId)) {
      correlatedEvents.set(correlationId, []);
    }
    correlatedEvents.get(correlationId)!.push(event);
  }

  // Process each correlation group
  for (const [correlationId, groupedEvents] of correlatedEvents) {
    try {
      await processCorrelatedEvents(correlationId, groupedEvents, environment);
    } catch (error) {
      logger.error('CORRELATION_PROCESSING_FAILED', error as Error, {
        correlationId,
        eventCount: groupedEvents.length
      });
    }
  }
}

async function processCorrelatedEvents(
  correlationId: string, 
  events: WebhookEvent[], 
  environment?: string
): Promise<void> {
  // Filter for critical events
  const criticalEvents = events.filter(e => 
    e.priority === 'high' || 
    e.level === 'error' || 
    e.level === 'critical'
  );

  if (criticalEvents.length === 0) {
    logger.info('NO_CRITICAL_EVENTS', { correlationId, eventCount: events.length });
    return;
  }

  logger.info('ANALYZING_CRITICAL_EVENTS', {
    correlationId,
    criticalCount: criticalEvents.length,
    eventTypes: criticalEvents.map(e => e.eventType)
  });

  try {
    // Get system map
    const systemMap = await getSystemMap();
    
    // Analyze events with AI
    const report = await analyzeEvent(criticalEvents[0]!, {
      relatedEvents: events,
      systemMap,
      environment
    });

    // Log report (will be replaced with Cursor export)
    if (report) {
      logger.info('REPORT_GENERATED', {
        correlationId,
        hypothesesCount: report.hypotheses.length,
        summary: report.summary
      });
    }
  } catch (error) {
    logger.error('EVENT_ANALYSIS_FAILED', error as Error, {
      correlationId,
      eventCount: events.length
    });
  }
}