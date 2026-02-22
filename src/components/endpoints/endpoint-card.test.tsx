import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EndpointCard } from './endpoint-card'
import type { Endpoint } from '@/types'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const mockEndpoint: Endpoint = {
  id: 'test-id-123',
  user_id: 'user-1',
  name: 'My Test Webhook',
  slug: 'abc123',
  description: 'A test webhook endpoint',
  response_code: 200,
  response_body: '{"ok": true}',
  response_headers: { 'Content-Type': 'application/json' },
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

describe('EndpointCard', () => {
  it('renders the endpoint name as a link', () => {
    render(<EndpointCard endpoint={mockEndpoint} username="testuser" />)
    const link = screen.getByText('My Test Webhook')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')?.getAttribute('href')).toBe('/endpoints/test-id-123')
  })

  it('renders the namespaced webhook URL with username and slug', () => {
    render(<EndpointCard endpoint={mockEndpoint} username="testuser" />)
    expect(screen.getByText(/\/api\/wh\/testuser\/abc123/)).toBeInTheDocument()
  })

  it('renders the legacy webhook URL when username is null', () => {
    render(<EndpointCard endpoint={mockEndpoint} username={null} />)
    expect(screen.getByText(/\/api\/wh\/abc123/)).toBeInTheDocument()
  })

  it('shows Active badge when endpoint is active', () => {
    render(<EndpointCard endpoint={mockEndpoint} username="testuser" />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows Paused badge when endpoint is inactive', () => {
    render(<EndpointCard endpoint={{ ...mockEndpoint, is_active: false }} username="testuser" />)
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })

  it('renders description when present', () => {
    render(<EndpointCard endpoint={mockEndpoint} username="testuser" />)
    expect(screen.getByText('A test webhook endpoint')).toBeInTheDocument()
  })

  it('does not render description when empty', () => {
    render(<EndpointCard endpoint={{ ...mockEndpoint, description: '' }} username="testuser" />)
    expect(screen.queryByText('A test webhook endpoint')).not.toBeInTheDocument()
  })

  it('renders a "View details" link', () => {
    render(<EndpointCard endpoint={mockEndpoint} username="testuser" />)
    const link = screen.getByText('View details')
    expect(link.closest('a')?.getAttribute('href')).toBe('/endpoints/test-id-123')
  })
})
