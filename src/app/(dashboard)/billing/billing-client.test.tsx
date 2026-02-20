import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BillingClient } from './billing-client'

describe('BillingClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows free plan info and upgrade CTA for free users', () => {
    render(
      <BillingClient
        plan="free"
        status="active"
        hasStripeCustomer={false}
        requestCount={42}
        aiAnalysisCount={3}
        maxRequests={100}
        maxAnalyses={5}
        currentPeriodEnd={null}
        cancelAtPeriodEnd={false}
      />
    )

    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('42 / 100')).toBeInTheDocument()
    expect(screen.getByText('3 / 5')).toBeInTheDocument()
    expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Upgrade to Pro/ })).toBeInTheDocument()
  })

  it('shows pro plan info and manage button for pro users', () => {
    render(
      <BillingClient
        plan="pro"
        status="active"
        hasStripeCustomer={true}
        requestCount={500}
        aiAnalysisCount={25}
        maxRequests={Infinity}
        maxAnalyses={Infinity}
        currentPeriodEnd="2026-03-15T00:00:00Z"
        cancelAtPeriodEnd={false}
      />
    )

    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('500 / Unlimited')).toBeInTheDocument()
    expect(screen.getByText('25 / Unlimited')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Manage Subscription' })).toBeInTheDocument()
    // Upgrade CTA should not be shown
    expect(screen.queryByText('Upgrade to Pro')).not.toBeInTheDocument()
  })

  it('shows renewal date for pro users', () => {
    render(
      <BillingClient
        plan="pro"
        status="active"
        hasStripeCustomer={true}
        requestCount={0}
        aiAnalysisCount={0}
        maxRequests={Infinity}
        maxAnalyses={Infinity}
        currentPeriodEnd="2026-03-15T00:00:00Z"
        cancelAtPeriodEnd={false}
      />
    )

    expect(screen.getByText(/Renews on/)).toBeInTheDocument()
  })

  it('does not show Manage Subscription if no stripe customer', () => {
    render(
      <BillingClient
        plan="pro"
        status="active"
        hasStripeCustomer={false}
        requestCount={0}
        aiAnalysisCount={0}
        maxRequests={Infinity}
        maxAnalyses={Infinity}
        currentPeriodEnd={null}
        cancelAtPeriodEnd={false}
      />
    )

    expect(screen.queryByRole('button', { name: 'Manage Subscription' })).not.toBeInTheDocument()
  })

  it('calls checkout API when clicking upgrade', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/test' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    })

    render(
      <BillingClient
        plan="free"
        status="active"
        hasStripeCustomer={false}
        requestCount={0}
        aiAnalysisCount={0}
        maxRequests={100}
        maxAnalyses={5}
        currentPeriodEnd={null}
        cancelAtPeriodEnd={false}
      />
    )

    await user.click(screen.getByRole('button', { name: /Upgrade to Pro/ }))

    expect(mockFetch).toHaveBeenCalledWith('/api/stripe/checkout', { method: 'POST' })
  })

  it('calls portal API when clicking manage subscription', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ url: 'https://billing.stripe.com/session' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    })

    render(
      <BillingClient
        plan="pro"
        status="active"
        hasStripeCustomer={true}
        requestCount={0}
        aiAnalysisCount={0}
        maxRequests={Infinity}
        maxAnalyses={Infinity}
        currentPeriodEnd="2026-03-15T00:00:00Z"
        cancelAtPeriodEnd={false}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Manage Subscription' }))

    expect(mockFetch).toHaveBeenCalledWith('/api/stripe/portal', { method: 'POST' })
  })

  it('shows past_due warning banner with Update Payment button when status is past_due', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ url: 'https://billing.stripe.com/session' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    })

    render(
      <BillingClient
        plan="pro"
        status="past_due"
        hasStripeCustomer={true}
        requestCount={0}
        aiAnalysisCount={0}
        maxRequests={Infinity}
        maxAnalyses={Infinity}
        currentPeriodEnd="2026-03-15T00:00:00Z"
        cancelAtPeriodEnd={false}
      />
    )

    expect(screen.getByText('Payment failed')).toBeInTheDocument()
    expect(
      screen.getByText('Your payment failed. Pro features are suspended until payment is updated.')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Update Payment' }))

    expect(mockFetch).toHaveBeenCalledWith('/api/stripe/portal', { method: 'POST' })
  })

  it('does not show past_due warning banner for active subscriptions', () => {
    render(
      <BillingClient
        plan="pro"
        status="active"
        hasStripeCustomer={true}
        requestCount={0}
        aiAnalysisCount={0}
        maxRequests={Infinity}
        maxAnalyses={Infinity}
        currentPeriodEnd="2026-03-15T00:00:00Z"
        cancelAtPeriodEnd={false}
      />
    )

    expect(screen.queryByText('Payment failed')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Update Payment' })).not.toBeInTheDocument()
  })

  it('shows cancellation warning banner when cancel_at_period_end is true', () => {
    render(
      <BillingClient
        plan="pro"
        status="active"
        hasStripeCustomer={true}
        requestCount={0}
        aiAnalysisCount={0}
        maxRequests={Infinity}
        maxAnalyses={Infinity}
        currentPeriodEnd="2026-03-15T00:00:00Z"
        cancelAtPeriodEnd={true}
      />
    )

    expect(screen.getByText(/Your Pro plan ends on/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Re-subscribe/ })).toBeInTheDocument()
    // Should show "Ends on" instead of "Renews on"
    expect(screen.queryByText(/Renews on/)).not.toBeInTheDocument()
    expect(screen.getByText(/Ends on/)).toBeInTheDocument()
  })

  it('does not show cancellation banner for free plan even with cancelAtPeriodEnd=true', () => {
    render(
      <BillingClient
        plan="free"
        status="active"
        hasStripeCustomer={false}
        requestCount={0}
        aiAnalysisCount={0}
        maxRequests={100}
        maxAnalyses={5}
        currentPeriodEnd="2026-03-15T00:00:00Z"
        cancelAtPeriodEnd={true}
      />
    )

    expect(screen.queryByText(/Your Pro plan ends on/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Re-subscribe/ })).not.toBeInTheDocument()
  })

  it('does not show cancellation banner when cancelAtPeriodEnd is false', () => {
    render(
      <BillingClient
        plan="pro"
        status="active"
        hasStripeCustomer={true}
        requestCount={0}
        aiAnalysisCount={0}
        maxRequests={Infinity}
        maxAnalyses={Infinity}
        currentPeriodEnd="2026-03-15T00:00:00Z"
        cancelAtPeriodEnd={false}
      />
    )

    expect(screen.queryByText(/Your Pro plan ends on/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Re-subscribe/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Renews on/)).toBeInTheDocument()
  })

  it('calls portal API when clicking Re-subscribe', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: '/portal' }),
    } as Response)

    // @ts-expect-error - test override of global fetch
    globalThis.fetch = fetchMock

    render(
      <BillingClient
        plan="pro"
        status="active"
        hasStripeCustomer={true}
        requestCount={0}
        aiAnalysisCount={0}
        maxRequests={Infinity}
        maxAnalyses={Infinity}
        currentPeriodEnd="2026-03-15T00:00:00Z"
        cancelAtPeriodEnd={true}
      />
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Re-subscribe/ }))

    expect(fetchMock).toHaveBeenCalled()
  })
})
