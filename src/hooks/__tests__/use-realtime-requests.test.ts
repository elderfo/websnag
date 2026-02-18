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

describe('useRealtimeRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    realtimeCallback = null

    // Chain: from().select().eq().order().limit()
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder })
    mockOrder.mockReturnValue({ limit: mockLimit })
    mockLimit.mockResolvedValue({ data: [fakeRequest] })
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
    expect(mockLimit).toHaveBeenCalledWith(50)
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
    mockLimit.mockResolvedValue({ data: null })

    const { result } = renderHook(() => useRealtimeRequests('ep-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.requests).toEqual([])
  })
})
