import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useUsage } from '../use-usage'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    rpc: mockRpc,
    from: vi.fn().mockReturnValue({
      select: mockSelect,
    }),
  }),
}))

describe('useUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    // Chain: from().select().eq().single()
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ single: mockSingle })
  })

  it('fetches usage and plan data for pro user', async () => {
    mockRpc.mockResolvedValue({
      data: [{ request_count: 42, ai_analysis_count: 3 }],
    })
    mockSingle.mockResolvedValue({
      data: { plan: 'pro', status: 'active' },
    })

    const { result } = renderHook(() => useUsage())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.usage).toEqual({
      requestCount: 42,
      aiAnalysisCount: 3,
      plan: 'pro',
    })
  })

  it('defaults to free plan when subscription is not active', async () => {
    mockRpc.mockResolvedValue({
      data: [{ request_count: 10, ai_analysis_count: 1 }],
    })
    mockSingle.mockResolvedValue({
      data: { plan: 'pro', status: 'canceled' },
    })

    const { result } = renderHook(() => useUsage())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.usage?.plan).toBe('free')
  })

  it('defaults to free plan when no subscription exists', async () => {
    mockRpc.mockResolvedValue({
      data: [{ request_count: 0, ai_analysis_count: 0 }],
    })
    mockSingle.mockResolvedValue({
      data: null,
    })

    const { result } = renderHook(() => useUsage())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.usage?.plan).toBe('free')
  })

  it('returns null usage when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
    })

    const { result } = renderHook(() => useUsage())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.usage).toBeNull()
  })

  it('handles missing usage data with zero defaults', async () => {
    mockRpc.mockResolvedValue({ data: null })
    mockSingle.mockResolvedValue({
      data: { plan: 'free', status: 'active' },
    })

    const { result } = renderHook(() => useUsage())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.usage).toEqual({
      requestCount: 0,
      aiAnalysisCount: 0,
      plan: 'free',
    })
  })

  it('calls rpc with correct function name and user id', async () => {
    mockRpc.mockResolvedValue({
      data: [{ request_count: 0, ai_analysis_count: 0 }],
    })
    mockSingle.mockResolvedValue({
      data: { plan: 'free', status: 'active' },
    })

    renderHook(() => useUsage())

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('get_current_usage', {
        p_user_id: 'user-1',
      })
    })

    expect(mockSelect).toHaveBeenCalledWith('plan, status')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
  })
})
