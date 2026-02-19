import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecentActivity } from './recent-activity'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const now = Date.now()

const testRequests = [
  {
    id: 'req-1',
    endpoint_id: 'ep-1',
    method: 'POST',
    size_bytes: 1024,
    received_at: new Date(now - 30_000).toISOString(), // 30s ago
  },
  {
    id: 'req-2',
    endpoint_id: 'ep-2',
    method: 'GET',
    size_bytes: 256,
    received_at: new Date(now - 120_000).toISOString(), // 2m ago
  },
]

const endpointNames: Record<string, string> = {
  'ep-1': 'Stripe Webhooks',
  'ep-2': 'GitHub Events',
}

describe('RecentActivity', () => {
  it('renders request rows with endpoint names', () => {
    render(<RecentActivity requests={testRequests} endpointNames={endpointNames} />)
    expect(screen.getByText('Stripe Webhooks')).toBeInTheDocument()
    expect(screen.getByText('GitHub Events')).toBeInTheDocument()
  })

  it('renders method badges', () => {
    render(<RecentActivity requests={testRequests} endpointNames={endpointNames} />)
    expect(screen.getByText('POST')).toBeInTheDocument()
    expect(screen.getByText('GET')).toBeInTheDocument()
  })

  it('renders empty state when no requests', () => {
    render(<RecentActivity requests={[]} endpointNames={{}} />)
    expect(screen.getByText('No requests yet — send a webhook to get started.')).toBeInTheDocument()
  })

  it('links to endpoint detail page', () => {
    render(<RecentActivity requests={testRequests} endpointNames={endpointNames} />)
    const stripeLink = screen.getByText('Stripe Webhooks').closest('a')
    expect(stripeLink).toHaveAttribute('href', '/endpoints/ep-1')

    const githubLink = screen.getByText('GitHub Events').closest('a')
    expect(githubLink).toHaveAttribute('href', '/endpoints/ep-2')
  })

  it('shows Unknown for missing endpoint names', () => {
    const requests = [
      {
        id: 'req-3',
        endpoint_id: 'ep-unknown',
        method: 'PUT',
        size_bytes: 512,
        received_at: new Date(now - 60_000).toISOString(),
      },
    ]
    render(<RecentActivity requests={requests} endpointNames={{}} />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })
})
