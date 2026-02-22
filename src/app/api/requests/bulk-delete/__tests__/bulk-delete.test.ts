import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

const mockAdminFrom = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: mockAdminFrom,
  })),
}))

vi.mock('@/lib/logger', () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}))

import { POST } from '../../bulk-delete/route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/requests/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/requests/bulk-delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await POST(makeRequest({ requestIds: ['req-1'] }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body without leaking validation details', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const res = await POST(makeRequest({ requestIds: [] }))
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('Invalid request')
    expect(data).not.toHaveProperty('details')
  })

  it('returns 400 when more than 100 IDs are provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const ids = Array.from({ length: 101 }, (_, i) => `req-${i}`)
    const res = await POST(makeRequest({ requestIds: ids }))
    expect(res.status).toBe(400)
  })

  it('deletes owned requests and returns count', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    // Ownership check: from('requests').select().in() returns owned requests
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            { id: 'req-1', endpoints: { user_id: 'user-1' } },
            { id: 'req-2', endpoints: { user_id: 'user-1' } },
          ],
          error: null,
        }),
      }),
    })

    const deleteIn = vi.fn().mockResolvedValue({ error: null })
    mockAdminFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({ in: deleteIn }),
    })

    const res = await POST(makeRequest({ requestIds: ['req-1', 'req-2'] }))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.deleted).toBe(2)
  })

  it('only deletes requests the user owns', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    // One owned, one not
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [{ id: 'req-1', endpoints: { user_id: 'user-1' } }],
          error: null,
        }),
      }),
    })

    const deleteIn = vi.fn().mockResolvedValue({ error: null })
    mockAdminFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({ in: deleteIn }),
    })

    const res = await POST(makeRequest({ requestIds: ['req-1', 'req-2'] }))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.deleted).toBe(1)
  })
})
