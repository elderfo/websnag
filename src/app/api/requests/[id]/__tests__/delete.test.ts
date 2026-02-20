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

import { DELETE } from '../../[id]/route'

function makeRequest(id: string): Request {
  return new Request(`http://localhost:3000/api/requests/${id}`, {
    method: 'DELETE',
  })
}

describe('DELETE /api/requests/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await DELETE(makeRequest('req-1'), { params: Promise.resolve({ id: 'req-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when request does not exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    // from('requests').select().eq().single() returns null
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })

    const res = await DELETE(makeRequest('req-1'), { params: Promise.resolve({ id: 'req-1' }) })
    expect(res.status).toBe(404)
  })

  it('returns 403 when user does not own the endpoint', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    // Request exists but belongs to another user's endpoint
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'req-1', endpoint_id: 'ep-1', endpoints: { user_id: 'other-user' } },
            error: null,
          }),
        }),
      }),
    })

    const res = await DELETE(makeRequest('req-1'), { params: Promise.resolve({ id: 'req-1' }) })
    expect(res.status).toBe(403)
  })

  it('deletes the request and returns 200 when authorized', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'req-1', endpoint_id: 'ep-1', endpoints: { user_id: 'user-1' } },
            error: null,
          }),
        }),
      }),
    })

    const deleteEq = vi.fn().mockResolvedValue({ error: null })
    mockAdminFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({ eq: deleteEq }),
    })

    const res = await DELETE(makeRequest('req-1'), { params: Promise.resolve({ id: 'req-1' }) })
    expect(res.status).toBe(200)
    expect(mockAdminFrom).toHaveBeenCalledWith('requests')
  })
})
