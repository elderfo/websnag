import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockUseUsage = vi.fn()

vi.mock('@/hooks/use-usage', () => ({
  useUsage: () => mockUseUsage(),
}))

import { UsageDisplay } from './usage-display'

describe('UsageDisplay', () => {
  it('shows loading skeleton when loading', () => {
    mockUseUsage.mockReturnValue({ usage: null, loading: true })

    const { container } = render(<UsageDisplay />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders nothing when no usage data and not loading', () => {
    mockUseUsage.mockReturnValue({ usage: null, loading: false })

    render(<UsageDisplay />)
    // Should render nothing meaningful
    expect(screen.queryByText('Current Usage')).not.toBeInTheDocument()
  })

  it('displays free plan badge and usage bars', () => {
    mockUseUsage.mockReturnValue({
      usage: { requestCount: 42, aiAnalysisCount: 3, plan: 'free' },
      loading: false,
    })

    render(<UsageDisplay />)

    expect(screen.getByText('Current Usage')).toBeInTheDocument()
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('42 / 100')).toBeInTheDocument()
    expect(screen.getByText('3 / 5')).toBeInTheDocument()
  })

  it('displays pro plan badge with unlimited usage', () => {
    mockUseUsage.mockReturnValue({
      usage: { requestCount: 500, aiAnalysisCount: 25, plan: 'pro' },
      loading: false,
    })

    render(<UsageDisplay />)

    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('500 / Unlimited')).toBeInTheDocument()
    expect(screen.getByText('25 / Unlimited')).toBeInTheDocument()
  })

  it('shows green progress bar when under 50%', () => {
    mockUseUsage.mockReturnValue({
      usage: { requestCount: 10, aiAnalysisCount: 1, plan: 'free' },
      loading: false,
    })

    const { container } = render(<UsageDisplay />)
    const progressBars = container.querySelectorAll('[role="progressbar"]')
    expect(progressBars[0]?.className).toContain('bg-green-500')
  })

  it('shows yellow progress bar when between 50-80%', () => {
    mockUseUsage.mockReturnValue({
      usage: { requestCount: 60, aiAnalysisCount: 1, plan: 'free' },
      loading: false,
    })

    const { container } = render(<UsageDisplay />)
    const progressBars = container.querySelectorAll('[role="progressbar"]')
    expect(progressBars[0]?.className).toContain('bg-yellow-500')
  })

  it('shows red progress bar when over 80%', () => {
    mockUseUsage.mockReturnValue({
      usage: { requestCount: 90, aiAnalysisCount: 1, plan: 'free' },
      loading: false,
    })

    const { container } = render(<UsageDisplay />)
    const progressBars = container.querySelectorAll('[role="progressbar"]')
    expect(progressBars[0]?.className).toContain('bg-red-500')
  })
})
