import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useRouter, useSearchParams } from 'next/navigation'
import { UpgradeBanner } from './upgrade-banner'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}))

const mockUseRouter = vi.mocked(useRouter)
const mockUseSearchParams = vi.mocked(useSearchParams)

describe('UpgradeBanner', () => {
  const mockReplace = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseRouter.mockReturnValue({
      replace: mockReplace,
      push: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    })
  })

  it('renders the success message when upgrade=success is in search params', () => {
    const params = new URLSearchParams('upgrade=success')
    mockUseSearchParams.mockReturnValue(params as ReturnType<typeof useSearchParams>)

    render(<UpgradeBanner />)

    expect(screen.getByText('Welcome to Pro!')).toBeInTheDocument()
    expect(
      screen.getByText('You now have unlimited endpoints, requests, and AI analyses.')
    ).toBeInTheDocument()
  })

  it('does not render when upgrade param is absent', () => {
    const params = new URLSearchParams('')
    mockUseSearchParams.mockReturnValue(params as ReturnType<typeof useSearchParams>)

    const { container } = render(<UpgradeBanner />)

    expect(container.firstChild).toBeNull()
  })

  it('does not render when upgrade param has a different value', () => {
    const params = new URLSearchParams('upgrade=pending')
    mockUseSearchParams.mockReturnValue(params as ReturnType<typeof useSearchParams>)

    const { container } = render(<UpgradeBanner />)

    expect(container.firstChild).toBeNull()
  })

  it('navigates to /dashboard when dismiss button is clicked', async () => {
    const user = userEvent.setup()
    const params = new URLSearchParams('upgrade=success')
    mockUseSearchParams.mockReturnValue(params as ReturnType<typeof useSearchParams>)

    render(<UpgradeBanner />)

    const dismissButton = screen.getByRole('button', { name: /dismiss upgrade confirmation/i })
    await user.click(dismissButton)

    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
  })

  it('renders a dismiss button with accessible label', () => {
    const params = new URLSearchParams('upgrade=success')
    mockUseSearchParams.mockReturnValue(params as ReturnType<typeof useSearchParams>)

    render(<UpgradeBanner />)

    const dismissButton = screen.getByRole('button', { name: /dismiss upgrade confirmation/i })
    expect(dismissButton).toBeInTheDocument()
  })
})
