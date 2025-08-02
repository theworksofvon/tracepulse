#!/usr/bin/env bun
// Test script to verify TracePulse webhook functionality

import { debugQueue } from './packages/debug-queue/src';

async function testWebhook() {
  console.log('🧪 Testing TracePulse webhook integration...\n');

  // Configure debug-queue to send to local TracePulse
  debugQueue.configure({
    endpoint: 'http://localhost:3000/webhook/event',
    apiKey: 'dev-api-key',
    service: 'test-client',
    environment: 'test'
  });

  // Test 1: Send a critical error event
  console.log('📤 Sending critical error event...');
  await debugQueue.critical('SESSION_DROP', {
    service: 'SessionManager',
    errorCode: 'TIMEOUT',
    userId: 'test-123',
    sessionId: 'session-abc',
    edgeDevice: 'EV-Station-01',
    details: {
      duration: 5000,
      lastActivity: new Date().toISOString()
    }
  }, {
    correlationId: 'test-correlation-001',
    priority: 'high'
  });

  // Test 2: Send related warning events
  console.log('📤 Sending related warning events...');
  await debugQueue.warn('HIGH_LATENCY', {
    service: 'EdgeDevice',
    endpoint: '/api/v1/device/status',
    responseTime: 8500,
    threshold: 5000
  }, {
    correlationId: 'test-correlation-001'
  });

  // Test 3: Send info event
  await debugQueue.info('PAYMENT_INITIATED', {
    service: 'PaymentService',
    amount: 25.50,
    currency: 'USD',
    userId: 'test-123'
  }, {
    correlationId: 'test-correlation-001'
  });

  // Flush events
  console.log('⏳ Flushing events...');
  await debugQueue.flush();

  console.log('✅ Test events sent successfully!');
  console.log('\n📊 Check the TracePulse logs to see the events being processed.');
  console.log('🔍 If Slack is configured, you should receive an alert for the critical event.\n');

  // Cleanup
  debugQueue.destroy();
}

// Run the test
testWebhook().catch(console.error);