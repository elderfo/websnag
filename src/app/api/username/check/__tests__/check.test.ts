import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()
const mockAdminFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: { getUser: mockGetUser },
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: mockAdminFrom,
  })),
}))

vi.mock('@/lib/logger', () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    requestId: 'test-request-id',
  }),
}))

function createChain(result: { data?: unknown; error?: unknown }) {
  const terminal = vi.fn().mockResolvedValue(result)
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    single: terminal,
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

function makeRequest(username?: string) {
  const url = username
    ? `http://localhost/api/username/check?username=${encodeURIComponent(username)}`
    : 'http://localhost/api/username/check'
  return new NextRequest(url, { method: 'GET' })
}

describe('GET /api/username/check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { GET } = await import('../route')
    const response = await GET(makeRequest('testuser'))

    expect(response.status).toBe(401)
  })

  it('returns 400 when username parameter is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { GET } = await import('../route')
    const response = await GET(makeRequest())

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Missing username parameter')
  })

  it('returns not available for invalid format', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { GET } = await import('../route')
    const response = await GET(makeRequest('ab'))

    const body = await response.json()
    expect(body.available).toBe(false)
    expect(body.reason).toBe('Invalid username format')
  })

  it('returns not available for blocked username — same message as taken', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { GET } = await import('../route')
    const response = await GET(makeRequest('stripe'))

    const body = await response.json()
    expect(body.available).toBe(false)
    expect(body.reason).toBe('Username is already taken')
  })

  it('returns not available for blocked username "admin"', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { GET } = await import('../route')
    const response = await GET(makeRequest('admin'))

    const body = await response.json()
    expect(body.available).toBe(false)
    expect(body.reason).toBe('Username is already taken')
  })

  it('returns not available when username exists in DB', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockAdminFrom.mockReturnValue(createChain({ data: { id: 'user-2' }, error: null }))

    const { GET } = await import('../route')
    const response = await GET(makeRequest('takenuser'))

    const body = await response.json()
    expect(body.available).toBe(false)
    expect(body.reason).toBe('Username is already taken')
  })

  it('returns available when username is free', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockAdminFrom.mockReturnValue(createChain({ data: null, error: { code: 'PGRST116' } }))

    const { GET } = await import('../route')
    const response = await GET(makeRequest('freeuser'))

    const body = await response.json()
    expect(body.available).toBe(true)
    expect(body.reason).toBeUndefined()
  })

  it('blocked and taken usernames produce identical responses', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { GET } = await import('../route')

    // Blocked username
    const blockedRes = await GET(makeRequest('stripe'))
    const blockedBody = await blockedRes.json()

    // Taken username (DB returns a row)
    mockAdminFrom.mockReturnValue(createChain({ data: { id: 'user-2' }, error: null }))
    const takenRes = await GET(makeRequest('realuser'))
    const takenBody = await takenRes.json()

    expect(blockedBody.available).toBe(takenBody.available)
    expect(blockedBody.reason).toBe(takenBody.reason)
  })

  it('returns 500 when database query fails (not PGRST116)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockAdminFrom.mockReturnValue(
      createChain({ data: null, error: { code: 'PGRST500', message: 'connection refused' } })
    )

    const { GET } = await import('../route')
    const response = await GET(makeRequest('testuser'))

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Unable to check availability')
    // Must not leak raw DB error
    expect(body.error).not.toContain('connection refused')
  })

  it('does not return available:true when database errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockAdminFrom.mockReturnValue(
      createChain({ data: null, error: { code: 'PGRST500', message: 'timeout' } })
    )

    const { GET } = await import('../route')
    const response = await GET(makeRequest('testuser'))

    const body = await response.json()
    expect(body.available).toBeUndefined()
  })
})
