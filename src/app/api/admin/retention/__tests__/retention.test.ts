import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { POST } = await import('../route')
    const response = await POST()

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Authentication required')
  })

  it('returns 403 when ADMIN_USER_IDS is not set', async () => {
    delete process.env.ADMIN_USER_IDS
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    const { POST } = await import('../route')
    const response = await POST()

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 403 when user is not admin', async () => {
    process.env.ADMIN_USER_IDS = 'admin-1, admin-2'
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    const { POST } = await import('../route')
    const response = await POST()

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns cleanup results on success', async () => {
    process.env.ADMIN_USER_IDS = 'user-1'
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
    process.env.ADMIN_USER_IDS = 'user-1'
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

  it('returns 500 when RPC returns null data without error', async () => {
    process.env.ADMIN_USER_IDS = 'user-1'
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
    mockRpc.mockResolvedValue({ data: null, error: null })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { POST } = await import('../route')
    const response = await POST()

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Retention cleanup returned no result')

    consoleSpy.mockRestore()
  })
})
