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

  it('renders the user email', () => {
    render(<Header userEmail="user@example.com" />)
    expect(getFirst('user@example.com')).toBeInTheDocument()
  })

  it('renders the user initial avatar', () => {
    render(<Header userEmail="user@example.com" />)
    expect(getFirst('U')).toBeInTheDocument()
  })

  it('renders the sign out button', () => {
    render(<Header userEmail="user@example.com" />)
    expect(getFirst('Sign out')).toBeInTheDocument()
  })

  it('signs out and redirects when sign out is clicked', async () => {
    render(<Header userEmail="user@example.com" />)
    const buttons = screen.getAllByText('Sign out')
    fireEvent.click(buttons[0])

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('renders the mobile logo', () => {
    render(<Header userEmail="user@example.com" />)
    expect(getFirst('websnag')).toBeInTheDocument()
  })

  it('renders mobile nav slot when provided', () => {
    render(
      <Header userEmail="user@example.com" mobileNav={<div data-testid="mobile-nav">mobile</div>} />
    )
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument()
  })
})
