import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Header } from './header'

const mockPush = vi.fn()
const mockSignOut = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: mockSignOut,
    },
  }),
}))

function getFirst(text: string | RegExp) {
  return screen.getAllByText(text)[0]
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue({ error: null })
  })

  it('renders the user initial avatar', () => {
    render(<Header userEmail="user@example.com" plan="free" />)
    expect(getFirst('U')).toBeInTheDocument()
  })

  it('renders the user email in the trigger', () => {
    render(<Header userEmail="user@example.com" plan="free" />)
    expect(getFirst('user@example.com')).toBeInTheDocument()
  })

  it('shows dropdown with email and plan badge when clicked', () => {
    render(<Header userEmail="user@example.com" plan="free" />)
    // Click the trigger to open dropdown
    const trigger = screen.getByRole('button', { expanded: false })
    fireEvent.click(trigger)
    // Dropdown should show full email and plan badge
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Log out')).toBeInTheDocument()
  })

  it('shows Pro badge for pro users', () => {
    render(<Header userEmail="user@example.com" plan="pro" />)
    const trigger = screen.getByRole('button', { expanded: false })
    fireEvent.click(trigger)
    expect(screen.getByText('Pro')).toBeInTheDocument()
  })

  it('signs out and redirects to / when log out is clicked', async () => {
    render(<Header userEmail="user@example.com" plan="free" />)
    const trigger = screen.getByRole('button', { expanded: false })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByText('Log out'))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('renders the mobile wordmark', () => {
    render(<Header userEmail="user@example.com" plan="free" />)
    expect(getFirst('web')).toBeInTheDocument()
    expect(getFirst('snag')).toBeInTheDocument()
  })

  it('renders mobile nav slot when provided', () => {
    render(
      <Header
        userEmail="user@example.com"
        plan="free"
        mobileNav={<div data-testid="mobile-nav">mobile</div>}
      />
    )
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument()
  })

  it('closes dropdown on escape key', () => {
    render(<Header userEmail="user@example.com" plan="free" />)
    const trigger = screen.getByRole('button', { expanded: false })
    fireEvent.click(trigger)
    expect(screen.getByText('Log out')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Log out')).not.toBeInTheDocument()
  })

  it('closes dropdown when clicking outside', () => {
    render(<Header userEmail="user@example.com" plan="free" />)
    const trigger = screen.getByRole('button', { expanded: false })
    fireEvent.click(trigger)
    expect(screen.getByText('Log out')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Log out')).not.toBeInTheDocument()
  })
})
