import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import webhookRoutes from './routes/webhook';
import { authMiddleware } from './lib/auth';
import { connectRedis } from './services/redis';
import { logger } from './lib/logger';

const app = new Hono();

// Global middleware
app.use('*', honoLogger());
app.use('*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    service: 'tracepulse',
    timestamp: new Date().toISOString() 
  });
});

// Protected routes
app.use('/webhook/*', authMiddleware);

// Routes
app.route('/webhook', webhookRoutes);

// Initialize services
async function startServer() {
  try {
    // Connect to Redis (optional for testing)
    if (process.env.REDIS_URL) {
      await connectRedis();
      logger.info('REDIS_CONNECTED');
    } else {
      logger.warn('REDIS_DISABLED', { reason: 'No REDIS_URL provided' });
    }
    
    const port = process.env.PORT || 3001;
    logger.info('SERVER_START', {
      port,
      environment: process.env.NODE_ENV || 'development'
    });

    console.log(`TracePulse server running on http://localhost:${port}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    logger.error('SERVER_START_FAILED', error as Error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SERVER_SHUTDOWN', { reason: 'SIGTERM' });
  process.exit(0);
});

startServer();

export default {
  port: process.env.PORT || 3001,
  fetch: app.fetch,
};