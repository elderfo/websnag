import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    rpc: mockRpc,
  })),
}))

describe('POST /api/admin/retention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { POST } = await import('../route')
    const response = await POST()

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Authentication required')
  })

  it('returns cleanup results on success', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
    mockRpc.mockResolvedValue({
      data: [{ free_deleted: 10, pro_deleted: 3 }],
      error: null,
    })

    const { POST } = await import('../route')
    const response = await POST()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.free_deleted).toBe(10)
    expect(body.pro_deleted).toBe(3)

    expect(mockRpc).toHaveBeenCalledWith('cleanup_expired_requests')
  })

  it('returns 500 when RPC fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'function execution failed' },
    })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { POST } = await import('../route')
    const response = await POST()

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Retention cleanup failed')

    consoleSpy.mockRestore()
  })
})
