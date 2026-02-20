import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the admin client before importing the handler
const mockFrom = vi.fn()
const mockSupabase = {
  from: mockFrom,
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

// Import the catch-all handler — handles both legacy and namespaced routes
import { handleWebhook } from '../[...segments]/route'

// Helper to create a NextRequest
function createRequest(slug: string, method = 'POST', body = '{}') {
  const url = new URL(`http://localhost:3000/api/wh/${slug}`)
  return new NextRequest(url, { method, body: method !== 'GET' ? body : undefined })
}

// Setup chainable mock for from().select().eq().limit() or .single()
function setupQuerySingle(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    limit: vi.fn().mockResolvedValue({ data, error }),
  }
  return chain
}

function setupQueryLimit(data: unknown[], error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error }),
    single: vi.fn().mockResolvedValue({ data: data?.[0] ?? null, error }),
  }
  return chain
}

describe('handleWebhook (legacy redirect route /wh/[slug])', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 308 redirect to new namespaced URL when endpoint and profile exist', async () => {
    const endpointChain = setupQueryLimit([{ user_id: 'user-456', slug: 'my-webhook' }])
    const profileChain = setupQuerySingle({ username: 'johndoe' })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return endpointChain // endpoints lookup
      return profileChain // profiles lookup
    })

    const params = Promise.resolve({ segments: ['my-webhook'] })
    const req = createRequest('my-webhook')
    const res = await handleWebhook(req, { params })

    // 308 preserves the HTTP method — critical for POST webhooks
    expect(res.status).toBe(308)
    const location = res.headers.get('location')
    expect(location).toBe('http://localhost:3000/api/wh/johndoe/my-webhook')
  })

  it('uses 308 not 301 so POST method is preserved in redirect', async () => {
    const endpointChain = setupQueryLimit([{ user_id: 'user-456', slug: 'my-webhook' }])
    const profileChain = setupQuerySingle({ username: 'johndoe' })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return endpointChain
      return profileChain
    })

    const params = Promise.resolve({ segments: ['my-webhook'] })
    const url = new URL('http://localhost:3000/api/wh/my-webhook')
    const req = new NextRequest(url, { method: 'POST', body: '{"event":"test"}' })
    const res = await handleWebhook(req, { params })

    // 308 Permanent Redirect preserves method — 301 would convert POST to GET
    expect(res.status).toBe(308)
    expect(res.status).not.toBe(301)
  })

  it('returns 404 for unknown slug', async () => {
    const endpointChain = setupQueryLimit([], { code: 'PGRST116' })
    mockFrom.mockReturnValue(endpointChain)

    const params = Promise.resolve({ segments: ['unknown-slug'] })
    const req = createRequest('unknown-slug')
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Not found')
  })

  it('returns 404 when endpoint owner has no username', async () => {
    const endpointChain = setupQueryLimit([{ user_id: 'user-456', slug: 'some-slug' }])
    const profileChain = setupQuerySingle(null, { code: 'PGRST116' })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return endpointChain
      return profileChain
    })

    const params = Promise.resolve({ segments: ['some-slug'] })
    const req = createRequest('some-slug')
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Not found')
  })

  it('returns 404 when profile exists but username field is null', async () => {
    const endpointChain = setupQueryLimit([{ user_id: 'user-456', slug: 'some-slug' }])
    const profileChain = setupQuerySingle({ username: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return endpointChain
      return profileChain
    })

    const params = Promise.resolve({ segments: ['some-slug'] })
    const req = createRequest('some-slug')
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Not found')
  })

  it('preserves query string in the redirect URL', async () => {
    const endpointChain = setupQueryLimit([{ user_id: 'user-456', slug: 'my-webhook' }])
    const profileChain = setupQuerySingle({ username: 'johndoe' })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return endpointChain
      return profileChain
    })

    const url = new URL('http://localhost:3000/api/wh/my-webhook?foo=bar&baz=qux')
    const req = new NextRequest(url, { method: 'GET' })
    const params = Promise.resolve({ segments: ['my-webhook'] })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(308)
    const location = res.headers.get('location')
    expect(location).toBe('http://localhost:3000/api/wh/johndoe/my-webhook?foo=bar&baz=qux')
  })

  it('returns 404 with deprecation message when multiple users share the same slug', async () => {
    // After removing global uniqueness constraint, two users can have same slug
    const ambiguousEndpoints = [
      { user_id: 'user-alice', slug: 'shared-hook' },
      { user_id: 'user-bob', slug: 'shared-hook' },
    ]
    const endpointChain = setupQueryLimit(ambiguousEndpoints)
    mockFrom.mockReturnValue(endpointChain)

    const params = Promise.resolve({ segments: ['shared-hook'] })
    const req = createRequest('shared-hook')
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toContain('deprecated')
    expect(json.error).toContain('/wh/{username}/{slug}')
  })
})
