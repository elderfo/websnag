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
  it('renders the websnag logo', () => {
    render(<Sidebar />)
    expect(getFirst('websnag')).toBeInTheDocument()
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
})
