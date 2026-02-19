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

// Import the redirect handler — the old [slug] route
import { handleWebhook } from '../[slug]/route'

// Helper to create a NextRequest
function createRequest(slug: string, method = 'POST', body = '{}') {
  const url = new URL(`http://localhost:3000/api/wh/${slug}`)
  return new NextRequest(url, { method, body: method !== 'GET' ? body : undefined })
}

// Setup chainable mock for from().select().eq().single()
function setupQuery(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  }
  return chain
}

describe('handleWebhook (legacy redirect route /wh/[slug])', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 301 redirect to new namespaced URL when endpoint and profile exist', async () => {
    const endpointChain = setupQuery({ user_id: 'user-456' })
    const profileChain = setupQuery({ username: 'johndoe' })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return endpointChain // endpoints lookup
      return profileChain // profiles lookup
    })

    const params = Promise.resolve({ slug: 'my-webhook' })
    const req = createRequest('my-webhook')
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(301)
    const location = res.headers.get('location')
    expect(location).toBe('http://localhost:3000/api/wh/johndoe/my-webhook')
  })

  it('returns 404 for unknown slug', async () => {
    const endpointChain = setupQuery(null, { code: 'PGRST116' })
    mockFrom.mockReturnValue(endpointChain)

    const params = Promise.resolve({ slug: 'unknown-slug' })
    const req = createRequest('unknown-slug')
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Not found')
  })

  it('returns 404 when endpoint owner has no username', async () => {
    const endpointChain = setupQuery({ user_id: 'user-456' })
    const profileChain = setupQuery(null, { code: 'PGRST116' })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return endpointChain
      return profileChain
    })

    const params = Promise.resolve({ slug: 'some-slug' })
    const req = createRequest('some-slug')
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Not found')
  })

  it('returns 404 when profile exists but username field is null', async () => {
    const endpointChain = setupQuery({ user_id: 'user-456' })
    const profileChain = setupQuery({ username: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return endpointChain
      return profileChain
    })

    const params = Promise.resolve({ slug: 'some-slug' })
    const req = createRequest('some-slug')
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Not found')
  })

  it('preserves query string in the redirect URL', async () => {
    const endpointChain = setupQuery({ user_id: 'user-456' })
    const profileChain = setupQuery({ username: 'johndoe' })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return endpointChain
      return profileChain
    })

    const url = new URL('http://localhost:3000/api/wh/my-webhook?foo=bar&baz=qux')
    const req = new NextRequest(url, { method: 'GET' })
    const params = Promise.resolve({ slug: 'my-webhook' })
    const res = await handleWebhook(req, { params })

    expect(res.status).toBe(301)
    const location = res.headers.get('location')
    expect(location).toBe('http://localhost:3000/api/wh/johndoe/my-webhook?foo=bar&baz=qux')
  })
})
