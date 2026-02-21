import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRealtimeRequests } from '../use-realtime-requests'
import type { WebhookRequest } from '@/types'

// Track the realtime callback so we can trigger it in tests
let realtimeCallback: ((payload: { new: unknown }) => void) | null = null

const mockRemoveChannel = vi.fn()
const mockSubscribe = vi.fn().mockReturnThis()
const mockOn = vi.fn().mockImplementation((_event, _filter, cb) => {
  realtimeCallback = cb
  return { subscribe: mockSubscribe }
})
const mockChannel = vi.fn().mockReturnValue({
  on: mockOn,
  subscribe: mockSubscribe,
})

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockGte = vi.fn()
const mockLte = vi.fn()
const mockIlike = vi.fn()
const mockLt = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn().mockReturnValue({
      select: mockSelect,
    }),
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  }),
}))

const fakeRequest: WebhookRequest = {
  id: 'req-1',
  endpoint_id: 'ep-1',
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{"test": true}',
  query_params: {},
  content_type: 'application/json',
  source_ip: '127.0.0.1',
  size_bytes: 14,
  received_at: '2026-01-01T00:00:00Z',
  ai_analysis: null,
}

// The hook uses a chainable query pattern:
// from('requests').select('*').eq(...).order(...).limit(n)
//   [.eq()] [.gte()] [.lte()] [.ilike()] [.lt()]
// Any method can be called in any order after the initial chain,
// and the whole thing is awaited as a Promise.
// We build a single shared chain object that is both chainable and thenable.
function makeQueryChain(result: { data: WebhookRequest[] | null }) {
  const chain: Record<string, unknown> = {}
  const chainFn = vi.fn().mockReturnValue(chain)
  chain['eq'] = mockEq
  chain['order'] = mockOrder
  chain['limit'] = mockLimit
  chain['gte'] = mockGte
  chain['lte'] = mockLte
  chain['ilike'] = mockIlike
  chain['lt'] = mockLt
  chain['then'] = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  chain['catch'] = (fn: (e: unknown) => unknown) => Promise.resolve(result).catch(fn)

  mockSelect.mockReturnValue(chain)
  mockEq.mockReturnValue(chain)
  mockOrder.mockReturnValue(chain)
  mockLimit.mockReturnValue(chain)
  mockGte.mockReturnValue(chain)
  mockLte.mockReturnValue(chain)
  mockIlike.mockReturnValue(chain)
  mockLt.mockReturnValue(chain)

  return chainFn
}

describe('useRealtimeRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    realtimeCallback = null
    makeQueryChain({ data: [fakeRequest] })
  })

  it('fetches initial requests for the endpoint', async () => {
    const { result } = renderHook(() => useRealtimeRequests('ep-1'))

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.requests).toEqual([fakeRequest])
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('endpoint_id', 'ep-1')
    expect(mockOrder).toHaveBeenCalledWith('received_at', { ascending: false })
    expect(mockLimit).toHaveBeenCalledWith(51) // PAGE_SIZE + 1
  })

  it('subscribes to realtime INSERT events filtered by endpoint_id', async () => {
    renderHook(() => useRealtimeRequests('ep-1'))

    await waitFor(() => {
      expect(mockChannel).toHaveBeenCalledWith('endpoint-ep-1')
    })

    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'requests',
        filter: 'endpoint_id=eq.ep-1',
      },
      expect.any(Function)
    )
    expect(mockSubscribe).toHaveBeenCalled()
  })

  it('prepends new requests from realtime events', async () => {
    const { result } = renderHook(() => useRealtimeRequests('ep-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const newRequest: WebhookRequest = {
      ...fakeRequest,
      id: 'req-2',
      method: 'GET',
      received_at: '2026-01-01T00:01:00Z',
    }

    act(() => {
      realtimeCallback!({ new: newRequest })
    })

    expect(result.current.requests).toHaveLength(2)
    expect(result.current.requests[0]).toEqual(newRequest)
    expect(result.current.requests[1]).toEqual(fakeRequest)
  })

  it('cleans up the channel subscription on unmount', async () => {
    const { unmount } = renderHook(() => useRealtimeRequests('ep-1'))

    await waitFor(() => {
      expect(mockChannel).toHaveBeenCalled()
    })

    unmount()

    expect(mockRemoveChannel).toHaveBeenCalled()
  })

  it('handles null data from initial fetch', async () => {
    makeQueryChain({ data: null })

    const { result } = renderHook(() => useRealtimeRequests('ep-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.requests).toEqual([])
  })

  it('passes method filter to the query', async () => {
    const { result } = renderHook(() => useRealtimeRequests('ep-1', { method: 'POST' }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockEq).toHaveBeenCalledWith('method', 'POST')
  })

  it('returns hasMore=true when more results are available', async () => {
    // Return PAGE_SIZE + 1 results to indicate more pages
    const manyRequests = Array.from({ length: 51 }, (_, i) => ({
      ...fakeRequest,
      id: `req-${i}`,
    }))
    makeQueryChain({ data: manyRequests })

    const { result } = renderHook(() => useRealtimeRequests('ep-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.hasMore).toBe(true)
    expect(result.current.requests).toHaveLength(50) // PAGE_SIZE, not 51
  })

  it('removes a request from local state with removeRequest', async () => {
    const { result } = renderHook(() => useRealtimeRequests('ep-1'))

    await waitFor(() => {
      expect(result.current.requests).toHaveLength(1)
    })

    act(() => {
      result.current.removeRequest('req-1')
    })

    expect(result.current.requests).toHaveLength(0)
  })

  it('filters out realtime events that do not match active filters', async () => {
    const { result } = renderHook(() => useRealtimeRequests('ep-1', { method: 'POST' }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const getRequest: WebhookRequest = {
      ...fakeRequest,
      id: 'req-get',
      method: 'GET',
    }

    act(() => {
      realtimeCallback!({ new: getRequest })
    })

    // Should not be added because it doesn't match the method filter
    expect(result.current.requests.find((r) => r.id === 'req-get')).toBeUndefined()
  })

  it('escapes LIKE metacharacters in the search filter', async () => {
    const { result } = renderHook(() => useRealtimeRequests('ep-1', { search: '100%_match\\test' }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockIlike).toHaveBeenCalledWith('body', '%100\\%\\_match\\\\test%')
  })
})
