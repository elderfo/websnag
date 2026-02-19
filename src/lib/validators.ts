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

// Username: 3-32 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens
// Regex: start with alnum, then 1-30 alnum-or-hyphen chars, end with alnum (enforces 3-32 total)
export const usernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(
    /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/,
    'Must be 3-32 chars, lowercase alphanumeric and hyphens, no leading/trailing hyphens'
  )

export const setUsernameSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(
      /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/,
      'Must be 3-32 chars, lowercase alphanumeric and hyphens, no leading/trailing hyphens'
    ),
})
