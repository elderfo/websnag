import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sidebar } from './sidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

function getFirst(text: string | RegExp) {
  return screen.getAllByText(text)[0]
}

describe('Sidebar', () => {
  it('renders the websnag wordmark', () => {
    render(<Sidebar />)
    expect(getFirst('web')).toBeInTheDocument()
    expect(getFirst('snag')).toBeInTheDocument()
  })

  it('renders all navigation links', () => {
    render(<Sidebar />)
    expect(getFirst('Dashboard')).toBeInTheDocument()
    expect(getFirst('Endpoints')).toBeInTheDocument()
    expect(getFirst('Settings')).toBeInTheDocument()
    expect(getFirst('Billing')).toBeInTheDocument()
  })

  it('highlights the active link', () => {
    render(<Sidebar />)
    const dashboardLinks = screen.getAllByText('Dashboard')
    const dashboardLink = dashboardLinks[0].closest('a')
    expect(dashboardLink?.className).toContain('text-accent')
  })

  it('shows usage with default values', () => {
    render(<Sidebar />)
    expect(getFirst('Requests this month')).toBeInTheDocument()
    expect(getFirst('0')).toBeInTheDocument()
    expect(getFirst('/100')).toBeInTheDocument()
  })

  it('shows usage with custom values', () => {
    render(<Sidebar requestCount={42} maxRequests={100} />)
    expect(getFirst('42')).toBeInTheDocument()
    expect(getFirst('/100')).toBeInTheDocument()
  })

  it('hides max count for unlimited (pro) plan', () => {
    const { container } = render(<Sidebar requestCount={42} maxRequests={Infinity} />)
    expect(getFirst('42')).toBeInTheDocument()
    // The usage section should not contain a "/number" pattern
    const usageSection = container.querySelector('.border-t')
    expect(usageSection?.textContent).not.toMatch(/\/\d+/)
  })

  it('shows yellow dot at 80% request usage', () => {
    const { container } = render(<Sidebar requestCount={80} maxRequests={100} />)
    const dot = container.querySelector('[title="Approaching limit"]')
    expect(dot).toBeInTheDocument()
    expect(dot?.className).toContain('bg-yellow-500')
  })

  it('shows red dot at 100% request usage', () => {
    const { container } = render(<Sidebar requestCount={100} maxRequests={100} />)
    const dot = container.querySelector('[title="Limit reached"]')
    expect(dot).toBeInTheDocument()
    expect(dot?.className).toContain('bg-red-500')
  })

  it('shows yellow dot at 80% AI analysis usage', () => {
    const { container } = render(<Sidebar aiAnalysisCount={4} maxAiAnalyses={5} />)
    const dots = container.querySelectorAll('[title="Approaching limit"]')
    const aiDot = dots[dots.length - 1]
    expect(aiDot).toBeTruthy()
    expect(aiDot?.className).toContain('bg-yellow-500')
  })

  it('shows red dot at 100% AI analysis usage', () => {
    const { container } = render(<Sidebar aiAnalysisCount={5} maxAiAnalyses={5} />)
    const dots = container.querySelectorAll('[title="Limit reached"]')
    const aiDot = dots[dots.length - 1]
    expect(aiDot).toBeTruthy()
    expect(aiDot?.className).toContain('bg-red-500')
  })

  it('uses yellow progress bar color at 80% request usage', () => {
    const { container } = render(<Sidebar requestCount={80} maxRequests={100} />)
    const progressBars = container.querySelectorAll('.bg-border .rounded-full')
    const requestBar = progressBars[0]
    expect(requestBar?.className).toContain('bg-yellow-500')
  })

  it('uses red progress bar color at 100% request usage', () => {
    const { container } = render(<Sidebar requestCount={100} maxRequests={100} />)
    const progressBars = container.querySelectorAll('.bg-border .rounded-full')
    const requestBar = progressBars[0]
    expect(requestBar?.className).toContain('bg-red-500')
  })

  it('uses accent progress bar color below 80% request usage', () => {
    const { container } = render(<Sidebar requestCount={50} maxRequests={100} />)
    const progressBars = container.querySelectorAll('.bg-border .rounded-full')
    const requestBar = progressBars[0]
    expect(requestBar?.className).toContain('bg-accent')
  })
})
