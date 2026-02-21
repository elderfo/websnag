import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginForm } from './login-form'

const mockSignInWithOAuth = vi.fn()
const mockSignInWithOtp = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      signInWithOtp: mockSignInWithOtp,
    },
  }),
}))

// Helper to get the first matching element (React 19 strict mode may double-render)
function getButton(name: RegExp) {
  const buttons = screen.getAllByRole('button', { name })
  return buttons[0]
}

function getInput(label: RegExp) {
  const inputs = screen.getAllByLabelText(label)
  return inputs[0]
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockSignInWithOAuth.mockResolvedValue({ error: null })
    mockSignInWithOtp.mockResolvedValue({ error: null })
  })

  it('renders the branding and sign-in heading', () => {
    render(<LoginForm />)
    expect(screen.getByRole('heading')).toBeInTheDocument()
    expect(screen.getAllByText('web').length).toBeGreaterThan(0)
    expect(screen.getAllByText('snag').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sign in to your account').length).toBeGreaterThan(0)
  })

  it('renders GitHub OAuth button', () => {
    render(<LoginForm />)
    expect(getButton(/continue with github/i)).toBeInTheDocument()
  })

  it('renders email input and magic link button', () => {
    render(<LoginForm />)
    expect(getInput(/email address/i)).toBeInTheDocument()
    expect(getButton(/send magic link/i)).toBeInTheDocument()
  })

  it('calls signInWithOAuth when GitHub button is clicked', async () => {
    render(<LoginForm />)
    fireEvent.click(getButton(/continue with github/i))

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'github',
        options: {
          redirectTo: expect.stringContaining('/auth/callback'),
        },
      })
    })
  })

  it('calls signInWithOtp when magic link form is submitted', async () => {
    render(<LoginForm />)

    const emailInput = getInput(/email address/i)
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(getButton(/send magic link/i))

    await waitFor(() => {
      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          emailRedirectTo: expect.stringContaining('/auth/callback'),
        },
      })
    })
  })

  it('shows success message after magic link is sent', async () => {
    render(<LoginForm />)

    const emailInput = getInput(/email address/i)
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(getButton(/send magic link/i))

    await waitFor(() => {
      expect(screen.getAllByText(/check your email/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText('test@example.com').length).toBeGreaterThan(0)
    })
  })

  it('shows error message when GitHub OAuth fails', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      error: { message: 'OAuth provider error' },
    })

    render(<LoginForm />)
    fireEvent.click(getButton(/continue with github/i))

    await waitFor(() => {
      expect(screen.getAllByText('OAuth provider error').length).toBeGreaterThan(0)
    })
  })

  it('shows error message when magic link fails', async () => {
    mockSignInWithOtp.mockResolvedValue({
      error: { message: 'Rate limit exceeded' },
    })

    render(<LoginForm />)

    const emailInput = getInput(/email address/i)
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(getButton(/send magic link/i))

    await waitFor(() => {
      expect(screen.getAllByText('Rate limit exceeded').length).toBeGreaterThan(0)
    })
  })

  it('allows returning to login form from success state', async () => {
    render(<LoginForm />)

    const emailInput = getInput(/email address/i)
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(getButton(/send magic link/i))

    await waitFor(() => {
      expect(screen.getAllByText(/check your email/i).length).toBeGreaterThan(0)
    })

    const backLinks = screen.getAllByText(/use a different email/i)
    fireEvent.click(backLinks[0])

    expect(getButton(/send magic link/i)).toBeInTheDocument()
  })

  it('stores upgrade intent in localStorage when intent=upgrade is in URL', () => {
    // Mock window.location.search
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '?intent=upgrade',
        origin: 'http://localhost:3000',
      },
      writable: true,
    })

    render(<LoginForm />)

    expect(localStorage.getItem('upgrade_intent')).toBe('true')
  })

  it('clears stale upgrade intent from localStorage when no intent param is present', () => {
    localStorage.setItem('upgrade_intent', 'true')

    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '',
        origin: 'http://localhost:3000',
      },
      writable: true,
    })

    render(<LoginForm />)

    expect(localStorage.getItem('upgrade_intent')).toBeNull()
  })
})
