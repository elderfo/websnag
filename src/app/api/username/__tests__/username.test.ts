import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock modules before importing route handlers
const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockAdminFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: mockAdminFrom,
  })),
}))

// Helper to create a chainable query mock
function createChain(result: { data?: unknown; error?: unknown }) {
  const terminal = vi.fn().mockResolvedValue(result)
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    single: terminal,
    upsert: terminal,
  }
  // All intermediate methods return the chain itself
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

describe('GET /api/username', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { GET } = await import('../route')
    const response = await GET()

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns username when profile exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const chain = createChain({ data: { username: 'johndoe' }, error: null })
    mockFrom.mockReturnValue(chain)

    const { GET } = await import('../route')
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.username).toBe('johndoe')
  })

  it('returns null when no username is set (PGRST116 = no rows)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const chain = createChain({ data: null, error: { code: 'PGRST116' } })
    mockFrom.mockReturnValue(chain)

    const { GET } = await import('../route')
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.username).toBeNull()
  })

  it('returns 500 for unexpected DB errors (not PGRST116)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const chain = createChain({ data: null, error: { code: 'PGRST500', message: 'DB crash' } })
    mockFrom.mockReturnValue(chain)

    const { GET } = await import('../route')
    const response = await GET()

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Failed to fetch username')
  })

  it('returns 500 when an unexpected exception is thrown', async () => {
    mockGetUser.mockRejectedValue(new Error('auth service down'))

    const { GET } = await import('../route')
    const response = await GET()

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Internal server error')
  })
})

describe('POST /api/username', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: 'johndoe' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it('returns 400 for invalid JSON body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'text/plain' },
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid JSON body')
  })

  it('returns 400 for invalid username format — too short', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: 'ab' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid username format')
  })

  it('returns 400 for invalid username format — uppercase', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: 'JohnDoe' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid username format')
  })

  it('returns 400 for invalid username format — leading hyphen', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: '-johndoe' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid username format')
  })

  it('returns 400 for invalid username format — trailing hyphen', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: 'johndoe-' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid username format')
  })

  it('returns 400 for invalid username format — underscore', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: 'john_doe' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid username format')
  })

  it('returns 400 for invalid username format — unicode characters', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: 'jöhndöe' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid username format')
  })

  it('returns 400 for username with leading/trailing whitespace', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: ' johndoe ' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid username format')
  })

  it('accepts exactly 32 characters (max allowed)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const username32 = 'a'.repeat(32)

    // Admin from: first call uniqueness check (no row), second upsert
    let adminCallCount = 0
    mockAdminFrom.mockImplementation(() => {
      adminCallCount++
      if (adminCallCount === 1) {
        return createChain({ data: null, error: { code: 'PGRST116' } })
      }
      return createChain({ data: { id: 'user-1', username: username32 }, error: null })
    })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: username32 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.username).toBe(username32)
  })

  it('returns 400 for 33 characters (one over max)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: 'a'.repeat(33) }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid username format')
  })

  it('returns 400 for blocked reserved username', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: 'stripe' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('This username is not available')
  })

  it('returns 400 for blocked username — case insensitive check', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('This username is not available')
  })

  it('returns 409 when username is already taken by another user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const existingChain = createChain({ data: { id: 'user-2' }, error: null })
    mockAdminFrom.mockReturnValue(existingChain)

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: 'johndoe' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe('Username already taken')
  })

  it('returns 409 when DB unique constraint fires (TOCTOU race — code 23505)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    let adminCallCount = 0
    mockAdminFrom.mockImplementation(() => {
      adminCallCount++
      if (adminCallCount === 1) {
        // uniqueness SELECT passes (no race detected at read time)
        return createChain({ data: null, error: { code: 'PGRST116' } })
      }
      // upsert hits the unique constraint
      return createChain({ data: null, error: { code: '23505', message: 'duplicate key value' } })
    })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: 'johndoe' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(409)
    const body = await response.json()
    // Must NOT leak the raw DB error message
    expect(body.error).toBe('Username already taken')
    expect(body.error).not.toContain('duplicate key value')
  })

  it('returns generic 500 (not raw DB message) for unexpected upsert errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    let adminCallCount = 0
    mockAdminFrom.mockImplementation(() => {
      adminCallCount++
      if (adminCallCount === 1) {
        return createChain({ data: null, error: { code: 'PGRST116' } })
      }
      return createChain({ data: null, error: { code: 'PGRST500', message: 'internal db error' } })
    })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: 'johndoe' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(500)
    const body = await response.json()
    // Must return generic error, not raw DB message
    expect(body.error).toBe('Failed to save username')
    expect(body.error).not.toContain('internal db error')
  })

  it('succeeds with valid unique username', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    // Admin from: first call is uniqueness check (no existing user), second is upsert
    let adminCallCount = 0
    mockAdminFrom.mockImplementation(() => {
      adminCallCount++
      if (adminCallCount === 1) {
        // uniqueness check: no existing row
        return createChain({ data: null, error: { code: 'PGRST116' } })
      }
      // upsert call
      const chain = createChain({ data: { id: 'user-1', username: 'johndoe' }, error: null })
      return chain
    })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: 'johndoe' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.username).toBe('johndoe')
  })

  it('allows a user to update their own username without 409', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    // Admin from: uniqueness check returns the same user id
    let adminCallCount = 0
    mockAdminFrom.mockImplementation(() => {
      adminCallCount++
      if (adminCallCount === 1) {
        return createChain({ data: { id: 'user-1' }, error: null })
      }
      return createChain({ data: { id: 'user-1', username: 'newhandle' }, error: null })
    })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: 'newhandle' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.username).toBe('newhandle')
  })

  it('returns 500 when an unexpected exception is thrown', async () => {
    mockGetUser.mockRejectedValue(new Error('auth service down'))

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/username', {
      method: 'POST',
      body: JSON.stringify({ username: 'johndoe' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Internal server error')
  })
})
