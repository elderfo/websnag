import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsClient } from './settings-client'

const mockPush = vi.fn()
const mockSignOut = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signOut: mockSignOut },
  }),
}))

const defaultProps = {
  email: 'user@example.com',
  createdAt: '2026-01-15T00:00:00Z',
  plan: 'free' as const,
  initialUsername: null,
  isSetup: false,
  redirectAfterSave: null,
}

/** Mock fetch that routes availability checks and saves separately */
function mockFetchForUsername(opts?: {
  checkAvailable?: boolean
  checkReason?: string
  checkServerError?: boolean
  checkNetworkError?: boolean
  saveOk?: boolean
  saveBody?: Record<string, unknown>
  saveError?: boolean
}) {
  const {
    checkAvailable = true,
    checkReason,
    checkServerError = false,
    checkNetworkError = false,
    saveOk = true,
    saveBody = { username: 'testuser' },
    saveError = false,
  } = opts ?? {}

  return vi.fn().mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/api/username/check')) {
      if (checkNetworkError) {
        return Promise.reject(new Error('Network error'))
      }
      if (checkServerError) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Internal server error' }),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: async () =>
          checkAvailable
            ? { available: true }
            : { available: false, reason: checkReason ?? 'Username is already taken' },
      } as Response)
    }
    // All other requests (save endpoint)
    if (saveError) {
      return Promise.reject(new Error('Network error'))
    }
    return Promise.resolve({
      ok: saveOk,
      json: async () => saveBody,
    } as Response)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  global.fetch = mockFetchForUsername()
  // scrollIntoView is not implemented in JSDOM
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SettingsClient', () => {
  it('displays user email', () => {
    render(<SettingsClient {...defaultProps} />)
    expect(screen.getByText('user@example.com')).toBeInTheDocument()
  })

  it('displays member since date', () => {
    render(<SettingsClient {...defaultProps} />)
    const dateStr = new Date('2026-01-15T00:00:00Z').toLocaleDateString()
    expect(screen.getByText(dateStr)).toBeInTheDocument()
  })

  it('shows free plan badge', () => {
    render(<SettingsClient {...defaultProps} />)
    expect(screen.getByText('Free')).toBeInTheDocument()
  })

  it('shows pro plan badge', () => {
    render(<SettingsClient {...defaultProps} plan="pro" />)
    expect(screen.getByText('Pro')).toBeInTheDocument()
  })

  it('navigates to billing page when clicking manage billing', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    render(<SettingsClient {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Manage Billing' }))
    expect(mockPush).toHaveBeenCalledWith('/billing')
  })

  it('signs out and redirects to login', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    mockSignOut.mockResolvedValue({})
    render(<SettingsClient {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Sign Out' }))
    expect(mockSignOut).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('shows danger zone with support contact', () => {
    render(<SettingsClient {...defaultProps} />)
    expect(screen.getByText('Danger Zone')).toBeInTheDocument()
    expect(screen.getByText('support@websnag.dev')).toBeInTheDocument()
  })

  describe('username', () => {
    it('shows input when no username is set', () => {
      render(<SettingsClient {...defaultProps} />)
      expect(screen.getByPlaceholderText('your-username')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Set Username' })).toBeInTheDocument()
    })

    it('shows locked badge when username is already set', () => {
      render(<SettingsClient {...defaultProps} initialUsername="myuser" />)
      expect(screen.getAllByText('myuser').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Locked')).toBeInTheDocument()
      expect(screen.queryByPlaceholderText('your-username')).not.toBeInTheDocument()
    })

    it('disables button when username is too short', () => {
      render(<SettingsClient {...defaultProps} />)
      const button = screen.getByRole('button', { name: 'Set Username' })
      expect(button).toBeDisabled()
    })

    it('lowercases input', async () => {
      vi.useRealTimers()
      const user = userEvent.setup()
      render(<SettingsClient {...defaultProps} />)
      await user.type(screen.getByPlaceholderText('your-username'), 'MyUser')
      expect(screen.getByPlaceholderText('your-username')).toHaveValue('myuser')
    })

    it('checks availability after typing and shows available', async () => {
      vi.useRealTimers()
      global.fetch = mockFetchForUsername({ checkAvailable: true })
      const user = userEvent.setup()
      render(<SettingsClient {...defaultProps} />)

      await user.type(screen.getByPlaceholderText('your-username'), 'freeuser')

      await waitFor(() => {
        expect(screen.getByText('Username is available')).toBeInTheDocument()
      })
    })

    it('shows taken message when username is unavailable', async () => {
      vi.useRealTimers()
      global.fetch = mockFetchForUsername({
        checkAvailable: false,
        checkReason: 'Username is already taken',
      })
      const user = userEvent.setup()
      render(<SettingsClient {...defaultProps} />)

      await user.type(screen.getByPlaceholderText('your-username'), 'takenuser')

      await waitFor(() => {
        expect(screen.getByText('Username is already taken')).toBeInTheDocument()
      })
    })

    it('disables save button when username is unavailable', async () => {
      vi.useRealTimers()
      global.fetch = mockFetchForUsername({
        checkAvailable: false,
        checkReason: 'Username is already taken',
      })
      const user = userEvent.setup()
      render(<SettingsClient {...defaultProps} />)

      await user.type(screen.getByPlaceholderText('your-username'), 'takenuser')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Set Username' })).toBeDisabled()
      })
    })

    it('saves username and locks input on success', async () => {
      vi.useRealTimers()
      global.fetch = mockFetchForUsername({
        checkAvailable: true,
        saveOk: true,
        saveBody: { username: 'testuser' },
      })
      const user = userEvent.setup()
      render(<SettingsClient {...defaultProps} />)

      await user.type(screen.getByPlaceholderText('your-username'), 'testuser')

      // Wait for availability check to resolve
      await waitFor(() => {
        expect(screen.getByText('Username is available')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Set Username' }))

      await waitFor(() => {
        expect(screen.getByText('Locked')).toBeInTheDocument()
      })
      expect(screen.queryByPlaceholderText('your-username')).not.toBeInTheDocument()
    })

    it('shows error on save API failure', async () => {
      vi.useRealTimers()
      global.fetch = mockFetchForUsername({
        checkAvailable: true,
        saveOk: false,
        saveBody: { error: 'Username already taken' },
      })
      const user = userEvent.setup()
      render(<SettingsClient {...defaultProps} />)

      await user.type(screen.getByPlaceholderText('your-username'), 'taken')

      await waitFor(() => {
        expect(screen.getByText('Username is available')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Set Username' }))

      await waitFor(() => {
        expect(screen.getByText('Username already taken')).toBeInTheDocument()
      })
    })

    it('shows error on network failure during save', async () => {
      vi.useRealTimers()
      global.fetch = mockFetchForUsername({ checkAvailable: true, saveError: true })
      const user = userEvent.setup()
      render(<SettingsClient {...defaultProps} />)

      await user.type(screen.getByPlaceholderText('your-username'), 'testuser')

      await waitFor(() => {
        expect(screen.getByText('Username is available')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Set Username' }))

      await waitFor(() => {
        expect(screen.getByText('Failed to save username')).toBeInTheDocument()
      })
    })

    it('shows webhook URL preview with username', () => {
      render(<SettingsClient {...defaultProps} initialUsername="myuser" />)
      expect(screen.getByText('myuser', { selector: '.text-accent' })).toBeInTheDocument()
    })

    it('shows placeholder in URL preview when no username', () => {
      render(<SettingsClient {...defaultProps} />)
      expect(screen.getByText('your-username', { selector: '.text-accent' })).toBeInTheDocument()
    })

    it('disables button for regex-invalid username (leading hyphen)', async () => {
      vi.useRealTimers()
      const user = userEvent.setup()
      render(<SettingsClient {...defaultProps} />)
      await user.type(screen.getByPlaceholderText('your-username'), '-abc')
      expect(screen.getByRole('button', { name: 'Set Username' })).toBeDisabled()
    })

    it('shows error message when check endpoint returns server error', async () => {
      vi.useRealTimers()
      global.fetch = mockFetchForUsername({ checkServerError: true })
      const user = userEvent.setup()
      render(<SettingsClient {...defaultProps} />)

      await user.type(screen.getByPlaceholderText('your-username'), 'testuser')

      await waitFor(() => {
        expect(
          screen.getByText('Could not verify availability. You can still try saving.')
        ).toBeInTheDocument()
      })
    })

    it('shows error message when check endpoint has network failure', async () => {
      vi.useRealTimers()
      global.fetch = mockFetchForUsername({ checkNetworkError: true })
      const user = userEvent.setup()
      render(<SettingsClient {...defaultProps} />)

      await user.type(screen.getByPlaceholderText('your-username'), 'testuser')

      await waitFor(() => {
        expect(
          screen.getByText('Could not verify availability. You can still try saving.')
        ).toBeInTheDocument()
      })
    })

    it('redirects to redirectAfterSave when it is a relative path', async () => {
      vi.useRealTimers()
      global.fetch = mockFetchForUsername({
        checkAvailable: true,
        saveOk: true,
        saveBody: { username: 'testuser' },
      })
      const user = userEvent.setup()
      render(<SettingsClient {...defaultProps} isSetup redirectAfterSave="/endpoints/new" />)

      await user.type(screen.getByPlaceholderText('your-username'), 'testuser')

      await waitFor(() => {
        expect(screen.getByText('Username is available')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Set Username' }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/endpoints/new')
      })
    })

    it('redirects to /dashboard when redirectAfterSave is an absolute URL (open redirect prevention)', async () => {
      vi.useRealTimers()
      global.fetch = mockFetchForUsername({
        checkAvailable: true,
        saveOk: true,
        saveBody: { username: 'testuser' },
      })
      const user = userEvent.setup()
      render(<SettingsClient {...defaultProps} isSetup redirectAfterSave="https://evil.com" />)

      await user.type(screen.getByPlaceholderText('your-username'), 'testuser')

      await waitFor(() => {
        expect(screen.getByText('Username is available')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Set Username' }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('redirects to /dashboard when redirectAfterSave is a protocol-relative URL', async () => {
      vi.useRealTimers()
      global.fetch = mockFetchForUsername({
        checkAvailable: true,
        saveOk: true,
        saveBody: { username: 'testuser' },
      })
      const user = userEvent.setup()
      render(<SettingsClient {...defaultProps} isSetup redirectAfterSave="//evil.com" />)

      await user.type(screen.getByPlaceholderText('your-username'), 'testuser')

      await waitFor(() => {
        expect(screen.getByText('Username is available')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Set Username' }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })
  })
})
