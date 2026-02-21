import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockImplementation(() => ({
    from: () => ({
      select: () => ({
        limit: () => Promise.resolve({ data: [{}], error: null }),
      }),
    }),
  })),
}))

import { GET } from '../route'

const HEALTH_TOKEN = 'test-health-token'

function makeAuthenticatedRequest(): Request {
  return new Request('http://localhost:3000/api/health', {
    headers: { Authorization: `Bearer ${HEALTH_TOKEN}` },
  })
}

function makeUnauthenticatedRequest(): Request {
  return new Request('http://localhost:3000/api/health')
}

function makeWrongTokenRequest(): Request {
  return new Request('http://localhost:3000/api/health', {
    headers: { Authorization: 'Bearer wrong-token' },
  })
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-key')
  vi.stubEnv('HEALTH_CHECK_TOKEN', HEALTH_TOKEN)
})

describe('GET /api/health', () => {
  it('returns 200 with status ok when database is reachable', async () => {
    const res = await GET(makeAuthenticatedRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('ok')
    expect(json.timestamp).toBeDefined()
    expect(json.database).toBe('connected')
    expect(typeof json.durationMs).toBe('number')
  })

  it('returns 503 with status error when env vars are missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '')

    const res = await GET(makeAuthenticatedRequest())
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.status).toBe('error')
    expect(json.error).toBe('Missing Supabase configuration')
  })

  it('returns minimal response when no auth token is provided', async () => {
    const res = await GET(makeUnauthenticatedRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('ok')
    expect(json.timestamp).toBeDefined()
    expect(json.database).toBeUndefined()
    expect(json.durationMs).toBeUndefined()
  })

  it('returns minimal response when wrong token is provided', async () => {
    const res = await GET(makeWrongTokenRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('ok')
    expect(json.timestamp).toBeDefined()
    expect(json.database).toBeUndefined()
    expect(json.durationMs).toBeUndefined()
  })

  it('returns detailed response when correct token is provided', async () => {
    const res = await GET(makeAuthenticatedRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('ok')
    expect(json.database).toBe('connected')
    expect(typeof json.durationMs).toBe('number')
  })
})

describe('GET /api/health (database unreachable)', () => {
  it('returns 503 with status degraded when database query fails', async () => {
    vi.resetModules()

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockImplementation(() => ({
        from: () => ({
          select: () => ({
            limit: () => Promise.resolve({ data: null, error: { message: 'connection refused' } }),
          }),
        }),
      })),
    }))

    const { GET: FailGET } = await import('../route')
    const res = await FailGET(makeAuthenticatedRequest())
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.status).toBe('degraded')
    expect(json.database).toBe('unreachable')
  })
})
