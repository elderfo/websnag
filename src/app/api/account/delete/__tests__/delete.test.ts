import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock modules before importing route handlers
const mockGetUser = vi.fn()
const mockAdminFrom = vi.fn()
const mockDeleteUser = vi.fn()
const mockSubscriptionsCancel = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: mockAdminFrom,
    auth: {
      admin: {
        deleteUser: mockDeleteUser,
      },
    },
  })),
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: {
      cancel: (...args: unknown[]) => mockSubscriptionsCancel(...args),
    },
  },
}))

const mockLogError = vi.fn()
const mockLogInfo = vi.fn()

vi.mock('@/lib/logger', () => ({
  createRequestLogger: () => ({
    info: (...args: unknown[]) => mockLogInfo(...args),
    error: (...args: unknown[]) => mockLogError(...args),
    warn: vi.fn(),
    debug: vi.fn(),
    requestId: 'test-request-id',
  }),
}))

// Helper to create a chainable query mock
function createChain(result: { data?: unknown; error?: unknown }) {
  const terminal = vi.fn().mockResolvedValue(result)
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: terminal,
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

describe('POST /api/account/delete', () => {
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

  it('returns 401 when auth error occurs', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'token expired' },
    })

    const { POST } = await import('../route')
    const response = await POST()

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Authentication required')
  })

  it('successfully deletes user with no subscription', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    mockAdminFrom.mockReturnValue(createChain({ data: null, error: null }))
    mockDeleteUser.mockResolvedValue({ error: null })

    const { POST } = await import('../route')
    const response = await POST()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)

    expect(mockSubscriptionsCancel).not.toHaveBeenCalled()
    expect(mockDeleteUser).toHaveBeenCalledWith('user-1')
  })

  it('successfully deletes user with active Stripe subscription', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    mockAdminFrom.mockReturnValue(
      createChain({
        data: {
          stripe_customer_id: 'cus_123',
          stripe_subscription_id: 'sub_456',
        },
        error: null,
      })
    )
    mockSubscriptionsCancel.mockResolvedValue({ id: 'sub_456', status: 'canceled' })
    mockDeleteUser.mockResolvedValue({ error: null })

    const { POST } = await import('../route')
    const response = await POST()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)

    expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_456')
    expect(mockDeleteUser).toHaveBeenCalledWith('user-1')
  })

  it('handles Stripe cancellation failure gracefully', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    mockAdminFrom.mockReturnValue(
      createChain({
        data: {
          stripe_customer_id: 'cus_123',
          stripe_subscription_id: 'sub_456',
        },
        error: null,
      })
    )
    mockSubscriptionsCancel.mockRejectedValue(new Error('Stripe API error'))
    mockDeleteUser.mockResolvedValue({ error: null })

    const { POST } = await import('../route')
    const response = await POST()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)

    expect(mockLogError).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      'failed to cancel Stripe subscription'
    )
    expect(mockDeleteUser).toHaveBeenCalledWith('user-1')
  })

  it('returns 500 when admin deleteUser fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    mockAdminFrom.mockReturnValue(createChain({ data: null, error: null }))
    mockDeleteUser.mockResolvedValue({
      error: { message: 'admin delete failed' },
    })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { POST } = await import('../route')
    const response = await POST()

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Failed to delete account')

    consoleSpy.mockRestore()
  })

  it('returns 500 on unhandled error', async () => {
    mockGetUser.mockRejectedValue(new Error('auth service down'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { POST } = await import('../route')
    const response = await POST()

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Internal server error')

    consoleSpy.mockRestore()
  })

  it('logs subscription lookup errors but proceeds with deletion', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    const subError = { code: 'PGRST500', message: 'connection refused' }
    mockAdminFrom.mockReturnValue(createChain({ data: null, error: subError }))
    mockDeleteUser.mockResolvedValue({ error: null })

    const { POST } = await import('../route')
    const response = await POST()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)

    expect(mockLogError).toHaveBeenCalledWith(
      { err: subError },
      'subscription lookup failed'
    )
    expect(mockDeleteUser).toHaveBeenCalledWith('user-1')
  })
})
