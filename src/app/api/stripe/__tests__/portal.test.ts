import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

const mockBillingPortalSessionsCreate = vi.fn()

vi.mock('@/lib/stripe', () => ({
  stripe: {
    billingPortal: {
      sessions: {
        create: (...args: unknown[]) => mockBillingPortalSessionsCreate(...args),
      },
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    requestId: 'test-request-id',
  }),
}))

import { POST } from '@/app/api/stripe/portal/route'

describe('POST /api/stripe/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await POST()
    expect(res.status).toBe(401)

    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 404 when no subscription exists', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null }),
        }),
      }),
    }))

    const res = await POST()
    expect(res.status).toBe(404)

    const data = await res.json()
    expect(data.error).toBe('No subscription found')
  })

  it('returns 404 when subscription has no stripe_customer_id', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { stripe_customer_id: null } }),
        }),
      }),
    }))

    const res = await POST()
    expect(res.status).toBe(404)
  })

  it('creates a portal session and returns the URL', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { stripe_customer_id: 'cus_123' } }),
        }),
      }),
    }))

    mockBillingPortalSessionsCreate.mockResolvedValue({
      url: 'https://billing.stripe.com/session_abc',
    })

    const res = await POST()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.url).toBe('https://billing.stripe.com/session_abc')

    expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'http://localhost:3000/billing',
    })
  })

  it('returns 500 when Stripe throws an error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { stripe_customer_id: 'cus_123' } }),
        }),
      }),
    }))

    mockBillingPortalSessionsCreate.mockRejectedValue(new Error('Stripe error'))

    const res = await POST()
    expect(res.status).toBe(500)

    const data = await res.json()
    expect(data.error).toBe('Failed to create portal session')
  })
})
