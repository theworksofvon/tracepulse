import { Hono } from 'hono';
import { WebhookPayloadSchema } from '../types';
import { logger } from '../lib/logger';
import { processEvents } from '../services/eventProcessor';

const webhook = new Hono();

webhook.post('/event', async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate payload
    const result = WebhookPayloadSchema.safeParse(body);
    if (!result.success) {
      logger.warn('WEBHOOK_INVALID_PAYLOAD', {
        errors: result.error.flatten(),
        body
      });
      
      return c.json({ 
        error: 'Invalid payload', 
        details: result.error.flatten() 
      }, 400);
    }

    const { events, environment } = result.data;
    
    logger.info('WEBHOOK_RECEIVED', {
      eventCount: events.length,
      environment,
      eventTypes: events.map(e => e.eventType)
    });

    // Process events asynchronously
    processEvents(events, environment).catch((error) => {
      logger.error('EVENT_PROCESSING_FAILED', error as Error, {
        eventCount: events.length
      });
    });

    return c.json({ 
      status: 'accepted',
      message: `Processing ${events.length} events`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('WEBHOOK_ERROR', error as Error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

webhook.get('/event', (c) => {
  return c.json({ 
    error: 'Method not allowed',
    message: 'Use POST to send events' 
  }, 405);
});

export default webhook;