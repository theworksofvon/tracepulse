import type { Context, Next } from 'hono';
import { logger } from './logger';

export async function authMiddleware(c: Context, next: Next) {
  const apiKey = c.req.header('X-API-Key');
  
  if (!apiKey) {
    logger.warn('AUTH_MISSING_API_KEY', {
      ip: c.req.header('X-Forwarded-For') || 'unknown',
      userAgent: c.req.header('User-Agent') || 'unknown'
    });
    
    return c.json({ error: 'Missing API key' }, 401);
  }

  // In production, validate against stored API keys
  const validApiKeys = [
    process.env.INTERNAL_API_KEY || 'internal-dev-key',
    process.env.EXTERNAL_API_KEY || 'dev-api-key'
  ];

  if (!validApiKeys.includes(apiKey)) {
    logger.warn('AUTH_INVALID_API_KEY', {
      ip: c.req.header('X-Forwarded-For') || 'unknown',
      userAgent: c.req.header('User-Agent') || 'unknown'
    });
    
    return c.json({ error: 'Invalid API key' }, 401);
  }

  // Add authenticated context
  c.set('apiKey', apiKey);
  c.set('isInternal', apiKey === (process.env.INTERNAL_API_KEY || 'internal-dev-key'));
  
  await next();
}