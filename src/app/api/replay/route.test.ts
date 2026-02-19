import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock modules before importing the route
const mockGetUser = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args)
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs)
            return { single: () => mockSingle() }
          },
        }
      },
    }),
  }),
}))

vi.mock('@/lib/usage', () => ({
  getUserPlan: vi.fn(),
}))

const mockValidateTargetUrl = vi.fn()
vi.mock('@/lib/url-validator', () => ({
  validateTargetUrl: (...args: unknown[]) => mockValidateTargetUrl(...args),
}))

import { POST } from './route'
import { getUserPlan } from '@/lib/usage'

function makeRequest(body: object): Request {
  return new Request('http://localhost:3000/api/replay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/replay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: URL validation passes
    mockValidateTargetUrl.mockResolvedValue({ safe: true })
  })

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await POST(makeRequest({ requestId: '123', targetUrl: 'https://example.com' }))
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 400 for invalid input', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const res = await POST(makeRequest({ requestId: 'not-a-uuid' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid request')
  })

  it('returns 400 when targetUrl is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const res = await POST(makeRequest({ requestId: '550e8400-e29b-41d4-a716-446655440000' }))
    expect(res.status).toBe(400)
  })

  it('returns 403 when user is not Pro', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    // First .from('subscriptions') call
    mockSingle.mockResolvedValueOnce({ data: { plan: 'free', status: 'active' } })
    vi.mocked(getUserPlan).mockReturnValue('free')

    const res = await POST(
      makeRequest({
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        targetUrl: 'https://example.com/webhook',
      })
    )
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toBe('Replay is a Pro feature')
  })

  it('returns 404 when request is not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    // subscription query
    mockSingle.mockResolvedValueOnce({ data: { plan: 'pro', status: 'active' } })
    // request query
    mockSingle.mockResolvedValueOnce({ data: null })
    vi.mocked(getUserPlan).mockReturnValue('pro')

    const res = await POST(
      makeRequest({
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        targetUrl: 'https://example.com/webhook',
      })
    )
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe('Request not found')
  })

  it('successfully replays a request and returns response', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    // subscription query
    mockSingle.mockResolvedValueOnce({ data: { plan: 'pro', status: 'active' } })
    // request query
    mockSingle.mockResolvedValueOnce({
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          host: 'websnag.dev',
          'x-custom': 'test',
        },
        body: '{"event":"test"}',
        endpoint: { user_id: 'user-1' },
      },
    })
    vi.mocked(getUserPlan).mockReturnValue('pro')

    // Mock global fetch for the replay
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('{"ok":true}'),
      headers: new Headers({ 'content-type': 'application/json' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const res = await POST(
      makeRequest({
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        targetUrl: 'https://example.com/webhook',
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe(200)
    expect(data.body).toBe('{"ok":true}')
    expect(data.headers).toHaveProperty('content-type')

    // Verify fetch was called with correct params
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        body: '{"event":"test"}',
      })
    )

    // Verify host header was stripped
    const calledHeaders = mockFetch.mock.calls[0][1].headers
    expect(calledHeaders).not.toHaveProperty('host')
    expect(calledHeaders).toHaveProperty('content-type', 'application/json')
    expect(calledHeaders).toHaveProperty('x-custom', 'test')

    vi.unstubAllGlobals()
  })

  it('does not send body for GET requests', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValueOnce({ data: { plan: 'pro', status: 'active' } })
    mockSingle.mockResolvedValueOnce({
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        method: 'GET',
        headers: { 'content-type': 'application/json' },
        body: null,
        endpoint: { user_id: 'user-1' },
      },
    })
    vi.mocked(getUserPlan).mockReturnValue('pro')

    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('ok'),
      headers: new Headers(),
    })
    vi.stubGlobal('fetch', mockFetch)

    await POST(
      makeRequest({
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        targetUrl: 'https://example.com/webhook',
      })
    )

    expect(mockFetch.mock.calls[0][1].body).toBeUndefined()

    vi.unstubAllGlobals()
  })

  it('returns 504 on timeout', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValueOnce({ data: { plan: 'pro', status: 'active' } })
    mockSingle.mockResolvedValueOnce({
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        method: 'POST',
        headers: {},
        body: 'test',
        endpoint: { user_id: 'user-1' },
      },
    })
    vi.mocked(getUserPlan).mockReturnValue('pro')

    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    const mockFetch = vi.fn().mockRejectedValue(abortError)
    vi.stubGlobal('fetch', mockFetch)

    const res = await POST(
      makeRequest({
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        targetUrl: 'https://example.com/webhook',
      })
    )

    expect(res.status).toBe(504)
    const data = await res.json()
    expect(data.error).toContain('timed out')

    vi.unstubAllGlobals()
  })

  it('returns 502 on network error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValueOnce({ data: { plan: 'pro', status: 'active' } })
    mockSingle.mockResolvedValueOnce({
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        method: 'POST',
        headers: {},
        body: 'test',
        endpoint: { user_id: 'user-1' },
      },
    })
    vi.mocked(getUserPlan).mockReturnValue('pro')

    const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    vi.stubGlobal('fetch', mockFetch)

    const res = await POST(
      makeRequest({
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        targetUrl: 'https://example.com/webhook',
      })
    )

    expect(res.status).toBe(502)
    const data = await res.json()
    expect(data.error).toContain('ECONNREFUSED')

    vi.unstubAllGlobals()
  })

  it('truncates large response bodies', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValueOnce({ data: { plan: 'pro', status: 'active' } })
    mockSingle.mockResolvedValueOnce({
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        method: 'POST',
        headers: {},
        body: 'test',
        endpoint: { user_id: 'user-1' },
      },
    })
    vi.mocked(getUserPlan).mockReturnValue('pro')

    const largeBody = 'x'.repeat(200_000)
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve(largeBody),
      headers: new Headers(),
    })
    vi.stubGlobal('fetch', mockFetch)

    const res = await POST(
      makeRequest({
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        targetUrl: 'https://example.com/webhook',
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.body.length).toBeLessThan(200_000)
    expect(data.body).toContain('...[truncated]')

    vi.unstubAllGlobals()
  })

  describe('SSRF protection', () => {
    it('returns 400 when targetUrl resolves to a private IP', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
      mockValidateTargetUrl.mockResolvedValue({
        safe: false,
        reason: 'Target resolves to a private or reserved IP address',
      })

      const res = await POST(
        makeRequest({
          requestId: '550e8400-e29b-41d4-a716-446655440000',
          targetUrl: 'http://10.0.0.1/internal',
        })
      )

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Target URL is not allowed')
    })

    it('returns 400 when targetUrl is localhost', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
      mockValidateTargetUrl.mockResolvedValue({
        safe: false,
        reason: 'Hostname "localhost" is not allowed',
      })

      const res = await POST(
        makeRequest({
          requestId: '550e8400-e29b-41d4-a716-446655440000',
          targetUrl: 'http://localhost:8080/admin',
        })
      )

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Target URL is not allowed')
    })

    it('returns 400 when targetUrl uses ftp:// scheme', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
      mockValidateTargetUrl.mockResolvedValue({
        safe: false,
        reason: 'Scheme "ftp" is not allowed. Use http or https.',
      })

      const res = await POST(
        makeRequest({
          requestId: '550e8400-e29b-41d4-a716-446655440000',
          targetUrl: 'ftp://evil.com/file',
        })
      )

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Target URL is not allowed')
    })

    it('calls validateTargetUrl before checking Pro status', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
      mockValidateTargetUrl.mockResolvedValue({
        safe: false,
        reason: 'Hostname "localhost" is not allowed',
      })

      const res = await POST(
        makeRequest({
          requestId: '550e8400-e29b-41d4-a716-446655440000',
          targetUrl: 'http://localhost',
        })
      )

      // Should return 400 from SSRF check, not 403 from Pro check
      expect(res.status).toBe(400)
      // The subscription query should NOT have been called
      expect(mockSingle).not.toHaveBeenCalled()
    })
  })
})
