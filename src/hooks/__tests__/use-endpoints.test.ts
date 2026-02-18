import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEndpoints } from '../use-endpoints'
import type { Endpoint } from '@/types'

const mockSelect = vi.fn()
const mockOrder = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn().mockReturnValue({
      select: mockSelect,
    }),
  }),
}))

const fakeEndpoint: Endpoint = {
  id: 'ep-1',
  user_id: 'user-1',
  name: 'Test Endpoint',
  slug: 'test-slug',
  description: 'A test endpoint',
  response_code: 200,
  response_body: '{"ok": true}',
  response_headers: { 'Content-Type': 'application/json' },
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('useEndpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelect.mockReturnValue({ order: mockOrder })
    mockOrder.mockResolvedValue({ data: [fakeEndpoint] })
  })

  it('fetches endpoints on mount', async () => {
    const { result } = renderHook(() => useEndpoints())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.endpoints).toEqual([fakeEndpoint])
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('handles null data from fetch', async () => {
    mockOrder.mockResolvedValue({ data: null })

    const { result } = renderHook(() => useEndpoints())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.endpoints).toEqual([])
  })

  it('starts with empty endpoints and loading true', () => {
    const { result } = renderHook(() => useEndpoints())

    expect(result.current.endpoints).toEqual([])
    expect(result.current.loading).toBe(true)
  })
})
