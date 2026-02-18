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
        hasStripeCustomer={false}
        requestCount={42}
        aiAnalysisCount={3}
        maxRequests={100}
        maxAnalyses={5}
        currentPeriodEnd={null}
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
        hasStripeCustomer={true}
        requestCount={500}
        aiAnalysisCount={25}
        maxRequests={Infinity}
        maxAnalyses={Infinity}
        currentPeriodEnd="2026-03-15T00:00:00Z"
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
        hasStripeCustomer={true}
        requestCount={0}
        aiAnalysisCount={0}
        maxRequests={Infinity}
        maxAnalyses={Infinity}
        currentPeriodEnd="2026-03-15T00:00:00Z"
      />
    )

    expect(screen.getByText(/Renews on/)).toBeInTheDocument()
  })

  it('does not show Manage Subscription if no stripe customer', () => {
    render(
      <BillingClient
        plan="pro"
        hasStripeCustomer={false}
        requestCount={0}
        aiAnalysisCount={0}
        maxRequests={Infinity}
        maxAnalyses={Infinity}
        currentPeriodEnd={null}
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
        hasStripeCustomer={false}
        requestCount={0}
        aiAnalysisCount={0}
        maxRequests={100}
        maxAnalyses={5}
        currentPeriodEnd={null}
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
        hasStripeCustomer={true}
        requestCount={0}
        aiAnalysisCount={0}
        maxRequests={Infinity}
        maxAnalyses={Infinity}
        currentPeriodEnd="2026-03-15T00:00:00Z"
      />
    )

    await user.click(screen.getByRole('button', { name: 'Manage Subscription' }))

    expect(mockFetch).toHaveBeenCalledWith('/api/stripe/portal', { method: 'POST' })
  })
})
