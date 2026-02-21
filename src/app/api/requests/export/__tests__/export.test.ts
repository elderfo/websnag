import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

vi.mock('@/lib/logger', () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}))

import { GET } from '../route'

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost:3000/api/requests/export')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new Request(url.toString(), { method: 'GET' })
}

const fakeRequests = [
  {
    id: 'req-1',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"event": "test"}',
    query_params: {},
    content_type: 'application/json',
    source_ip: '127.0.0.1',
    size_bytes: 17,
    received_at: '2026-01-01T00:00:00.000Z',
    ai_analysis: null,
  },
  {
    id: 'req-2',
    method: 'GET',
    headers: {},
    body: null,
    query_params: { foo: 'bar' },
    content_type: null,
    source_ip: '127.0.0.2',
    size_bytes: 0,
    received_at: '2026-01-01T00:01:00.000Z',
    ai_analysis: null,
  },
]

describe('GET /api/requests/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for unauthenticated requests', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await GET(makeRequest({ endpointId: 'ep-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when endpointId is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const res = await GET(makeRequest())
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('Invalid request')
  })

  it('returns 400 for an invalid method filter', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const res = await GET(makeRequest({ endpointId: 'ep-1', method: 'INVALID' }))
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('Invalid request')
  })

  it('returns 400 for an invalid dateFrom value', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const res = await GET(makeRequest({ endpointId: 'ep-1', dateFrom: 'not-a-date' }))
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('Invalid request')
  })

  it('returns 404 when user does not own the endpoint', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    // Endpoint ownership check returns null (not owned)
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    })

    const res = await GET(makeRequest({ endpointId: 'ep-other' }))
    expect(res.status).toBe(404)
  })

  it('returns 200 with JSON array for a valid request', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    // First call: endpoints ownership check
    // Second call: requests query
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'ep-1' }, error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: fakeRequests, error: null }),
            }),
          }),
        }),
      })

    const res = await GET(makeRequest({ endpointId: 'ep-1' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)
  })

  it('returns Content-Disposition header for download', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'ep-1' }, error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: fakeRequests, error: null }),
            }),
          }),
        }),
      })

    const res = await GET(makeRequest({ endpointId: 'ep-1' }))
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="requests-ep-1-/)
  })

  it('applies method filter to the query', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const mockEq = vi.fn()
    const mockOrder = vi.fn()
    const mockLimit = vi.fn().mockResolvedValue({ data: [fakeRequests[0]], error: null })
    mockOrder.mockReturnValue({ limit: mockLimit })

    // The method filter adds an extra .eq() call after .limit() is chained.
    // We use a chainable mock that records all calls.
    const queryChain: Record<string, unknown> = {}
    const chainFn = vi.fn().mockReturnValue(queryChain)
    queryChain['eq'] = vi.fn().mockReturnValue(queryChain)
    queryChain['order'] = vi.fn().mockReturnValue(queryChain)
    queryChain['limit'] = vi.fn().mockReturnValue(queryChain)
    queryChain['gte'] = vi.fn().mockReturnValue(queryChain)
    queryChain['lte'] = vi.fn().mockReturnValue(queryChain)
    queryChain['ilike'] = vi.fn().mockReturnValue(queryChain)
    queryChain['then'] = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: [fakeRequests[0]], error: null }).then(resolve, reject)

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'ep-1' }, error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({ select: chainFn })

    const res = await GET(makeRequest({ endpointId: 'ep-1', method: 'POST' }))
    expect(res.status).toBe(200)

    // Verify that eq was called with 'method' and 'POST'
    const eqCalls = (queryChain['eq'] as ReturnType<typeof vi.fn>).mock.calls
    expect(eqCalls.some(([field, val]) => field === 'method' && val === 'POST')).toBe(true)
  })

  it('applies dateFrom filter to the query', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const queryChain: Record<string, unknown> = {}
    const chainFn = vi.fn().mockReturnValue(queryChain)
    queryChain['eq'] = vi.fn().mockReturnValue(queryChain)
    queryChain['order'] = vi.fn().mockReturnValue(queryChain)
    queryChain['limit'] = vi.fn().mockReturnValue(queryChain)
    queryChain['gte'] = vi.fn().mockReturnValue(queryChain)
    queryChain['lte'] = vi.fn().mockReturnValue(queryChain)
    queryChain['ilike'] = vi.fn().mockReturnValue(queryChain)
    queryChain['then'] = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: fakeRequests, error: null }).then(resolve, reject)

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'ep-1' }, error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({ select: chainFn })

    const dateFrom = '2026-01-01T00:00:00.000Z'
    const res = await GET(makeRequest({ endpointId: 'ep-1', dateFrom }))
    expect(res.status).toBe(200)

    const gteCalls = (queryChain['gte'] as ReturnType<typeof vi.fn>).mock.calls
    expect(gteCalls.some(([field, val]) => field === 'received_at' && val === dateFrom)).toBe(true)
  })

  it('applies dateTo filter to the query', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const queryChain: Record<string, unknown> = {}
    const chainFn = vi.fn().mockReturnValue(queryChain)
    queryChain['eq'] = vi.fn().mockReturnValue(queryChain)
    queryChain['order'] = vi.fn().mockReturnValue(queryChain)
    queryChain['limit'] = vi.fn().mockReturnValue(queryChain)
    queryChain['gte'] = vi.fn().mockReturnValue(queryChain)
    queryChain['lte'] = vi.fn().mockReturnValue(queryChain)
    queryChain['ilike'] = vi.fn().mockReturnValue(queryChain)
    queryChain['then'] = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: fakeRequests, error: null }).then(resolve, reject)

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'ep-1' }, error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({ select: chainFn })

    const dateTo = '2026-01-31T23:59:59.000Z'
    const res = await GET(makeRequest({ endpointId: 'ep-1', dateTo }))
    expect(res.status).toBe(200)

    const lteCalls = (queryChain['lte'] as ReturnType<typeof vi.fn>).mock.calls
    expect(lteCalls.some(([field, val]) => field === 'received_at' && val === dateTo)).toBe(true)
  })

  it('applies search filter to the query', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const queryChain: Record<string, unknown> = {}
    const chainFn = vi.fn().mockReturnValue(queryChain)
    queryChain['eq'] = vi.fn().mockReturnValue(queryChain)
    queryChain['order'] = vi.fn().mockReturnValue(queryChain)
    queryChain['limit'] = vi.fn().mockReturnValue(queryChain)
    queryChain['gte'] = vi.fn().mockReturnValue(queryChain)
    queryChain['lte'] = vi.fn().mockReturnValue(queryChain)
    queryChain['ilike'] = vi.fn().mockReturnValue(queryChain)
    queryChain['then'] = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: fakeRequests, error: null }).then(resolve, reject)

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'ep-1' }, error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({ select: chainFn })

    const res = await GET(makeRequest({ endpointId: 'ep-1', search: 'test-search-term' }))
    expect(res.status).toBe(200)

    const ilikeCalls = (queryChain['ilike'] as ReturnType<typeof vi.fn>).mock.calls
    expect(
      ilikeCalls.some(([field, val]) => field === 'body' && val === '%test-search-term%')
    ).toBe(true)
  })

  it('escapes LIKE metacharacters in the search filter', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const queryChain: Record<string, unknown> = {}
    const chainFn = vi.fn().mockReturnValue(queryChain)
    queryChain['eq'] = vi.fn().mockReturnValue(queryChain)
    queryChain['order'] = vi.fn().mockReturnValue(queryChain)
    queryChain['limit'] = vi.fn().mockReturnValue(queryChain)
    queryChain['gte'] = vi.fn().mockReturnValue(queryChain)
    queryChain['lte'] = vi.fn().mockReturnValue(queryChain)
    queryChain['ilike'] = vi.fn().mockReturnValue(queryChain)
    queryChain['then'] = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: fakeRequests, error: null }).then(resolve, reject)

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'ep-1' }, error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({ select: chainFn })

    const res = await GET(makeRequest({ endpointId: 'ep-1', search: '100%_match\\test' }))
    expect(res.status).toBe(200)

    const ilikeCalls = (queryChain['ilike'] as ReturnType<typeof vi.fn>).mock.calls
    expect(
      ilikeCalls.some(([field, val]) => field === 'body' && val === '%100\\%\\_match\\\\test%')
    ).toBe(true)
  })
})
