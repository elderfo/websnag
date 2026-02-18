import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock the supabase server client
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

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Must import the page component after mocks are set up
import DashboardPage from './page'

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page heading', async () => {
    const Page = await DashboardPage()
    render(Page)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your Endpoints')
  })

  it('renders the New Endpoint link', async () => {
    const Page = await DashboardPage()
    render(Page)
    const links = screen.getAllByText('New Endpoint')
    expect(links.length).toBeGreaterThan(0)
    expect(links[0].closest('a')?.getAttribute('href')).toBe('/endpoints/new')
  })

  it('renders empty state when no endpoints exist', async () => {
    const Page = await DashboardPage()
    render(Page)
    expect(screen.getByText('No endpoints yet')).toBeInTheDocument()
    expect(screen.getByText('Create your first endpoint')).toBeInTheDocument()
  })
})
