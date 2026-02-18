import { z } from 'zod'

export const createEndpointSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().optional(),
  description: z.string().max(500).optional(),
  response_code: z.number().int().min(100).max(599).optional(),
  response_body: z.string().max(10000).optional(),
  response_headers: z.record(z.string(), z.string()).optional(),
})

export const updateEndpointSchema = createEndpointSchema.partial().extend({
  is_active: z.boolean().optional(),
})

export const analyzeRequestSchema = z.object({
  requestId: z.string().uuid(),
})

export const replayRequestSchema = z.object({
  requestId: z.string().uuid(),
  targetUrl: z.string().url(),
})
