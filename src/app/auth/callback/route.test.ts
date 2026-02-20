import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'

const mockExchangeCodeForSession = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { username: 'testuser' },
            error: null,
          }),
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
  })

  it('redirects to /dashboard on successful code exchange', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })

    const request = new Request('http://localhost:3000/auth/callback?code=test-code')
    const response = await GET(request)

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('test-code')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
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
})
