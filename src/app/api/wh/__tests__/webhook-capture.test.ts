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

// Mock the logger module
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    requestId: 'test-request-id',
  }),
}))

// Mock the rate limit module
const mockCheckSlugRateLimit = vi.fn()
const mockCheckIpRateLimit = vi.fn()
const mockCheckAccountRateLimit = vi.fn()

const passingFallback = { success: true, limit: 100, remaining: 99, reset: Date.now() + 60_000 }

vi.mock('@/lib/rate-limit', () => ({
  checkSlugRateLimit: (...args: unknown[]) => mockCheckSlugRateLimit(...args),
  checkIpRateLimit: (...args: unknown[]) => mockCheckIpRateLimit(...args),
  checkAccountRateLimit: (...args: unknown[]) => mockCheckAccountRateLimit(...args),
  fallbackSlugCheck: () => passingFallback,
  fallbackIpCheck: () => passingFallback,
  fallbackAccountCheck: () => passingFallback,
}))

// Import the handler after mocking — use the new [...segments] catch-all route
import { handleWebhook } from '../[...segments]/route'

// Helper to create a NextRequest with the right shape
function createRequest(
  method: string,
  options: {
    body?: string
    headers?: Record<string, string>
    searchParams?: Record<string, string>
  } = {}
) {
  const url = new URL('http://localhost:3000/api/wh/johndoe/test-slug')
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value)
    }
  }

  const init: {
    method: string
    headers: Record<string, string>
    body?: string
  } = {
    method,
    headers: options.headers ?? {},
  }

  if (options.body && method !== 'GET' && method !== 'HEAD') {
    init.body = options.body
  }

  return new NextRequest(url, init)
}

// Default mock profile
const mockProfile = {
  id: 'user-456',
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
function setupProfileQuery(data: typeof mockProfile | null, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  }
  return chain
}

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

describe('handleWebhook (namespaced route /wh/[username]/[slug])', () => {
  let profileChain: ReturnType<typeof setupProfileQuery>
  let endpointChain: ReturnType<typeof setupEndpointQuery>
  let subscriptionChain: ReturnType<typeof setupSubscriptionQuery>
  let insertChain: ReturnType<typeof setupInsert>

  beforeEach(() => {
    vi.clearAllMocks()

    profileChain = setupProfileQuery(mockProfile)
    endpointChain = setupEndpointQuery(mockEndpoint)
    subscriptionChain = setupSubscriptionQuery({ plan: 'free', status: 'active' })
    insertChain = setupInsert()

    // mockFrom returns different chains depending on the table
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      if (table === 'endpoints') return endpointChain
      if (table === 'subscriptions') return subscriptionChain
      if (table === 'requests') return insertChain
      return {}
    })

    // Default: usage under limit (atomic check+increment)
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'try_increment_request_count') {
        return Promise.resolve({ data: true, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    // Default: rate limits pass
    mockCheckSlugRateLimit.mockResolvedValue(passingRateLimit)
    mockCheckIpRateLimit.mockResolvedValue({ ...passingRateLimit, limit: 200 })
    mockCheckAccountRateLimit.mockResolvedValue({ ...passingRateLimit, limit: 100 })
  })

  const params = Promise.resolve({ segments: ['johndoe', 'test-slug'] })

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

  it('returns 404 for unknown username (profile not found)', async () => {
    profileChain = setupProfileQuery(null, { code: 'PGRST116' })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      return {}
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Not found')
  })

  it('returns 404 for unknown slug (endpoint not found)', async () => {
    endpointChain = setupEndpointQuery(null, { code: 'PGRST116' })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      if (table === 'endpoints') return endpointChain
      return {}
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Not found')
  })

  it('returns identical 404 for inactive endpoint (no info leakage)', async () => {
    endpointChain = setupEndpointQuery({ ...mockEndpoint, is_active: false })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      if (table === 'endpoints') return endpointChain
      return {}
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Not found')
  })

  it('returns identical 404 when monthly request limit is exceeded (no info leakage)', async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'try_increment_request_count') {
        return Promise.resolve({ data: false, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Not found')
  })

  it('returns 413 for body exceeding 1MB', async () => {
    // Use multi-byte characters to test byte-length check (not character-length)
    const largeBody = 'x'.repeat(1_048_577) // 1MB + 1 byte (ASCII, so byte count == char count)
    const req = createRequest('POST', { body: largeBody })

    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(413)
    const json = await res.json()
    expect(json.error).toBe('Payload too large')
  })

  it('uses byte length not character length for size check (multi-byte chars)', async () => {
    // Each '€' is 3 bytes in UTF-8. 1_048_576 / 3 ≈ 349,525 chars to hit the limit.
    // Build a string just over 1MB in bytes using multi-byte chars.
    const repeatCount = Math.ceil(MAX_BODY_SIZE / 3) + 1
    const largeBody = '€'.repeat(repeatCount)
    // Byte length > 1MB, but character count < 1MB
    expect(new TextEncoder().encode(largeBody).length).toBeGreaterThan(MAX_BODY_SIZE)
    expect(largeBody.length).toBeLessThan(MAX_BODY_SIZE)

    const req = createRequest('POST', { body: largeBody })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(413)
  })

  it('rejects immediately when Content-Length header exceeds 1MB', async () => {
    // Small actual body but Content-Length claims 2MB
    const req = createRequest('POST', {
      body: '{"small": true}',
      headers: { 'Content-Length': '2000000' },
    })

    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(413)
    const json = await res.json()
    expect(json.error).toBe('Payload too large')
  })

  it('does not enforce limit for pro users', async () => {
    subscriptionChain = setupSubscriptionQuery({ plan: 'pro', status: 'active' })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      if (table === 'endpoints') return endpointChain
      if (table === 'subscriptions') return subscriptionChain
      if (table === 'requests') return insertChain
      return {}
    })

    // Pro users pass p_limit=0 which always returns true
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'try_increment_request_count') {
        return Promise.resolve({ data: true, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const req = createRequest('POST', { body: '{"test": true}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(200)

    // Verify it was called with p_limit=0 for pro
    expect(mockRpc).toHaveBeenCalledWith('try_increment_request_count', {
      p_user_id: 'user-456',
      p_limit: 0,
    })
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

  it('calls try_increment_request_count with correct user_id and free limit', async () => {
    const req = createRequest('POST', { body: '{}' })

    await handleWebhook(req, { params })

    expect(mockRpc).toHaveBeenCalledWith('try_increment_request_count', {
      p_user_id: 'user-456',
      p_limit: 100,
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
      if (table === 'profiles') return profileChain
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

  it('captures and anonymizes source IP from x-forwarded-for header', async () => {
    const req = createRequest('POST', {
      body: '{}',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })

    await handleWebhook(req, { params })

    const insertArg = insertChain.insert.mock.calls[0][0]
    expect(insertArg.source_ip).toBe('1.2.3.0')
  })

  it('takes the first IP from a comma-separated x-forwarded-for header and anonymizes it', async () => {
    const req = createRequest('POST', {
      body: '{}',
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' },
    })

    await handleWebhook(req, { params })

    const insertArg = insertChain.insert.mock.calls[0][0]
    expect(insertArg.source_ip).toBe('1.2.3.0')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent and anonymizes it', async () => {
    const req = createRequest('POST', {
      body: '{}',
      headers: { 'x-real-ip': '9.8.7.6' },
    })

    await handleWebhook(req, { params })

    const insertArg = insertChain.insert.mock.calls[0][0]
    expect(insertArg.source_ip).toBe('9.8.7.0')
  })

  it('stores null source_ip when IP is unknown', async () => {
    // No IP headers — source_ip should be null, not the string 'unknown'
    const req = createRequest('POST', { body: '{}' })

    await handleWebhook(req, { params })

    const insertArg = insertChain.insert.mock.calls[0][0]
    expect(insertArg.source_ip).toBeNull()
  })

  it('does not call checkIpRateLimit when source IP is unknown', async () => {
    // No IP headers provided
    const req = createRequest('POST', { body: '{}' })

    await handleWebhook(req, { params })

    expect(mockCheckIpRateLimit).not.toHaveBeenCalled()
  })

  it('handles no subscription row (defaults to free)', async () => {
    subscriptionChain = setupSubscriptionQuery(null, { code: 'PGRST116' })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
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

  it('logs but does not fail when request insert returns an error', async () => {
    const insertWithError = {
      insert: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB write failed' } }),
    }
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      if (table === 'endpoints') return endpointChain
      if (table === 'subscriptions') return subscriptionChain
      if (table === 'requests') return insertWithError
      return {}
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    // Insert failure now returns 500 so the webhook sender knows capture failed
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to capture request')
    expect(insertWithError.insert).toHaveBeenCalled()
  })

  it('returns 404 when try_increment_request_count RPC fails for free tier (fail closed)', async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'try_increment_request_count') {
        return Promise.resolve({ data: null, error: { message: 'RPC error' } })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    // Free tier fails closed to prevent unlimited usage on RPC error
    expect(res.status).toBe(404)
  })

  it('still captures request when try_increment_request_count RPC fails for pro tier (fail open)', async () => {
    subscriptionChain = setupSubscriptionQuery({ plan: 'pro', status: 'active' })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      if (table === 'endpoints') return endpointChain
      if (table === 'subscriptions') return subscriptionChain
      if (table === 'requests') return insertChain
      return {}
    })

    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'try_increment_request_count') {
        return Promise.resolve({ data: null, error: { message: 'RPC error' } })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    // Pro tier fails open — don't block paying customers
    expect(res.status).toBe(200)
  })

  it('returns 404 for 3-segment path (too many segments)', async () => {
    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, {
      params: Promise.resolve({ segments: ['a', 'b', 'c'] }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 500 and logs for unexpected thrown errors', async () => {
    // Make the profile lookup throw synchronously
    mockFrom.mockImplementation(() => {
      throw new Error('Unexpected DB failure')
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Internal server error')
  })

  it('returns 404 when cross-user access attempted (alice slug not accessible via bob)', async () => {
    // alice owns endpoint with slug "my-hook"; request for bob/my-hook should 404
    const aliceProfile = { id: 'alice-id' }
    const aliceProfileChain = setupProfileQuery(aliceProfile)

    // When looking up bob/my-hook, bob's profile is found but bob has no endpoint "my-hook"
    const bobProfile = { id: 'bob-id' }
    const bobProfileChain = setupProfileQuery(bobProfile)
    const noEndpointChain = setupEndpointQuery(null, { code: 'PGRST116' })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return bobProfileChain
      if (table === 'endpoints') return noEndpointChain
      return {}
    })

    const bobParams = Promise.resolve({ segments: ['bob', 'my-hook'] })
    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params: bobParams })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Not found')

    // Ensure alice's profile was never consulted for this request
    expect(aliceProfileChain.single).not.toHaveBeenCalled()
  })

  it('allows same slug for two different users (per-user slug scoping)', async () => {
    // alice/my-hook should work
    const aliceProfile = { id: 'alice-id' }
    const aliceEndpoint = { ...mockEndpoint, user_id: 'alice-id', slug: 'my-hook' }

    const aliceProfileChain = setupProfileQuery(aliceProfile)
    const aliceEndpointChain = setupEndpointQuery(aliceEndpoint)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return aliceProfileChain
      if (table === 'endpoints') return aliceEndpointChain
      if (table === 'subscriptions') return subscriptionChain
      if (table === 'requests') return insertChain
      return {}
    })

    const aliceParams = Promise.resolve({ segments: ['alice', 'my-hook'] })
    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params: aliceParams })

    expect(res.status).toBe(200)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Rate limiting tests
  // ─────────────────────────────────────────────────────────────────────────────

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

  it('includes rate limit headers on 404 responses', async () => {
    mockCheckSlugRateLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 55,
      reset: Date.now() + 60_000,
    })

    profileChain = setupProfileQuery(null, { code: 'PGRST116' })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      return {}
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(404)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('55')
  })

  it('includes rate limit headers on 413 responses', async () => {
    mockCheckSlugRateLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 50,
      reset: Date.now() + 60_000,
    })

    const largeBody = 'x'.repeat(1_048_577)
    const req = createRequest('POST', { body: largeBody })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(413)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('50')
  })

  it('includes rate limit headers on monthly-limit 404 responses', async () => {
    mockCheckSlugRateLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 45,
      reset: Date.now() + 60_000,
    })

    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'try_increment_request_count') {
        return Promise.resolve({ data: false, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(404)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('45')
  })

  it('allows request through when rate limiter returns null (Redis unavailable)', async () => {
    mockCheckSlugRateLimit.mockResolvedValue(null)
    mockCheckIpRateLimit.mockResolvedValue(null)
    mockCheckAccountRateLimit.mockResolvedValue(null)

    const req = createRequest('POST', {
      body: '{}',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(200)
    // No rate limit headers when Redis is unavailable
    expect(res.headers.get('X-RateLimit-Limit')).toBeNull()
    expect(res.headers.get('X-RateLimit-Remaining')).toBeNull()
  })

  it('allows request through when rate limiting throws an error (fail open)', async () => {
    mockCheckSlugRateLimit.mockRejectedValue(new Error('Unexpected Redis error'))
    mockCheckIpRateLimit.mockRejectedValue(new Error('Unexpected Redis error'))

    const req = createRequest('POST', {
      body: '{}',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Slug enumeration hardening (#10)
// ─────────────────────────────────────────────────────────────────────────────

describe('slug enumeration hardening (#10)', () => {
  let profileChain: ReturnType<typeof setupProfileQuery>
  let endpointChain: ReturnType<typeof setupEndpointQuery>
  let subscriptionChain: ReturnType<typeof setupSubscriptionQuery>

  const params = Promise.resolve({ segments: ['johndoe', 'test-slug'] })

  beforeEach(() => {
    vi.clearAllMocks()

    profileChain = setupProfileQuery(mockProfile)
    endpointChain = setupEndpointQuery(mockEndpoint)
    subscriptionChain = setupSubscriptionQuery({ plan: 'free', status: 'active' })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      if (table === 'endpoints') return endpointChain
      if (table === 'subscriptions') return subscriptionChain
      return {}
    })

    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'try_increment_request_count') {
        return Promise.resolve({ data: true, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    // Disable rate limit headers so comparison is clean
    mockCheckSlugRateLimit.mockResolvedValue(null)
    mockCheckIpRateLimit.mockResolvedValue(null)
    mockCheckAccountRateLimit.mockResolvedValue(null)
  })

  async function capture404Response(
    scenario: 'profile-not-found' | 'endpoint-not-found' | 'endpoint-inactive' | 'over-quota'
  ): Promise<{ status: number; body: string; headerEntries: [string, string][] }> {
    switch (scenario) {
      case 'profile-not-found': {
        const chain = setupProfileQuery(null, { code: 'PGRST116' })
        mockFrom.mockImplementation((table: string) => {
          if (table === 'profiles') return chain
          return {}
        })
        break
      }
      case 'endpoint-not-found': {
        const chain = setupEndpointQuery(null, { code: 'PGRST116' })
        mockFrom.mockImplementation((table: string) => {
          if (table === 'profiles') return profileChain
          if (table === 'endpoints') return chain
          return {}
        })
        break
      }
      case 'endpoint-inactive': {
        const chain = setupEndpointQuery({ ...mockEndpoint, is_active: false })
        mockFrom.mockImplementation((table: string) => {
          if (table === 'profiles') return profileChain
          if (table === 'endpoints') return chain
          return {}
        })
        break
      }
      case 'over-quota': {
        // Reset mockFrom to return an active endpoint so the over-quota branch is actually exercised
        const activeChain = setupEndpointQuery(mockEndpoint)
        const subChain = setupSubscriptionQuery({ plan: 'free', status: 'active' })
        mockFrom.mockImplementation((table: string) => {
          if (table === 'profiles') return profileChain
          if (table === 'endpoints') return activeChain
          if (table === 'subscriptions') return subChain
          return {}
        })
        mockRpc.mockImplementation((fn: string) => {
          if (fn === 'try_increment_request_count') {
            return Promise.resolve({ data: false, error: null })
          }
          return Promise.resolve({ data: null, error: null })
        })
        break
      }
    }

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })
    const body = await res.text()
    const headerEntries = [...res.headers.entries()].sort(([a], [b]) => a.localeCompare(b))

    return { status: res.status, body, headerEntries }
  }

  it('returns byte-identical response bodies for all 404 scenarios', async () => {
    const profileNotFound = await capture404Response('profile-not-found')
    const endpointNotFound = await capture404Response('endpoint-not-found')
    const endpointInactive = await capture404Response('endpoint-inactive')
    const overQuota = await capture404Response('over-quota')

    // All must be 404
    expect(profileNotFound.status).toBe(404)
    expect(endpointNotFound.status).toBe(404)
    expect(endpointInactive.status).toBe(404)
    expect(overQuota.status).toBe(404)

    // All response bodies must be byte-identical
    expect(endpointNotFound.body).toBe(profileNotFound.body)
    expect(endpointInactive.body).toBe(profileNotFound.body)
    expect(overQuota.body).toBe(profileNotFound.body)
  })

  it('returns identical headers (key+value) for all 404 scenarios', async () => {
    const profileNotFound = await capture404Response('profile-not-found')
    const endpointNotFound = await capture404Response('endpoint-not-found')
    const endpointInactive = await capture404Response('endpoint-inactive')
    const overQuota = await capture404Response('over-quota')

    // All header key+value pairs must be identical — prevents info leakage via differing headers
    expect(endpointNotFound.headerEntries).toEqual(profileNotFound.headerEntries)
    expect(endpointInactive.headerEntries).toEqual(profileNotFound.headerEntries)
    expect(overQuota.headerEntries).toEqual(profileNotFound.headerEntries)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Response header filtering (#62)
// ─────────────────────────────────────────────────────────────────────────────

describe('response header filtering (#62)', () => {
  let profileChain: ReturnType<typeof setupProfileQuery>
  let endpointChain: ReturnType<typeof setupEndpointQuery>
  let subscriptionChain: ReturnType<typeof setupSubscriptionQuery>
  let insertChain: ReturnType<typeof setupInsert>

  const params = Promise.resolve({ segments: ['johndoe', 'test-slug'] })

  beforeEach(() => {
    vi.clearAllMocks()

    profileChain = setupProfileQuery(mockProfile)
    subscriptionChain = setupSubscriptionQuery({ plan: 'free', status: 'active' })
    insertChain = setupInsert()

    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'try_increment_request_count') {
        return Promise.resolve({ data: true, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    mockCheckSlugRateLimit.mockResolvedValue(passingRateLimit)
    mockCheckIpRateLimit.mockResolvedValue({ ...passingRateLimit, limit: 200 })
    mockCheckAccountRateLimit.mockResolvedValue({ ...passingRateLimit, limit: 100 })
  })

  it('filters forbidden headers (Set-Cookie, Location) from user-configured response', async () => {
    const endpointWithForbiddenHeaders = {
      ...mockEndpoint,
      response_headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'evil=true',
        'X-Custom': 'allowed',
        Location: 'https://evil.com',
      },
    }
    endpointChain = setupEndpointQuery(endpointWithForbiddenHeaders)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      if (table === 'endpoints') return endpointChain
      if (table === 'subscriptions') return subscriptionChain
      if (table === 'requests') return insertChain
      return {}
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(200)
    // Allowed header should be present
    expect(res.headers.get('X-Custom')).toBe('allowed')
    // Forbidden headers must NOT be present
    expect(res.headers.get('Set-Cookie')).toBeNull()
    expect(res.headers.get('Location')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// IP anonymization (#70)
// ─────────────────────────────────────────────────────────────────────────────

describe('IP anonymization (#70)', () => {
  let profileChain: ReturnType<typeof setupProfileQuery>
  let endpointChain: ReturnType<typeof setupEndpointQuery>
  let subscriptionChain: ReturnType<typeof setupSubscriptionQuery>
  let insertChain: ReturnType<typeof setupInsert>

  const params = Promise.resolve({ segments: ['johndoe', 'test-slug'] })

  beforeEach(() => {
    vi.clearAllMocks()

    profileChain = setupProfileQuery(mockProfile)
    endpointChain = setupEndpointQuery(mockEndpoint)
    subscriptionChain = setupSubscriptionQuery({ plan: 'free', status: 'active' })
    insertChain = setupInsert()

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      if (table === 'endpoints') return endpointChain
      if (table === 'subscriptions') return subscriptionChain
      if (table === 'requests') return insertChain
      return {}
    })

    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'try_increment_request_count') {
        return Promise.resolve({ data: true, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    mockCheckSlugRateLimit.mockResolvedValue(passingRateLimit)
    mockCheckIpRateLimit.mockResolvedValue({ ...passingRateLimit, limit: 200 })
    mockCheckAccountRateLimit.mockResolvedValue({ ...passingRateLimit, limit: 100 })
  })

  it('zeroes the last octet of IPv4 addresses', async () => {
    const req = createRequest('POST', {
      body: '{}',
      headers: { 'x-forwarded-for': '192.168.1.42' },
    })

    await handleWebhook(req, { params })

    const insertArg = insertChain.insert.mock.calls[0][0]
    expect(insertArg.source_ip).toBe('192.168.1.0')
  })

  it('truncates IPv6 addresses to first 3 groups', async () => {
    const req = createRequest('POST', {
      body: '{}',
      headers: { 'x-forwarded-for': '2001:0db8:85a3:0000:0000:8a2e:0370:7334' },
    })

    await handleWebhook(req, { params })

    const insertArg = insertChain.insert.mock.calls[0][0]
    expect(insertArg.source_ip).toBe('2001:0db8:85a3:0:0:0:0:0')
  })

  it('stores null for unknown IPs', async () => {
    const req = createRequest('POST', { body: '{}' })

    await handleWebhook(req, { params })

    const insertArg = insertChain.insert.mock.calls[0][0]
    expect(insertArg.source_ip).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3xx redirect abuse prevention (#75)
// ─────────────────────────────────────────────────────────────────────────────

describe('3xx redirect abuse prevention (#75)', () => {
  let profileChain: ReturnType<typeof setupProfileQuery>
  let endpointChain: ReturnType<typeof setupEndpointQuery>
  let subscriptionChain: ReturnType<typeof setupSubscriptionQuery>
  let insertChain: ReturnType<typeof setupInsert>

  const params = Promise.resolve({ segments: ['johndoe', 'test-slug'] })

  beforeEach(() => {
    vi.clearAllMocks()

    profileChain = setupProfileQuery(mockProfile)
    subscriptionChain = setupSubscriptionQuery({ plan: 'free', status: 'active' })
    insertChain = setupInsert()

    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'try_increment_request_count') {
        return Promise.resolve({ data: true, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    mockCheckSlugRateLimit.mockResolvedValue(passingRateLimit)
    mockCheckIpRateLimit.mockResolvedValue({ ...passingRateLimit, limit: 200 })
    mockCheckAccountRateLimit.mockResolvedValue({ ...passingRateLimit, limit: 100 })
  })

  it.each([300, 301, 302, 303, 307, 308, 399])(
    'overrides stored %d status code to 200',
    async (code) => {
      const redirectEndpoint = { ...mockEndpoint, response_code: code }
      endpointChain = setupEndpointQuery(redirectEndpoint)

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain
        if (table === 'endpoints') return endpointChain
        if (table === 'subscriptions') return subscriptionChain
        if (table === 'requests') return insertChain
        return {}
      })

      const req = createRequest('POST', { body: '{}' })
      const res = await handleWebhook(req, { params })

      expect(res.status).toBe(200)
    }
  )

  it('does not override non-3xx status codes', async () => {
    const endpoint202 = { ...mockEndpoint, response_code: 202 }
    endpointChain = setupEndpointQuery(endpoint202)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      if (table === 'endpoints') return endpointChain
      if (table === 'subscriptions') return subscriptionChain
      if (table === 'requests') return insertChain
      return {}
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(202)
  })

  it('does not override 4xx status codes', async () => {
    const endpoint400 = { ...mockEndpoint, response_code: 400 }
    endpointChain = setupEndpointQuery(endpoint400)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      if (table === 'endpoints') return endpointChain
      if (table === 'subscriptions') return subscriptionChain
      if (table === 'requests') return insertChain
      return {}
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Constant exposed for test use
// ─────────────────────────────────────────────────────────────────────────────
const MAX_BODY_SIZE = 1_048_576
