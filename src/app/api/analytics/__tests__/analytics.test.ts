import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AnalyticsResponse } from '@/types'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
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

    mockRpc.mockResolvedValue({ data: [], error: null })

    for (const range of ['7', '30', '90']) {
      const res = await GET(createRequest({ range }) as never)
      expect(res.status).toBe(200)
    }
  })

  it('returns empty data when RPCs return empty results', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockRpc.mockResolvedValue({ data: [], error: null })

    const res = await GET(createRequest() as never)
    expect(res.status).toBe(200)
    const json: AnalyticsResponse = await res.json()

    // volumeByDay should have exactly 30 entries (default range, zero-filled)
    expect(json.volumeByDay.length).toBe(30)
    expect(json.volumeByDay.every((v) => v.count === 0)).toBe(true)
    expect(json.methodBreakdown).toEqual([])
    expect(json.topEndpoints).toEqual([])
  })

  it('returns aggregated analytics data', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const now = new Date()
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const today = todayUTC.toISOString().slice(0, 10)

    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_volume_by_day') {
        return Promise.resolve({
          data: [{ day: today, count: 3 }],
          error: null,
        })
      }
      if (fnName === 'get_method_breakdown') {
        return Promise.resolve({
          data: [
            { method: 'POST', count: 2 },
            { method: 'GET', count: 1 },
          ],
          error: null,
        })
      }
      if (fnName === 'get_top_endpoints') {
        return Promise.resolve({
          data: [
            { endpoint_id: 'ep-1', endpoint_name: 'Stripe', endpoint_slug: 'stripe', count: 2 },
            { endpoint_id: 'ep-2', endpoint_name: 'GitHub', endpoint_slug: 'github', count: 1 },
          ],
          error: null,
        })
      }
      return Promise.resolve({ data: [], error: null })
    })

    const res = await GET(createRequest({ range: '7' }) as never)
    expect(res.status).toBe(200)
    const json: AnalyticsResponse = await res.json()

    // Volume should have exactly 7 entries (zero-filled)
    expect(json.volumeByDay.length).toBe(7)
    const todayEntry = json.volumeByDay.find((v) => v.date === today)
    expect(todayEntry?.count).toBe(3)

    // Method breakdown should have POST and GET sorted by count DESC
    expect(json.methodBreakdown).toEqual([
      { method: 'POST', count: 2 },
      { method: 'GET', count: 1 },
    ])

    // Top endpoints should be sorted by count descending
    expect(json.topEndpoints[0].id).toBe('ep-1')
    expect(json.topEndpoints[0].name).toBe('Stripe')
    expect(json.topEndpoints[0].slug).toBe('stripe')
    expect(json.topEndpoints[0].count).toBe(2)
    expect(json.topEndpoints[1].id).toBe('ep-2')
    expect(json.topEndpoints[1].count).toBe(1)
  })

  it('passes correct parameters to RPC functions', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockRpc.mockResolvedValue({ data: [], error: null })

    await GET(createRequest({ range: '7' }) as never)

    expect(mockRpc).toHaveBeenCalledWith('get_volume_by_day', {
      p_user_id: 'user-1',
      p_days: 7,
    })
    expect(mockRpc).toHaveBeenCalledWith('get_method_breakdown', {
      p_user_id: 'user-1',
      p_days: 7,
    })
    expect(mockRpc).toHaveBeenCalledWith('get_top_endpoints', {
      p_user_id: 'user-1',
      p_days: 7,
      p_limit: 10,
    })
  })

  it('returns 500 when volume RPC fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_volume_by_day') {
        return Promise.resolve({ data: null, error: { message: 'db error' } })
      }
      return Promise.resolve({ data: [], error: null })
    })

    const res = await GET(createRequest() as never)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to fetch analytics')
  })

  it('returns 500 when method breakdown RPC fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_method_breakdown') {
        return Promise.resolve({ data: null, error: { message: 'db error' } })
      }
      return Promise.resolve({ data: [], error: null })
    })

    const res = await GET(createRequest() as never)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to fetch analytics')
  })

  it('returns 500 when top endpoints RPC fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_top_endpoints') {
        return Promise.resolve({ data: null, error: { message: 'db error' } })
      }
      return Promise.resolve({ data: [], error: null })
    })

    const res = await GET(createRequest() as never)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to fetch analytics')
  })

  it('defaults to 30-day range when no range param provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockRpc.mockResolvedValue({ data: [], error: null })

    const res = await GET(createRequest() as never)
    expect(res.status).toBe(200)

    expect(mockRpc).toHaveBeenCalledWith('get_volume_by_day', {
      p_user_id: 'user-1',
      p_days: 30,
    })
  })

  it('fills missing days with zero counts', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    // Only return data for today — all other days should be zero-filled
    const now = new Date()
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const today = todayUTC.toISOString().slice(0, 10)
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_volume_by_day') {
        return Promise.resolve({
          data: [{ day: today, count: 5 }],
          error: null,
        })
      }
      return Promise.resolve({ data: [], error: null })
    })

    const res = await GET(createRequest({ range: '7' }) as never)
    expect(res.status).toBe(200)
    const json: AnalyticsResponse = await res.json()

    // Should have exactly 7 days
    expect(json.volumeByDay.length).toBe(7)

    // Today should have count 5
    const todayEntry = json.volumeByDay.find((v) => v.date === today)
    expect(todayEntry?.count).toBe(5)

    // All other days should be zero
    const otherDays = json.volumeByDay.filter((v) => v.date !== today)
    expect(otherDays.every((v) => v.count === 0)).toBe(true)
  })
})
