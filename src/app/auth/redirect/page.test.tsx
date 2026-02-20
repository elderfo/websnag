import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AuthRedirectPage from './page'

const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}))

describe('AuthRedirectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows loading state', () => {
    render(<AuthRedirectPage />)
    expect(screen.getByText('Setting up your account...')).toBeInTheDocument()
  })

  it('redirects to /dashboard when no upgrade intent', async () => {
    render(<AuthRedirectPage />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('calls checkout API and redirects to Stripe when upgrade intent is set', async () => {
    localStorage.setItem('upgrade_intent', 'true')

    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    })

    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/session_123' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<AuthRedirectPage />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/stripe/checkout', { method: 'POST' })
    })

    expect(localStorage.getItem('upgrade_intent')).toBeNull()
    expect(window.location.href).toBe('https://checkout.stripe.com/session_123')
  })

  it('falls back to /dashboard when checkout API fails', async () => {
    localStorage.setItem('upgrade_intent', 'true')

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    render(<AuthRedirectPage />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard')
    })

    expect(localStorage.getItem('upgrade_intent')).toBeNull()
  })
})
