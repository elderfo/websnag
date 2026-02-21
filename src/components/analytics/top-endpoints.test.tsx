import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopEndpoints } from './top-endpoints'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('TopEndpoints', () => {
  it('renders empty state when data is empty', () => {
    render(<TopEndpoints data={[]} />)
    expect(screen.getByText('No endpoint data for this period')).toBeInTheDocument()
  })

  it('renders the chart heading', () => {
    render(<TopEndpoints data={[{ id: '1', name: 'Test', slug: 'test', count: 5 }]} />)
    expect(screen.getByText('Top Endpoints')).toBeInTheDocument()
  })

  it('renders endpoint names as links', () => {
    render(
      <TopEndpoints
        data={[
          { id: 'ep-1', name: 'Stripe Webhook', slug: 'stripe', count: 10 },
          { id: 'ep-2', name: 'GitHub Webhook', slug: 'github', count: 5 },
        ]}
      />
    )
    const stripeLink = screen.getByText('Stripe Webhook').closest('a')
    expect(stripeLink?.getAttribute('href')).toBe('/endpoints/ep-1')

    const githubLink = screen.getByText('GitHub Webhook').closest('a')
    expect(githubLink?.getAttribute('href')).toBe('/endpoints/ep-2')
  })

  it('renders request counts', () => {
    render(<TopEndpoints data={[{ id: '1', name: 'Test', slug: 'test', count: 42 }]} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders rank numbers', () => {
    render(
      <TopEndpoints
        data={[
          { id: '1', name: 'First', slug: 'first', count: 10 },
          { id: '2', name: 'Second', slug: 'second', count: 5 },
        ]}
      />
    )
    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('2.')).toBeInTheDocument()
  })

  it('renders slug paths', () => {
    render(<TopEndpoints data={[{ id: '1', name: 'Test', slug: 'my-hook', count: 5 }]} />)
    expect(screen.getByText('/wh/my-hook')).toBeInTheDocument()
  })

  it('renders progress bars for relative comparison', () => {
    const { container } = render(
      <TopEndpoints
        data={[
          { id: '1', name: 'Top', slug: 'top', count: 100 },
          { id: '2', name: 'Half', slug: 'half', count: 50 },
        ]}
      />
    )
    const bars = container.querySelectorAll('.bg-accent')
    expect(bars.length).toBe(2)
  })
})
