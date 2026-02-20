import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockNotFound } = vi.hoisted(() => ({
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
}))

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

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/copy-button', () => ({
  CopyButton: ({ label }: { label: string }) => <button>{label}</button>,
}))

vi.mock('@/components/requests/request-feed', () => ({
  RequestFeed: ({ endpointUrl }: { endpointId: string; endpointUrl: string }) => (
    <div data-testid="request-feed">{endpointUrl}</div>
  ),
}))

const mockEndpoint = {
  id: 'ep-1',
  user_id: 'user-1',
  name: 'My Webhook',
  slug: 'my-webhook-slug',
  description: 'A test endpoint',
  response_code: 200,
  response_body: '{"ok": true}',
  response_headers: { 'Content-Type': 'application/json' },
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

function buildSupabaseMock(
  opts: {
    endpointData?: typeof mockEndpoint | null
    endpointError?: { message: string } | null
    userId?: string | null
    username?: string | null
  } = {}
) {
  const {
    endpointData = mockEndpoint,
    endpointError = null,
    userId = 'user-1',
    username = 'testuser',
  } = opts

  return {
    from: vi.fn((table: string) => {
      if (table === 'endpoints') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: endpointError ? null : endpointData,
                error: endpointError,
              }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: username !== null ? { username } : null,
                error: null,
              }),
            }),
          }),
        }
      }
      return { select: vi.fn() }
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  }
}

let mockSupabase = buildSupabaseMock()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

import EndpointDetailPage from './page'

describe('EndpointDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNotFound.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND')
    })
    mockSupabase = buildSupabaseMock()
  })

  it('renders endpoint name and active badge', async () => {
    const Page = await EndpointDetailPage({ params: Promise.resolve({ id: 'ep-1' }) })
    render(Page)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('My Webhook')
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders endpoint description when present', async () => {
    const Page = await EndpointDetailPage({ params: Promise.resolve({ id: 'ep-1' }) })
    render(Page)
    expect(screen.getByText('A test endpoint')).toBeInTheDocument()
  })

  it('renders the namespaced webhook URL when username is set', async () => {
    const Page = await EndpointDetailPage({ params: Promise.resolve({ id: 'ep-1' }) })
    render(Page)
    const expectedUrl = 'http://localhost:3000/api/wh/testuser/my-webhook-slug'
    const urlElements = screen.getAllByText(expectedUrl)
    expect(urlElements.length).toBeGreaterThanOrEqual(1)
    const codeEl = urlElements.find((el) => el.tagName === 'CODE')
    expect(codeEl).toBeDefined()
  })

  it('passes the namespaced URL to RequestFeed', async () => {
    const Page = await EndpointDetailPage({ params: Promise.resolve({ id: 'ep-1' }) })
    render(Page)
    expect(screen.getByTestId('request-feed')).toHaveTextContent(
      'http://localhost:3000/api/wh/testuser/my-webhook-slug'
    )
  })

  it('renders cURL example with the namespaced URL', async () => {
    const Page = await EndpointDetailPage({ params: Promise.resolve({ id: 'ep-1' }) })
    render(Page)
    expect(
      screen.getByText(/curl -X POST http:\/\/localhost:3000\/api\/wh\/testuser\/my-webhook-slug/)
    ).toBeInTheDocument()
  })

  it('renders a settings link pointing to the endpoint settings page', async () => {
    const Page = await EndpointDetailPage({ params: Promise.resolve({ id: 'ep-1' }) })
    render(Page)
    const link = screen.getByRole('link', { name: 'Settings' })
    expect(link).toHaveAttribute('href', '/endpoints/ep-1/settings')
  })

  it('renders Paused badge when endpoint is inactive', async () => {
    mockSupabase = buildSupabaseMock({ endpointData: { ...mockEndpoint, is_active: false } })
    const Page = await EndpointDetailPage({ params: Promise.resolve({ id: 'ep-1' }) })
    render(Page)
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })

  it('does not render description when it is empty', async () => {
    mockSupabase = buildSupabaseMock({ endpointData: { ...mockEndpoint, description: '' } })
    const Page = await EndpointDetailPage({ params: Promise.resolve({ id: 'ep-1' }) })
    render(Page)
    expect(screen.queryByText('A test endpoint')).not.toBeInTheDocument()
  })

  it('calls notFound when the endpoint query returns an error', async () => {
    mockSupabase = buildSupabaseMock({ endpointError: { message: 'Not found' } })
    await expect(
      EndpointDetailPage({ params: Promise.resolve({ id: 'ep-missing' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  describe('when the user has no username set', () => {
    beforeEach(() => {
      mockSupabase = buildSupabaseMock({ username: null })
    })

    it('shows the username-required warning banner', async () => {
      const Page = await EndpointDetailPage({ params: Promise.resolve({ id: 'ep-1' }) })
      render(Page)
      expect(screen.getByText('Username required')).toBeInTheDocument()
    })

    it('shows a link to /settings in the warning banner', async () => {
      const Page = await EndpointDetailPage({ params: Promise.resolve({ id: 'ep-1' }) })
      render(Page)
      const link = screen.getByRole('link', { name: 'Go to Settings' })
      expect(link).toHaveAttribute('href', '/settings')
    })

    it('does not render the Webhook URL panel', async () => {
      const Page = await EndpointDetailPage({ params: Promise.resolve({ id: 'ep-1' }) })
      render(Page)
      expect(screen.queryByText('Webhook URL')).not.toBeInTheDocument()
    })

    it('does not render the cURL Example panel', async () => {
      const Page = await EndpointDetailPage({ params: Promise.resolve({ id: 'ep-1' }) })
      render(Page)
      expect(screen.queryByText('cURL Example')).not.toBeInTheDocument()
    })

    it('does not render RequestFeed', async () => {
      const Page = await EndpointDetailPage({ params: Promise.resolve({ id: 'ep-1' }) })
      render(Page)
      expect(screen.queryByTestId('request-feed')).not.toBeInTheDocument()
    })
  })
})
