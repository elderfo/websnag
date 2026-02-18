import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing the route
const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

const mockAdminFrom = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: mockAdminFrom,
  })),
}))

const mockCustomersCreate = vi.fn()
const mockCheckoutSessionsCreate = vi.fn()

vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: {
      create: (...args: unknown[]) => mockCustomersCreate(...args),
    },
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockCheckoutSessionsCreate(...args),
      },
    },
  },
}))

import { POST } from '../checkout/route'

describe('POST /api/stripe/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_PRO_PRICE_ID = 'price_test_123'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await POST()
    expect(res.status).toBe(401)

    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('creates a new Stripe customer when none exists', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
    })

    // No existing subscription
    mockAdminFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null }),
        }),
      }),
      upsert: () => Promise.resolve({ error: null }),
    }))

    mockCustomersCreate.mockResolvedValue({ id: 'cus_new_123' })
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session123' })

    const res = await POST()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.url).toBe('https://checkout.stripe.com/session123')

    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'test@example.com',
      metadata: { user_id: 'user-1' },
    })

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_new_123',
        line_items: [{ price: 'price_test_123', quantity: 1 }],
        success_url: 'http://localhost:3000/dashboard?upgrade=success',
        cancel_url: 'http://localhost:3000/billing',
        allow_promotion_codes: true,
      })
    )
  })

  it('uses existing Stripe customer when one exists', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
    })

    // Existing subscription with customer ID
    mockAdminFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { stripe_customer_id: 'cus_existing_456' } }),
        }),
      }),
    }))

    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session456' })

    const res = await POST()
    expect(res.status).toBe(200)

    // Should not create a new customer
    expect(mockCustomersCreate).not.toHaveBeenCalled()

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_existing_456',
      })
    )
  })

  it('returns 500 when Stripe throws an error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
    })

    mockAdminFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { stripe_customer_id: 'cus_existing_456' } }),
        }),
      }),
    }))

    mockCheckoutSessionsCreate.mockRejectedValue(new Error('Stripe API error'))

    const res = await POST()
    expect(res.status).toBe(500)

    const data = await res.json()
    expect(data.error).toBe('Failed to create checkout session')
  })
})
