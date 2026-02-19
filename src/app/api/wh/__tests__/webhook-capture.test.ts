import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the admin client before importing the handler
const mockRpc = vi.fn()

const mockFrom = vi.fn()
const mockSupabase = {
  from: mockFrom,
  rpc: mockRpc,
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockSupabase,
}))

// Mock the rate limit module
const mockCheckSlugRateLimit = vi.fn()
const mockCheckIpRateLimit = vi.fn()

vi.mock('@/lib/rate-limit', () => ({
  checkSlugRateLimit: (...args: unknown[]) => mockCheckSlugRateLimit(...args),
  checkIpRateLimit: (...args: unknown[]) => mockCheckIpRateLimit(...args),
}))

// Import the handler after mocking
import { handleWebhook } from '../[slug]/route'

// Helper to create a NextRequest with the right shape
function createRequest(
  method: string,
  options: {
    body?: string
    headers?: Record<string, string>
    searchParams?: Record<string, string>
  } = {}
) {
  const url = new URL('http://localhost:3000/api/wh/test-slug')
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value)
    }
  }

  const init: RequestInit = {
    method,
    headers: options.headers ?? {},
  }

  if (options.body && method !== 'GET' && method !== 'HEAD') {
    init.body = options.body
  }

  return new NextRequest(url, init)
}

// Default mock endpoint
const mockEndpoint = {
  id: 'endpoint-123',
  user_id: 'user-456',
  name: 'Test Endpoint',
  slug: 'test-slug',
  description: '',
  response_code: 200,
  response_body: '{"ok": true}',
  response_headers: { 'Content-Type': 'application/json' },
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

// Default passing rate limit result
const passingRateLimit = {
  success: true,
  limit: 60,
  remaining: 59,
  reset: Date.now() + 60_000,
}

// Default failing rate limit result
function failingRateLimit(limit: number, remaining = 0) {
  return {
    success: false,
    limit,
    remaining,
    reset: Date.now() + 30_000,
  }
}

// Setup chainable mock for from().select().eq().single() pattern
function setupEndpointQuery(data: typeof mockEndpoint | null, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  }
  return chain
}

function setupSubscriptionQuery(
  data: { plan: string; status: string } | null,
  error: unknown = null
) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  }
  return chain
}

function setupInsert() {
  return {
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
}

describe('handleWebhook', () => {
  let endpointChain: ReturnType<typeof setupEndpointQuery>
  let subscriptionChain: ReturnType<typeof setupSubscriptionQuery>
  let insertChain: ReturnType<typeof setupInsert>

  beforeEach(() => {
    vi.clearAllMocks()

    endpointChain = setupEndpointQuery(mockEndpoint)
    subscriptionChain = setupSubscriptionQuery({ plan: 'free', status: 'active' })
    insertChain = setupInsert()

    // mockFrom returns different chains depending on the table
    mockFrom.mockImplementation((table: string) => {
      if (table === 'endpoints') return endpointChain
      if (table === 'subscriptions') return subscriptionChain
      if (table === 'requests') return insertChain
      return {}
    })

    // Default: usage under limit
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_current_usage') {
        return Promise.resolve({ data: [{ request_count: 5, ai_analysis_count: 0 }] })
      }
      if (fn === 'increment_request_count') {
        return Promise.resolve({ data: null, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    // Default: rate limits pass
    mockCheckSlugRateLimit.mockResolvedValue(passingRateLimit)
    mockCheckIpRateLimit.mockResolvedValue({ ...passingRateLimit, limit: 200 })
  })

  const params = Promise.resolve({ slug: 'test-slug' })

  it('returns configured response for valid POST with JSON body', async () => {
    const req = createRequest('POST', {
      body: '{"event": "test"}',
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toBe('{"ok": true}')
    expect(res.headers.get('Content-Type')).toBe('application/json')
  })

  it('includes X-RateLimit-Limit and X-RateLimit-Remaining headers on success', async () => {
    mockCheckSlugRateLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 42,
      reset: Date.now() + 60_000,
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(200)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('42')
  })

  it('returns 429 with Retry-After when slug rate limit is exceeded', async () => {
    const resetTime = Date.now() + 30_000
    mockCheckSlugRateLimit.mockResolvedValue({
      success: false,
      limit: 60,
      remaining: 0,
      reset: resetTime,
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toBe('Rate limit exceeded')
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  it('returns 429 with Retry-After when IP rate limit is exceeded', async () => {
    mockCheckSlugRateLimit.mockResolvedValue(passingRateLimit)

    const resetTime = Date.now() + 15_000
    mockCheckIpRateLimit.mockResolvedValue({
      success: false,
      limit: 200,
      remaining: 0,
      reset: resetTime,
    })

    const req = createRequest('POST', {
      body: '{}',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toBe('Rate limit exceeded')
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('200')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  it('does not query the database when slug rate limit is exceeded', async () => {
    mockCheckSlugRateLimit.mockResolvedValue(failingRateLimit(60))

    const req = createRequest('POST', { body: '{}' })
    await handleWebhook(req, { params })

    // Database should not be queried when rate limited
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('allows request through when rate limiter returns null (Redis unavailable)', async () => {
    mockCheckSlugRateLimit.mockResolvedValue(null)
    mockCheckIpRateLimit.mockResolvedValue(null)

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(200)
    // No rate limit headers when Redis is unavailable
    expect(res.headers.get('X-RateLimit-Limit')).toBeNull()
    expect(res.headers.get('X-RateLimit-Remaining')).toBeNull()
  })

  it('allows request through when rate limiting throws an error (fail open)', async () => {
    mockCheckSlugRateLimit.mockRejectedValue(new Error('Unexpected error'))
    mockCheckIpRateLimit.mockRejectedValue(new Error('Unexpected error'))

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(200)
  })

  it('captures GET requests with query params correctly', async () => {
    const req = createRequest('GET', {
      searchParams: { callback: 'true', verify: 'abc123' },
    })

    const res = await handleWebhook(req, { params })
    expect(res.status).toBe(200)

    // Verify the insert was called with correct query params
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        query_params: { callback: 'true', verify: 'abc123' },
      })
    )
  })

  it('returns 404 for unknown slug', async () => {
    endpointChain = setupEndpointQuery(null, { code: 'PGRST116' })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'endpoints') return endpointChain
      return {}
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Not found')
  })

  it('returns 410 for inactive endpoint', async () => {
    endpointChain = setupEndpointQuery({ ...mockEndpoint, is_active: false })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'endpoints') return endpointChain
      return {}
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(410)
    const json = await res.json()
    expect(json.error).toBe('Endpoint inactive')
  })

  it('returns 413 for body exceeding 1MB', async () => {
    const largeBody = 'x'.repeat(1_048_577) // 1MB + 1 byte
    const req = createRequest('POST', { body: largeBody })

    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(413)
    const json = await res.json()
    expect(json.error).toBe('Payload too large')
  })

  it('returns 429 when monthly request limit is exceeded', async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_current_usage') {
        return Promise.resolve({ data: [{ request_count: 100, ai_analysis_count: 0 }] })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toBe('Monthly request limit reached')
  })

  it('does not enforce limit for pro users', async () => {
    subscriptionChain = setupSubscriptionQuery({ plan: 'pro', status: 'active' })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'endpoints') return endpointChain
      if (table === 'subscriptions') return subscriptionChain
      if (table === 'requests') return insertChain
      return {}
    })

    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_current_usage') {
        return Promise.resolve({ data: [{ request_count: 999999, ai_analysis_count: 0 }] })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const req = createRequest('POST', { body: '{"test": true}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(200)
  })

  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const)(
    'handles %s method correctly',
    async (method) => {
      const opts: Parameters<typeof createRequest>[1] = {}
      if (method !== 'GET') {
        opts.body = '{"method_test": true}'
      }
      const req = createRequest(method, opts)

      const res = await handleWebhook(req, { params })
      expect(res.status).toBe(200)

      expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({ method }))
    }
  )

  it('captures headers in the insert call', async () => {
    const req = createRequest('POST', {
      body: '{}',
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'test-value',
        Authorization: 'Bearer fake-token',
      },
    })

    const res = await handleWebhook(req, { params })
    expect(res.status).toBe(200)

    const insertArg = insertChain.insert.mock.calls[0][0]
    expect(insertArg.headers).toMatchObject({
      'content-type': 'application/json',
      'x-custom-header': 'test-value',
      authorization: 'Bearer fake-token',
    })
    expect(insertArg.content_type).toBe('application/json')
  })

  it('calls increment_request_count with correct user_id', async () => {
    const req = createRequest('POST', { body: '{}' })

    await handleWebhook(req, { params })

    expect(mockRpc).toHaveBeenCalledWith('increment_request_count', {
      p_user_id: 'user-456',
    })
  })

  it('returns custom response code, body, and headers', async () => {
    const customEndpoint = {
      ...mockEndpoint,
      response_code: 202,
      response_body: 'Accepted',
      response_headers: { 'X-Custom': 'value', 'Content-Type': 'text/plain' },
    }
    endpointChain = setupEndpointQuery(customEndpoint)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'endpoints') return endpointChain
      if (table === 'subscriptions') return subscriptionChain
      if (table === 'requests') return insertChain
      return {}
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(202)
    const body = await res.text()
    expect(body).toBe('Accepted')
    expect(res.headers.get('X-Custom')).toBe('value')
    expect(res.headers.get('Content-Type')).toBe('text/plain')
  })

  it('calculates size_bytes from body content', async () => {
    const body = '{"hello": "world"}'
    const req = createRequest('POST', { body })

    await handleWebhook(req, { params })

    const insertArg = insertChain.insert.mock.calls[0][0]
    expect(insertArg.size_bytes).toBe(new TextEncoder().encode(body).length)
  })

  it('handles empty body correctly', async () => {
    const req = createRequest('GET')

    await handleWebhook(req, { params })

    const insertArg = insertChain.insert.mock.calls[0][0]
    expect(insertArg.body).toBeNull()
    expect(insertArg.size_bytes).toBe(0)
  })

  it('captures source IP from x-forwarded-for header', async () => {
    const req = createRequest('POST', {
      body: '{}',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })

    await handleWebhook(req, { params })

    const insertArg = insertChain.insert.mock.calls[0][0]
    expect(insertArg.source_ip).toBe('1.2.3.4')
  })

  it('extracts the first IP from a comma-separated x-forwarded-for header', async () => {
    const req = createRequest('POST', {
      body: '{}',
      headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 172.16.0.5' },
    })

    await handleWebhook(req, { params })

    const insertArg = insertChain.insert.mock.calls[0][0]
    expect(insertArg.source_ip).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
    const req = createRequest('POST', {
      body: '{}',
      headers: { 'x-real-ip': '5.6.7.8' },
    })

    await handleWebhook(req, { params })

    const insertArg = insertChain.insert.mock.calls[0][0]
    expect(insertArg.source_ip).toBe('5.6.7.8')
  })

  it('does not call checkIpRateLimit when IP is unknown', async () => {
    // No IP headers — sourceIp will be 'unknown'
    const req = createRequest('POST', { body: '{}' })

    await handleWebhook(req, { params })

    expect(mockCheckIpRateLimit).not.toHaveBeenCalled()
  })

  it('passes the correct slug key to checkSlugRateLimit', async () => {
    mockCheckSlugRateLimit.mockResolvedValue(passingRateLimit)
    const req = createRequest('POST', { body: '{}' })

    await handleWebhook(req, { params })

    expect(mockCheckSlugRateLimit).toHaveBeenCalledWith('test-slug')
  })

  it('passes the correct IP key to checkIpRateLimit', async () => {
    const req = createRequest('POST', {
      body: '{}',
      headers: { 'x-forwarded-for': '9.8.7.6' },
    })

    await handleWebhook(req, { params })

    expect(mockCheckIpRateLimit).toHaveBeenCalledWith('9.8.7.6')
  })

  it('includes rate limit headers on 404 response', async () => {
    endpointChain = setupEndpointQuery(null, { code: 'PGRST116' })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'endpoints') return endpointChain
      return {}
    })
    mockCheckSlugRateLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 55,
      reset: Date.now() + 60_000,
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(404)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('55')
  })

  it('includes rate limit headers on 410 response', async () => {
    endpointChain = setupEndpointQuery({ ...mockEndpoint, is_active: false })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'endpoints') return endpointChain
      return {}
    })
    mockCheckSlugRateLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 50,
      reset: Date.now() + 60_000,
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(410)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('50')
  })

  it('includes rate limit headers on 413 response', async () => {
    mockCheckSlugRateLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 45,
      reset: Date.now() + 60_000,
    })
    const largeBody = 'x'.repeat(1_048_577)
    const req = createRequest('POST', { body: largeBody })

    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(413)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('45')
  })

  it('includes rate limit headers on monthly 429 response', async () => {
    mockCheckSlugRateLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 30,
      reset: Date.now() + 60_000,
    })
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_current_usage') {
        return Promise.resolve({ data: [{ request_count: 100, ai_analysis_count: 0 }] })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(429)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('30')
  })

  it('handles no subscription row (defaults to free)', async () => {
    subscriptionChain = setupSubscriptionQuery(null, { code: 'PGRST116' })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'endpoints') return endpointChain
      if (table === 'subscriptions') return subscriptionChain
      if (table === 'requests') return insertChain
      return {}
    })

    // Under the free limit, should succeed
    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(200)
  })
})
