import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockAdminFrom = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: mockAdminFrom,
  })),
}))

const mockConstructEvent = vi.fn()
const mockSubscriptionsRetrieve = vi.fn()

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
    subscriptions: {
      retrieve: (...args: unknown[]) => mockSubscriptionsRetrieve(...args),
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

import { POST } from '../webhook/route'

function makeRequest(body: string, signature: string | null = 'sig_test'): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (signature) {
    headers['stripe-signature'] = signature
  }
  return new Request('http://localhost:3000/api/stripe/webhook', {
    method: 'POST',
    headers,
    body,
  })
}

function mockUpdateChain() {
  const eqMock = vi.fn().mockResolvedValue({ error: null })
  const updateMock = vi.fn().mockReturnValue({
    eq: eqMock,
  })
  mockAdminFrom.mockReturnValue({ update: updateMock })
  return updateMock
}

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  })

  it('returns 400 when no signature is provided', async () => {
    const res = await POST(makeRequest('{}', null))
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('No signature')
  })

  it('returns 400 when signature is invalid', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('Invalid signature')
  })

  it('handles checkout.session.completed event', async () => {
    const updateMock = mockUpdateChain()

    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_123',
          subscription: 'sub_456',
        },
      },
    })

    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ current_period_end: 1700000000 }] },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.received).toBe(true)

    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_456')
    expect(updateMock).toHaveBeenCalledWith({
      plan: 'pro',
      status: 'active',
      stripe_subscription_id: 'sub_456',
      current_period_end: new Date(1700000000 * 1000).toISOString(),
    })
  })

  it('handles customer.subscription.updated event (active)', async () => {
    const updateMock = mockUpdateChain()

    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          customer: 'cus_123',
          status: 'active',
          cancel_at_period_end: false,
          items: { data: [{ current_period_end: 1700000000 }] },
        },
      },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)

    expect(updateMock).toHaveBeenCalledWith({
      plan: 'pro',
      status: 'active',
      current_period_end: new Date(1700000000 * 1000).toISOString(),
      cancel_at_period_end: false,
    })
  })

  it('handles customer.subscription.updated event (canceled at period end)', async () => {
    const updateMock = mockUpdateChain()

    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          customer: 'cus_123',
          status: 'active',
          cancel_at_period_end: true,
          items: { data: [{ current_period_end: 1700000000 }] },
        },
      },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)

    expect(updateMock).toHaveBeenCalledWith({
      plan: 'pro',
      status: 'active',
      current_period_end: new Date(1700000000 * 1000).toISOString(),
      cancel_at_period_end: true,
    })
  })

  it('handles customer.subscription.updated event (not active)', async () => {
    const updateMock = mockUpdateChain()

    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          customer: 'cus_123',
          status: 'canceled',
          cancel_at_period_end: false,
          items: { data: [{ current_period_end: 1700000000 }] },
        },
      },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)

    expect(updateMock).toHaveBeenCalledWith({
      plan: 'free',
      status: 'canceled',
      current_period_end: new Date(1700000000 * 1000).toISOString(),
      cancel_at_period_end: false,
    })
  })

  it('handles customer.subscription.deleted event', async () => {
    const updateMock = mockUpdateChain()

    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          customer: 'cus_123',
        },
      },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)

    expect(updateMock).toHaveBeenCalledWith({
      plan: 'free',
      status: 'canceled',
      cancel_at_period_end: false,
    })
  })

  it('handles invoice.payment_failed event', async () => {
    const updateMock = mockUpdateChain()

    mockConstructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: {
        object: {
          customer: 'cus_123',
        },
      },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)

    expect(updateMock).toHaveBeenCalledWith({
      status: 'past_due',
    })
  })

  it('returns success for unhandled event types', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'some.other.event',
      data: { object: {} },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.received).toBe(true)
  })
})
