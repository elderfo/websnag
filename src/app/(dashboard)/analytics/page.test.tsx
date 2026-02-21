import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AnalyticsPage from './page'

vi.mock('@/components/analytics/volume-chart', () => ({
  VolumeChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="volume-chart">volume:{data.length}</div>
  ),
}))

vi.mock('@/components/analytics/method-chart', () => ({
  MethodChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="method-chart">method:{data.length}</div>
  ),
}))

vi.mock('@/components/analytics/top-endpoints', () => ({
  TopEndpoints: ({ data }: { data: unknown[] }) => (
    <div data-testid="top-endpoints">endpoints:{data.length}</div>
  ),
}))

const mockFetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = mockFetch
})

function mockSuccessResponse() {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        volumeByDay: [{ date: '2026-02-20', count: 5 }],
        methodBreakdown: [{ method: 'POST', count: 5 }],
        topEndpoints: [{ id: '1', name: 'Test', slug: 'test', count: 5 }],
      }),
  })
}

describe('AnalyticsPage', () => {
  it('renders the page heading', async () => {
    mockSuccessResponse()
    render(<AnalyticsPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Analytics')
  })

  it('renders the subtitle', async () => {
    mockSuccessResponse()
    render(<AnalyticsPage />)
    expect(screen.getByText('Webhook traffic patterns and endpoint activity.')).toBeInTheDocument()
  })

  it('fetches analytics with default 30d range on mount', async () => {
    mockSuccessResponse()
    render(<AnalyticsPage />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/analytics?range=30')
    })
  })

  it('renders chart components after loading', async () => {
    mockSuccessResponse()
    render(<AnalyticsPage />)
    await waitFor(() => {
      expect(screen.getByTestId('volume-chart')).toHaveTextContent('volume:1')
      expect(screen.getByTestId('method-chart')).toHaveTextContent('method:1')
      expect(screen.getByTestId('top-endpoints')).toHaveTextContent('endpoints:1')
    })
  })

  it('shows loading skeletons before data loads', () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    const { container } = render(<AnalyticsPage />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('changes range when a range button is clicked', async () => {
    mockSuccessResponse()
    const user = userEvent.setup()
    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/analytics?range=30')
    })

    mockFetch.mockClear()
    mockSuccessResponse()

    await user.click(screen.getByText('7d'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/analytics?range=7')
    })
  })

  it('renders all range buttons', () => {
    mockSuccessResponse()
    render(<AnalyticsPage />)
    expect(screen.getByText('7d')).toBeInTheDocument()
    expect(screen.getByText('30d')).toBeInTheDocument()
    expect(screen.getByText('90d')).toBeInTheDocument()
  })

  it('highlights the active range button', () => {
    mockSuccessResponse()
    render(<AnalyticsPage />)
    const activeButton = screen.getByText('30d')
    expect(activeButton.className).toContain('bg-accent')
  })

  it('shows error state when fetch fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Something went wrong' }),
    })

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('retries when the Retry button is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Temporary failure' }),
    })

    const user = userEvent.setup()
    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Temporary failure')).toBeInTheDocument()
    })

    mockFetch.mockClear()
    mockSuccessResponse()

    await user.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/analytics?range=30')
      expect(screen.getByTestId('volume-chart')).toBeInTheDocument()
    })
  })
})
