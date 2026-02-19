import { describe, it, expect, vi, beforeEach } from 'vitest'
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
}

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
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
    const user = userEvent.setup()
    render(<SettingsClient {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Manage Billing' }))
    expect(mockPush).toHaveBeenCalledWith('/billing')
  })

  it('signs out and redirects to login', async () => {
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

    it('enables button when username is 3+ characters', async () => {
      const user = userEvent.setup()
      render(<SettingsClient {...defaultProps} />)
      await user.type(screen.getByPlaceholderText('your-username'), 'abc')
      expect(screen.getByRole('button', { name: 'Set Username' })).toBeEnabled()
    })

    it('lowercases input', async () => {
      const user = userEvent.setup()
      render(<SettingsClient {...defaultProps} />)
      await user.type(screen.getByPlaceholderText('your-username'), 'MyUser')
      expect(screen.getByPlaceholderText('your-username')).toHaveValue('myuser')
    })

    it('saves username and locks input on success', async () => {
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ username: 'testuser' }),
      } as Response)

      render(<SettingsClient {...defaultProps} />)
      await user.type(screen.getByPlaceholderText('your-username'), 'testuser')
      await user.click(screen.getByRole('button', { name: 'Set Username' }))

      await waitFor(() => {
        expect(screen.getByText('Locked')).toBeInTheDocument()
      })
      expect(screen.queryByPlaceholderText('your-username')).not.toBeInTheDocument()
    })

    it('shows error on API failure', async () => {
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Username already taken' }),
      } as Response)

      render(<SettingsClient {...defaultProps} />)
      await user.type(screen.getByPlaceholderText('your-username'), 'taken')
      await user.click(screen.getByRole('button', { name: 'Set Username' }))

      await waitFor(() => {
        expect(screen.getByText('Username already taken')).toBeInTheDocument()
      })
    })

    it('shows error on network failure', async () => {
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

      render(<SettingsClient {...defaultProps} />)
      await user.type(screen.getByPlaceholderText('your-username'), 'testuser')
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
  })
})
