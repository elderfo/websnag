import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReplayPanel } from './replay-panel'

describe('ReplayPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders URL input and replay button', () => {
    render(<ReplayPanel requestId="req-1" />)
    expect(screen.getByLabelText('Target URL')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replay' })).toBeInTheDocument()
  })

  it('shows PRO badge', () => {
    render(<ReplayPanel requestId="req-1" />)
    expect(screen.getByText('PRO')).toBeInTheDocument()
  })

  it('disables replay button when URL is empty', () => {
    render(<ReplayPanel requestId="req-1" />)
    expect(screen.getByRole('button', { name: 'Replay' })).toBeDisabled()
  })

  it('disables replay button for non-URL input', async () => {
    const user = userEvent.setup()
    render(<ReplayPanel requestId="req-1" />)

    await user.type(screen.getByLabelText('Target URL'), 'not-a-url')

    expect(screen.getByRole('button', { name: 'Replay' })).toBeDisabled()
  })

  it('enables replay button when valid URL is entered', async () => {
    const user = userEvent.setup()
    render(<ReplayPanel requestId="req-1" />)

    await user.type(screen.getByLabelText('Target URL'), 'https://example.com/webhook')

    expect(screen.getByRole('button', { name: 'Replay' })).toBeEnabled()
  })

  it('shows loading state while replaying', async () => {
    const user = userEvent.setup()
    // Make fetch hang
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))

    render(<ReplayPanel requestId="req-1" />)

    await user.type(screen.getByLabelText('Target URL'), 'https://example.com/webhook')
    await user.click(screen.getByRole('button', { name: 'Replay' }))

    expect(screen.getByRole('button', { name: 'Replaying...' })).toBeDisabled()

    vi.unstubAllGlobals()
  })

  it('displays successful response with status and body', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: '{"ok":true}',
          }),
      })
    )

    render(<ReplayPanel requestId="req-1" />)

    await user.type(screen.getByLabelText('Target URL'), 'https://example.com/webhook')
    await user.click(screen.getByRole('button', { name: 'Replay' }))

    await waitFor(() => {
      expect(screen.getByText('200')).toBeInTheDocument()
    })

    // Body should be formatted JSON
    expect(screen.getByText(/"ok": true/)).toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('displays error message on 403', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Replay is a Pro feature' }),
      })
    )

    render(<ReplayPanel requestId="req-1" />)

    await user.type(screen.getByLabelText('Target URL'), 'https://example.com/webhook')
    await user.click(screen.getByRole('button', { name: 'Replay' }))

    await waitFor(() => {
      expect(screen.getByText('Replay is a Pro feature. Upgrade to use it.')).toBeInTheDocument()
    })

    vi.unstubAllGlobals()
  })

  it('displays generic error on failure', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ error: 'Failed to reach target: ECONNREFUSED' }),
      })
    )

    render(<ReplayPanel requestId="req-1" />)

    await user.type(screen.getByLabelText('Target URL'), 'https://example.com/webhook')
    await user.click(screen.getByRole('button', { name: 'Replay' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to reach target: ECONNREFUSED')).toBeInTheDocument()
    })

    vi.unstubAllGlobals()
  })

  it('displays network error when fetch throws', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    render(<ReplayPanel requestId="req-1" />)

    await user.type(screen.getByLabelText('Target URL'), 'https://example.com/webhook')
    await user.click(screen.getByRole('button', { name: 'Replay' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to connect. Please try again.')).toBeInTheDocument()
    })

    vi.unstubAllGlobals()
  })

  it('renders collapsible response headers', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 200,
            headers: { 'content-type': 'application/json', 'x-custom': 'value' },
            body: 'ok',
          }),
      })
    )

    render(<ReplayPanel requestId="req-1" />)

    await user.type(screen.getByLabelText('Target URL'), 'https://example.com/webhook')
    await user.click(screen.getByRole('button', { name: 'Replay' }))

    await waitFor(() => {
      expect(screen.getByText('Headers (2)')).toBeInTheDocument()
    })

    // Headers should be collapsed by default
    expect(screen.queryByText('x-custom')).not.toBeInTheDocument()

    // Expand headers
    await user.click(screen.getByText('Headers (2)'))
    expect(screen.getByText('x-custom')).toBeInTheDocument()
    expect(screen.getByText('value')).toBeInTheDocument()

    vi.unstubAllGlobals()
  })
})
