import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpgradePrompt } from './upgrade-prompt'

describe('UpgradePrompt', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('displays the feature limit message', () => {
    render(<UpgradePrompt feature="AI analysis" />)

    expect(screen.getByText("You've reached your AI analysis limit")).toBeInTheDocument()
  })

  it('lists pro benefits', () => {
    render(<UpgradePrompt feature="endpoints" />)

    expect(screen.getByText('Unlimited endpoints')).toBeInTheDocument()
    expect(screen.getByText('Unlimited requests per month')).toBeInTheDocument()
    expect(screen.getByText('Unlimited AI analyses')).toBeInTheDocument()
    expect(screen.getByText('30-day request history')).toBeInTheDocument()
    expect(screen.getByText('Webhook replay')).toBeInTheDocument()
    expect(screen.getByText('Custom endpoint slugs')).toBeInTheDocument()
  })

  it('shows the upgrade button with price', () => {
    render(<UpgradePrompt feature="requests" />)

    expect(screen.getByRole('button', { name: /Upgrade to Pro/ })).toBeInTheDocument()
  })

  it('calls checkout API and redirects on click', async () => {
    const user = userEvent.setup()

    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/test' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    // Mock window.location
    const locationAssignMock = { href: '' }
    Object.defineProperty(window, 'location', {
      value: locationAssignMock,
      writable: true,
    })

    render(<UpgradePrompt feature="requests" />)

    await user.click(screen.getByRole('button', { name: /Upgrade to Pro/ }))

    expect(mockFetch).toHaveBeenCalledWith('/api/stripe/checkout', { method: 'POST' })
    expect(locationAssignMock.href).toBe('https://checkout.stripe.com/test')
  })

  it('shows loading state while redirecting', async () => {
    const user = userEvent.setup()

    // Create a promise we can control
    let resolvePromise: (value: unknown) => void
    const pending = new Promise((resolve) => {
      resolvePromise = resolve
    })

    const mockFetch = vi.fn().mockReturnValue(pending)
    vi.stubGlobal('fetch', mockFetch)

    render(<UpgradePrompt feature="requests" />)

    await user.click(screen.getByRole('button', { name: /Upgrade to Pro/ }))

    expect(screen.getByRole('button', { name: 'Redirecting...' })).toBeDisabled()

    // Cleanup
    resolvePromise!({ json: () => Promise.resolve({ url: null }) })
  })
})
