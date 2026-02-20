import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'

// Mock dependencies
const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

const mockAdminFrom = vi.fn()
const mockAdminRpc = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: mockAdminFrom,
    rpc: mockAdminRpc,
  })),
}))

const mockAnalyzeWebhook = vi.fn()
vi.mock('@/lib/anthropic', () => ({
  analyzeWebhook: (...args: unknown[]) => mockAnalyzeWebhook(...args),
}))

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const mockAnalysis = {
  source: 'Stripe',
  webhook_type: 'payment_intent.succeeded',
  summary: 'A payment was successful.',
  key_fields: [{ path: 'data.object.id', description: 'Payment intent ID' }],
  schema_notes: 'Looks standard',
  handler_node: '// handler code',
  handler_python: '# handler code',
}

const mockWebhookRequest = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{"type":"payment_intent.succeeded"}',
  content_type: 'application/json',
  endpoint: { user_id: 'user-1' },
}

describe('POST /api/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await POST(makeRequest({ requestId: '123e4567-e89b-12d3-a456-426614174000' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid request body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const res = await POST(makeRequest({ requestId: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when webhook request is not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null }),
        }),
      }),
    }))

    const res = await POST(makeRequest({ requestId: '123e4567-e89b-12d3-a456-426614174000' }))
    expect(res.status).toBe(404)
  })

  it('returns 429 when analysis limit is reached', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    // Request found
    mockFrom.mockImplementation((table: string) => {
      if (table === 'requests') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockWebhookRequest }),
            }),
          }),
        }
      }
      if (table === 'subscriptions') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { plan: 'free', status: 'active' } }),
            }),
          }),
        }
      }
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }
    })

    // Usage at limit (free = 5)
    mockAdminRpc.mockResolvedValue({ data: [{ ai_analysis_count: 5 }] })

    const res = await POST(makeRequest({ requestId: '123e4567-e89b-12d3-a456-426614174000' }))
    expect(res.status).toBe(429)
  })

  it('returns analysis on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'requests') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockWebhookRequest }),
            }),
          }),
        }
      }
      if (table === 'subscriptions') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { plan: 'free', status: 'active' } }),
            }),
          }),
        }
      }
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }
    })

    // Usage under limit
    mockAdminRpc.mockResolvedValue({ data: [{ ai_analysis_count: 2 }] })

    // Admin update call
    mockAdminFrom.mockImplementation(() => ({
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }))

    mockAnalyzeWebhook.mockResolvedValue(mockAnalysis)

    const res = await POST(makeRequest({ requestId: '123e4567-e89b-12d3-a456-426614174000' }))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.source).toBe('Stripe')
    expect(data.webhook_type).toBe('payment_intent.succeeded')

    expect(mockAnalyzeWebhook).toHaveBeenCalledWith(
      'POST',
      { 'content-type': 'application/json' },
      '{"type":"payment_intent.succeeded"}',
      'application/json'
    )
  })

  it('returns 502 with service unavailable when Anthropic API fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'requests') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockWebhookRequest }),
            }),
          }),
        }
      }
      if (table === 'subscriptions') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { plan: 'free', status: 'active' } }),
            }),
          }),
        }
      }
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }
    })

    // Usage under limit
    mockAdminRpc.mockResolvedValue({ data: [{ ai_analysis_count: 2 }] })

    // Anthropic API error (e.g., rate limit)
    const { APIError } = await import('@anthropic-ai/sdk')
    mockAnalyzeWebhook.mockRejectedValue(new APIError(429, undefined, 'Rate limited', undefined))

    const res = await POST(makeRequest({ requestId: '123e4567-e89b-12d3-a456-426614174000' }))
    expect(res.status).toBe(502)

    const data = await res.json()
    expect(data.error).toBe('AI service unavailable')
  })

  it('returns 502 when AI returns unparseable response', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'requests') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockWebhookRequest }),
            }),
          }),
        }
      }
      if (table === 'subscriptions') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { plan: 'free', status: 'active' } }),
            }),
          }),
        }
      }
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }
    })

    // Usage under limit
    mockAdminRpc.mockResolvedValue({ data: [{ ai_analysis_count: 2 }] })

    // AI returns invalid response
    mockAnalyzeWebhook.mockRejectedValue(new Error('Unexpected end of JSON input'))

    const res = await POST(makeRequest({ requestId: '123e4567-e89b-12d3-a456-426614174000' }))
    expect(res.status).toBe(502)

    const data = await res.json()
    expect(data.error).toBe('AI analysis produced an invalid response')
  })
})
