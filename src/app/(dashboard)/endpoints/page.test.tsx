import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockSelect = vi.fn()
const mockOrder = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => {
      mockFrom(...args)
      return {
        select: (...selectArgs: unknown[]) => {
          mockSelect(...selectArgs)
          return {
            order: (...orderArgs: unknown[]) => {
              mockOrder(...orderArgs)
              return { data: [], error: null }
            },
          }
        },
      }
    },
  }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/endpoints/endpoint-card', () => ({
  EndpointCard: ({ endpoint }: { endpoint: { id: string; name: string } }) => (
    <div data-testid={`endpoint-card-${endpoint.id}`}>{endpoint.name}</div>
  ),
}))

import EndpointsPage from './page'

describe('EndpointsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page heading', async () => {
    const Page = await EndpointsPage()
    render(Page)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Endpoints')
  })

  it('renders the subtitle', async () => {
    const Page = await EndpointsPage()
    render(Page)
    expect(screen.getByText('Manage your webhook endpoints.')).toBeInTheDocument()
  })

  it('renders the New Endpoint link', async () => {
    const Page = await EndpointsPage()
    render(Page)
    const links = screen.getAllByText('New Endpoint')
    expect(links.length).toBeGreaterThan(0)
    expect(links[0].closest('a')?.getAttribute('href')).toBe('/endpoints/new')
  })

  it('renders empty state when no endpoints exist', async () => {
    const Page = await EndpointsPage()
    render(Page)
    expect(screen.getByText('No endpoints yet')).toBeInTheDocument()
    expect(screen.getByText('Create your first endpoint')).toBeInTheDocument()
  })

  it('renders endpoint cards when endpoints exist', async () => {
    const mockEndpoints = [
      { id: '1', name: 'Stripe Webhook', slug: 'abc', created_at: '2024-01-01' },
      { id: '2', name: 'GitHub Webhook', slug: 'def', created_at: '2024-01-02' },
    ]

    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValueOnce({
      from: () => ({
        select: () => ({
          order: () => ({ data: mockEndpoints, error: null }),
        }),
      }),
    } as never)

    const Page = await EndpointsPage()
    render(Page)
    expect(screen.getByTestId('endpoint-card-1')).toHaveTextContent('Stripe Webhook')
    expect(screen.getByTestId('endpoint-card-2')).toHaveTextContent('GitHub Webhook')
    expect(screen.queryByText('No endpoints yet')).not.toBeInTheDocument()
  })
})
