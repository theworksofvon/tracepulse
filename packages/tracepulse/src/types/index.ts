import { z } from 'zod';

// Webhook event schema
export const WebhookEventSchema = z.object({
  eventType: z.string(),
  correlationId: z.string().optional(),
  service: z.string().optional(),
  level: z.enum(['debug', 'info', 'warn', 'error', 'critical']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  timestamp: z.string().optional(),
  details: z.record(z.any()),
  metadata: z.object({
    errorCode: z.string().optional(),
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    edgeDevice: z.string().optional(),
  }).passthrough().optional(),
});

export const WebhookPayloadSchema = z.object({
  events: z.array(WebhookEventSchema),
  environment: z.string().optional(),
});

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// System map types
export interface SystemMapService {
  file?: string;
  functions?: string[];
  depends_on?: string[];
  endpoints?: string[];
  description?: string;
}

export interface SystemMap {
  services: Record<string, SystemMapService>;
  version?: string;
  updated_at?: string;
}

// Analysis types
export interface HypothesisEvidence {
  type: 'log' | 'diff' | 'system_map' | 'correlation';
  source: string;
  detail: string;
  confidence: number;
}

export interface Hypothesis {
  id: string;
  title: string;
  description: string;
  confidence: number;
  evidence: HypothesisEvidence[];
  suggestedActions: string[];
  relatedServices: string[];
}

export interface AnalysisReport {
  correlationId: string;
  eventType: string;
  timestamp: string;
  hypotheses: Hypothesis[];
  affectedServices: string[];
  summary: string;
}