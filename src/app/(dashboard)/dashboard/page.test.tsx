import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// --- Mock data ---
const mockEndpoints = [
  { id: 'ep-1', name: 'Stripe Hooks', slug: 'stripe-hooks', is_active: true },
  { id: 'ep-2', name: 'GitHub Events', slug: 'github-events', is_active: false },
]

const mockRequests = [
  {
    id: 'req-1',
    endpoint_id: 'ep-1',
    method: 'POST',
    size_bytes: 512,
    received_at: '2026-02-18T10:00:00Z',
  },
  {
    id: 'req-2',
    endpoint_id: 'ep-2',
    method: 'GET',
    size_bytes: 128,
    received_at: '2026-02-18T09:30:00Z',
  },
]

const mockSubscription = { plan: 'free', status: 'active' }
const mockUsage = [{ request_count: 42, ai_analysis_count: 3 }]

// --- Supabase mock builder ---
let supabaseError: string | null = null

function createRequestsCountResult(error: string | null) {
  const errObj = error ? { message: error } : null
  return {
    gte: vi.fn().mockReturnValue({ data: null, count: 7, error: errObj }),
    not: vi.fn().mockReturnValue({ data: null, count: 2, error: errObj }),
    data: null,
    count: 5,
    error: errObj,
  }
}

function createMockSupabase() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'endpoints') {
        return {
          select: vi.fn().mockReturnValue({
            data: supabaseError ? null : mockEndpoints,
            error: supabaseError ? { message: supabaseError } : null,
          }),
        }
      }
      if (table === 'requests') {
        return {
          select: vi.fn((_columns: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count) {
              return createRequestsCountResult(supabaseError)
            }
            // Recent requests query
            return {
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  data: supabaseError ? null : mockRequests,
                  error: supabaseError ? { message: supabaseError } : null,
                }),
              }),
            }
          }),
        }
      }
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockReturnValue({
              data: supabaseError ? null : mockSubscription,
              error: supabaseError ? { message: supabaseError } : null,
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockReturnValue({
                data: { username: 'testuser' },
                error: null,
              }),
            }),
          }),
        }
      }
      return { select: vi.fn().mockReturnValue({ data: null, error: null }) }
    }),
    rpc: vi.fn().mockReturnValue({
      data: supabaseError ? null : mockUsage,
      error: supabaseError ? { message: supabaseError } : null,
    }),
  }
}

let mockSupabase = createMockSupabase()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

// Mock next/link
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

// Mock child components to isolate DashboardPage logic
vi.mock('@/components/ui/refresh-button', () => ({
  RefreshButton: () => <button>Refresh</button>,
}))

vi.mock('@/components/dashboard/stat-card', () => ({
  StatCard: ({
    label,
    value,
    subtitle,
    children,
  }: {
    label: string
    value: string
    subtitle?: string
    progress?: number
    children?: React.ReactNode
  }) => (
    <div data-testid={`stat-card-${label}`}>
      <span>{label}</span>
      <span>{value}</span>
      {subtitle && <span>{subtitle}</span>}
      {children}
    </div>
  ),
}))

vi.mock('@/components/dashboard/recent-activity', () => ({
  RecentActivity: ({
    requests,
    endpointNames,
  }: {
    requests: Array<{ id: string; endpoint_id: string }>
    endpointNames: Record<string, string>
  }) => (
    <div data-testid="recent-activity">
      <span>Recent Activity ({requests.length} requests)</span>
      {Object.entries(endpointNames).map(([id, name]) => (
        <span key={id}>{name}</span>
      ))}
    </div>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
}))

vi.mock('@/components/dashboard/upgrade-banner', () => ({
  UpgradeBanner: () => null,
}))

vi.mock('@/components/onboarding/checklist', () => ({
  OnboardingChecklist: () => <div data-testid="onboarding-checklist" />,
}))

import DashboardPage from './page'

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabaseError = null
    mockSupabase = createMockSupabase()
  })

  it('renders "Dashboard" heading', async () => {
    const Page = await DashboardPage()
    render(Page)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard')
  })

  it('renders requests today stat card with correct count', async () => {
    const Page = await DashboardPage()
    render(Page)
    const card = screen.getByTestId('stat-card-Requests Today')
    expect(card).toBeInTheDocument()
    expect(card).toHaveTextContent('7')
  })

  it('renders active endpoints stat card with correct counts', async () => {
    const Page = await DashboardPage()
    render(Page)
    const card = screen.getByTestId('stat-card-Active Endpoints')
    expect(card).toBeInTheDocument()
    expect(card).toHaveTextContent('1')
    expect(card).toHaveTextContent('of 2 total')
  })

  it('renders monthly usage stat card', async () => {
    const Page = await DashboardPage()
    render(Page)
    const card = screen.getByTestId('stat-card-Monthly Usage')
    expect(card).toBeInTheDocument()
    expect(card).toHaveTextContent('42 / 100')
  })

  it('renders monthly usage for Pro plan as unlimited', async () => {
    mockSupabase.from = vi.fn((table: string) => {
      if (table === 'endpoints') {
        return {
          select: vi.fn().mockReturnValue({
            data: mockEndpoints,
            error: null,
          }),
        }
      }
      if (table === 'requests') {
        return {
          select: vi.fn((_columns: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count) {
              return createRequestsCountResult(null)
            }
            return {
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({ data: mockRequests, error: null }),
              }),
            }
          }),
        }
      }
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockReturnValue({
              data: { plan: 'pro', status: 'active' },
              error: null,
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockReturnValue({
                data: { username: 'testuser' },
                error: null,
              }),
            }),
          }),
        }
      }
      return { select: vi.fn().mockReturnValue({ data: null, error: null }) }
    })

    const Page = await DashboardPage()
    render(Page)
    const card = screen.getByTestId('stat-card-Monthly Usage')
    expect(card).toHaveTextContent('42')
    expect(card).toHaveTextContent('Unlimited')
    expect(card).toHaveTextContent('Pro')
  })

  it('renders recent activity section with endpoint names', async () => {
    const Page = await DashboardPage()
    render(Page)
    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    const activity = screen.getByTestId('recent-activity')
    expect(activity).toHaveTextContent('2 requests')
    expect(activity).toHaveTextContent('Stripe Hooks')
    expect(activity).toHaveTextContent('GitHub Events')
  })

  it('renders empty state when no endpoints', async () => {
    mockSupabase.from = vi.fn((table: string) => {
      if (table === 'endpoints') {
        return { select: vi.fn().mockReturnValue({ data: [], error: null }) }
      }
      if (table === 'requests') {
        return {
          select: vi.fn((_columns: string, opts?: { count?: string }) => {
            if (opts?.count) {
              return {
                gte: vi.fn().mockReturnValue({ data: null, count: 0, error: null }),
                not: vi.fn().mockReturnValue({ data: null, count: 0, error: null }),
                data: null,
                count: 0,
                error: null,
              }
            }
            return {
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({ data: [], error: null }),
              }),
            }
          }),
        }
      }
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockReturnValue({ data: mockSubscription, error: null }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockReturnValue({
                data: { username: 'testuser' },
                error: null,
              }),
            }),
          }),
        }
      }
      return { select: vi.fn().mockReturnValue({ data: null, error: null }) }
    })

    const Page = await DashboardPage()
    render(Page)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard')
    expect(screen.getByText('Welcome to Websnag')).toBeInTheDocument()
    expect(screen.getByText('Create your first endpoint')).toBeInTheDocument()
    const link = screen.getByText('Create your first endpoint').closest('a')
    expect(link).toHaveAttribute('href', '/endpoints/new')
  })

  it('throws when auth fails', async () => {
    mockSupabase.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'Session expired' },
    })

    await expect(DashboardPage()).rejects.toThrow('Session expired')
  })

  it('throws when user is null', async () => {
    mockSupabase.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    })

    await expect(DashboardPage()).rejects.toThrow('Authentication required')
  })

  it('throws when Supabase query fails', async () => {
    supabaseError = 'Database connection failed'
    mockSupabase = createMockSupabase()

    await expect(DashboardPage()).rejects.toThrow()
  })
})
