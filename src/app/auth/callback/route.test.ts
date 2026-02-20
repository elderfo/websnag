import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'

const mockExchangeCodeForSession = vi.fn()
const mockGetUser = vi.fn()
const mockMaybeSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: (...args: unknown[]) => mockMaybeSingle(...args),
        }),
      }),
    }),
  }),
}))

describe('Auth callback route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mockMaybeSingle.mockResolvedValue({
      data: { username: 'testuser' },
      error: null,
    })
  })

  it('redirects to /auth/redirect on successful code exchange', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })

    const request = new Request('http://localhost:3000/auth/callback?code=test-code')
    const response = await GET(request)

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('test-code')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/auth/redirect')
  })

  it('redirects to /auth/redirect instead of /dashboard after successful login', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })

    const request = new Request('http://localhost:3000/auth/callback?code=test-code')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/auth/redirect')
  })

  it('redirects to custom next path when provided', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })

    const request = new Request(
      'http://localhost:3000/auth/callback?code=test-code&next=/endpoints/123'
    )
    const response = await GET(request)

    expect(response.headers.get('location')).toBe('http://localhost:3000/endpoints/123')
  })

  it('redirects to /login?error=auth when no code is provided', async () => {
    const request = new Request('http://localhost:3000/auth/callback')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login?error=auth')
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('redirects to /login?error=auth when code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: 'Invalid code' },
    })

    const request = new Request('http://localhost:3000/auth/callback?code=bad-code')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/login?error=auth')
  })

  it('redirects to settings for username setup when user has no username on /dashboard', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const request = new Request('http://localhost:3000/auth/callback?code=test-code')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/settings?setup=username')
  })

  it('redirects to settings with redirect param when user has no username on deep link', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    const request = new Request(
      'http://localhost:3000/auth/callback?code=test-code&next=/endpoints/new'
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/settings?setup=username&redirect=%2Fendpoints%2Fnew'
    )
  })

  it('allows deep link when user has a username', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })

    const request = new Request(
      'http://localhost:3000/auth/callback?code=test-code&next=/endpoints/new'
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/endpoints/new')
  })
})
