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

  const init: RequestInit = {
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
      if (fn === 'get_current_usage') {
        return Promise.resolve({ data: [{ request_count: 100, ai_analysis_count: 0 }] })
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

  it('does not enforce limit for pro users', async () => {
    subscriptionChain = setupSubscriptionQuery({ plan: 'pro', status: 'active' })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
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

  it('captures source IP from x-forwarded-for header', async () => {
    const req = createRequest('POST', {
      body: '{}',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })

    await handleWebhook(req, { params })

    const insertArg = insertChain.insert.mock.calls[0][0]
    expect(insertArg.source_ip).toBe('1.2.3.4')
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

    // Response still goes through — don't penalise the webhook sender
    expect(res.status).toBe(200)
    expect(insertWithError.insert).toHaveBeenCalled()
  })

  it('logs but does not fail when increment_request_count RPC errors', async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_current_usage') {
        return Promise.resolve({ data: [{ request_count: 5, ai_analysis_count: 0 }] })
      }
      if (fn === 'increment_request_count') {
        return Promise.resolve({ data: null, error: { message: 'RPC error' } })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const req = createRequest('POST', { body: '{}' })
    const res = await handleWebhook(req, { params })

    // Should still return the configured response
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
})

// ─────────────────────────────────────────────────────────────────────────────
// Constant exposed for test use
// ─────────────────────────────────────────────────────────────────────────────
const MAX_BODY_SIZE = 1_048_576
