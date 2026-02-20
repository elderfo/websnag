import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockRpc = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    rpc: mockRpc,
  })),
}))

vi.mock('@/lib/logger', () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    requestId: 'test-request-id',
  }),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { GET } from '../route'

const NOW = new Date('2026-02-20T04:00:00.000Z')

function makeRpcRun(
  hoursAgo: number,
  status = 'succeeded',
  returnMessage: string | null = '(10,3)'
) {
  const startTime = new Date(NOW.getTime() - hoursAgo * 60 * 60 * 1000).toISOString()
  return {
    runid: 1,
    start_time: startTime,
    end_time: startTime,
    status,
    return_message: returnMessage,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.stubEnv('RESEND_API_KEY', 'test-resend-key')
  vi.stubEnv('ALERT_EMAIL_RECIPIENTS', 'ops@example.com')
  vi.stubEnv('ALERT_EMAIL_FROM', 'alerts@websnag.dev')
  mockFetch.mockResolvedValue({ ok: true, text: async () => '{}' })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/health/retention', () => {
  it('returns 200 when retention job is healthy', async () => {
    mockRpc.mockResolvedValue({
      data: [makeRpcRun(1)],
      error: null,
    })

    const res = await GET()
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.status).toBe('healthy')
    expect(json.alertSent).toBe(false)
    expect(json.timestamp).toBeDefined()
    expect(json.lastRunAt).toBeDefined()
    expect(json.lastSuccessAt).toBeDefined()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns 503 and sends alert when job failed', async () => {
    mockRpc.mockResolvedValue({
      data: [makeRpcRun(1, 'failed', 'ERROR: relation not found')],
      error: null,
    })

    const res = await GET()
    expect(res.status).toBe(503)

    const json = await res.json()
    expect(json.status).toBe('failed')
    expect(json.alertSent).toBe(true)
    expect(json.lastRunOutcome).toBe('ERROR: relation not found')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns 503 and sends alert when job is overdue', async () => {
    mockRpc.mockResolvedValue({
      data: [makeRpcRun(26)],
      error: null,
    })

    const res = await GET()
    expect(res.status).toBe(503)

    const json = await res.json()
    expect(json.status).toBe('overdue')
    expect(json.alertSent).toBe(true)
    expect(json.overdueByMs).toBeGreaterThan(0)
  })

  it('returns 503 and sends alert when no runs exist', async () => {
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    })

    const res = await GET()
    expect(res.status).toBe(503)

    const json = await res.json()
    expect(json.status).toBe('never_run')
    expect(json.alertSent).toBe(true)
  })

  it('returns 503 with error status when RPC query fails', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'function get_retention_job_runs does not exist' },
    })

    const res = await GET()
    expect(res.status).toBe(503)

    const json = await res.json()
    expect(json.status).toBe('error')
    expect(json.alertSent).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns alertSent false when RESEND_API_KEY is missing', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    mockRpc.mockResolvedValue({
      data: [makeRpcRun(26)],
      error: null,
    })

    const res = await GET()
    const json = await res.json()

    expect(json.status).toBe('overdue')
    expect(json.alertSent).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns alertSent false when ALERT_EMAIL_RECIPIENTS is missing', async () => {
    vi.stubEnv('ALERT_EMAIL_RECIPIENTS', '')
    mockRpc.mockResolvedValue({
      data: [makeRpcRun(26)],
      error: null,
    })

    const res = await GET()
    const json = await res.json()

    expect(json.status).toBe('overdue')
    expect(json.alertSent).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns alertSent false when Resend API returns an error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'invalid sender',
    })
    mockRpc.mockResolvedValue({
      data: [makeRpcRun(26)],
      error: null,
    })

    const res = await GET()
    const json = await res.json()

    expect(json.status).toBe('overdue')
    expect(json.alertSent).toBe(false)
  })

  it('still returns health status when alert sending throws', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    mockRpc.mockResolvedValue({
      data: [makeRpcRun(26)],
      error: null,
    })

    const res = await GET()
    expect(res.status).toBe(503)

    const json = await res.json()
    expect(json.status).toBe('overdue')
    expect(json.alertSent).toBe(false)
  })

  it('sends alert to multiple recipients from comma-separated env var', async () => {
    vi.stubEnv('ALERT_EMAIL_RECIPIENTS', 'ops@example.com, oncall@example.com')
    mockRpc.mockResolvedValue({
      data: [makeRpcRun(1, 'failed', 'error')],
      error: null,
    })

    await GET()

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(fetchBody.to).toEqual(['ops@example.com', 'oncall@example.com'])
  })

  it('passes the RPC limit parameter', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    await GET()

    expect(mockRpc).toHaveBeenCalledWith('get_retention_job_runs', { p_limit: 5 })
  })
})
