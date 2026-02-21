import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AnalyticsResponse } from '../route'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

vi.mock('@/lib/logger', () => ({
  createRequestLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    requestId: 'test-request-id',
  }),
}))

import { GET } from '../route'

function createRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost:3000/api/analytics')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new Request(url.toString())
}

function mockEndpoints(endpoints: Array<{ id: string; name: string; slug: string }>) {
  return {
    select: () => ({
      data: endpoints,
      error: null,
    }),
  }
}

function mockRequests(rows: Array<Record<string, unknown>>) {
  return {
    select: () => ({
      in: () => ({
        gte: () => ({
          order: () => ({
            data: rows,
            error: null,
          }),
          data: rows,
          error: null,
        }),
      }),
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/analytics', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await GET(createRequest() as never)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 400 for invalid range parameter', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const res = await GET(createRequest({ range: '15' }) as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid request')
  })

  it('accepts valid range values', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    // Return empty endpoints to short-circuit
    mockFrom.mockReturnValue({
      select: () => ({ data: [], error: null }),
    })

    for (const range of ['7', '30', '90']) {
      const res = await GET(createRequest({ range }) as never)
      expect(res.status).toBe(200)
    }
  })

  it('returns empty data when user has no endpoints', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue({
      select: () => ({ data: [], error: null }),
    })

    const res = await GET(createRequest() as never)
    expect(res.status).toBe(200)
    const json: AnalyticsResponse = await res.json()
    expect(json.volumeByDay).toEqual([])
    expect(json.methodBreakdown).toEqual([])
    expect(json.topEndpoints).toEqual([])
  })

  it('returns aggregated analytics data', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const today = new Date().toISOString().slice(0, 10)
    const endpoints = [
      { id: 'ep-1', name: 'Stripe', slug: 'stripe' },
      { id: 'ep-2', name: 'GitHub', slug: 'github' },
    ]

    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'endpoints') {
        return mockEndpoints(endpoints)
      }

      // requests table — called 3 times (volume, method, top endpoints)
      callCount++
      if (callCount === 1) {
        // Volume rows
        return mockRequests([
          { received_at: `${today}T10:00:00Z` },
          { received_at: `${today}T11:00:00Z` },
          { received_at: `${today}T12:00:00Z` },
        ])
      }
      if (callCount === 2) {
        // Method rows
        return mockRequests([{ method: 'POST' }, { method: 'POST' }, { method: 'GET' }])
      }
      // Endpoint rows
      return mockRequests([
        { endpoint_id: 'ep-1' },
        { endpoint_id: 'ep-1' },
        { endpoint_id: 'ep-2' },
      ])
    })

    const res = await GET(createRequest({ range: '7' }) as never)
    expect(res.status).toBe(200)
    const json: AnalyticsResponse = await res.json()

    // Volume should have entries for each day in range
    expect(json.volumeByDay.length).toBeGreaterThanOrEqual(7)
    const todayEntry = json.volumeByDay.find((v) => v.date === today)
    expect(todayEntry?.count).toBe(3)

    // Method breakdown should have POST and GET
    expect(json.methodBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'POST', count: 2 }),
        expect.objectContaining({ method: 'GET', count: 1 }),
      ])
    )

    // Top endpoints should be sorted by count descending
    expect(json.topEndpoints[0].id).toBe('ep-1')
    expect(json.topEndpoints[0].count).toBe(2)
    expect(json.topEndpoints[1].id).toBe('ep-2')
    expect(json.topEndpoints[1].count).toBe(1)
  })

  it('returns 500 when endpoints query fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue({
      select: () => ({ data: null, error: { message: 'db error' } }),
    })

    const res = await GET(createRequest() as never)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to fetch analytics')
  })

  it('defaults to 30-day range when no range param provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue({
      select: () => ({ data: [], error: null }),
    })

    const res = await GET(createRequest() as never)
    expect(res.status).toBe(200)
  })
})
