import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

describe('SettingsClient', () => {
  it('displays user email', () => {
    render(<SettingsClient email="user@example.com" createdAt="2026-01-15T00:00:00Z" plan="free" />)

    expect(screen.getByText('user@example.com')).toBeInTheDocument()
  })

  it('displays member since date', () => {
    render(<SettingsClient email="user@example.com" createdAt="2026-01-15T00:00:00Z" plan="free" />)

    // Use a locale-independent check
    const dateStr = new Date('2026-01-15T00:00:00Z').toLocaleDateString()
    expect(screen.getByText(dateStr)).toBeInTheDocument()
  })

  it('shows free plan badge', () => {
    render(<SettingsClient email="user@example.com" createdAt="2026-01-15T00:00:00Z" plan="free" />)

    expect(screen.getByText('Free')).toBeInTheDocument()
  })

  it('shows pro plan badge', () => {
    render(<SettingsClient email="user@example.com" createdAt="2026-01-15T00:00:00Z" plan="pro" />)

    expect(screen.getByText('Pro')).toBeInTheDocument()
  })

  it('navigates to billing page when clicking manage billing', async () => {
    const user = userEvent.setup()

    render(<SettingsClient email="user@example.com" createdAt="2026-01-15T00:00:00Z" plan="free" />)

    await user.click(screen.getByRole('button', { name: 'Manage Billing' }))

    expect(mockPush).toHaveBeenCalledWith('/billing')
  })

  it('signs out and redirects to login', async () => {
    const user = userEvent.setup()
    mockSignOut.mockResolvedValue({})

    render(<SettingsClient email="user@example.com" createdAt="2026-01-15T00:00:00Z" plan="free" />)

    await user.click(screen.getByRole('button', { name: 'Sign Out' }))

    expect(mockSignOut).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('shows danger zone with support contact', () => {
    render(<SettingsClient email="user@example.com" createdAt="2026-01-15T00:00:00Z" plan="free" />)

    expect(screen.getByText('Danger Zone')).toBeInTheDocument()
    expect(screen.getByText('support@websnag.dev')).toBeInTheDocument()
  })
})
