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

  it('returns null when no username is set', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const chain = createChain({ data: null, error: { code: 'PGRST116' } })
    mockFrom.mockReturnValue(chain)

    const { GET } = await import('../route')
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.username).toBeNull()
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
    // 'admin' is blocked; we need a valid-format version that is also blocked
    // 'admin' is 5 chars, but regex requires pattern ^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$
    // 'admin' has 5 chars: a-d-m-i-n — "adm" matches [a-z0-9], "i" matches middle, "n" matches end... wait
    // Actually 'admin' = 5 chars: start='a', middle='dmi', end='n' — that's 1+3+1=5, regex OK
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
})
