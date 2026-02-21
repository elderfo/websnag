import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: mockFrom,
  })),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { logAuditEvent } from '../audit'

describe('logAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert: mockInsert })
  })

  it('inserts an audit log entry with all required fields', async () => {
    logAuditEvent({
      userId: 'user-123',
      action: 'create',
      resourceType: 'endpoint',
    })

    // Allow the fire-and-forget promise to settle
    await vi.waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('audit_log')
    })

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-123',
      action: 'create',
      resource_type: 'endpoint',
      resource_id: null,
      metadata: {},
      ip_address: null,
    })
  })

  it('includes optional fields when provided', async () => {
    logAuditEvent({
      userId: 'user-456',
      action: 'replay',
      resourceType: 'request',
      resourceId: 'req-789',
      metadata: { targetUrl: 'https://example.com' },
      ipAddress: '192.168.1.1',
    })

    await vi.waitFor(() => {
      expect(mockInsert).toHaveBeenCalled()
    })

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'user-456',
      action: 'replay',
      resource_type: 'request',
      resource_id: 'req-789',
      metadata: { targetUrl: 'https://example.com' },
      ip_address: '192.168.1.1',
    })
  })

  it('defaults resource_id to null when not provided', async () => {
    logAuditEvent({
      userId: 'user-123',
      action: 'analyze',
      resourceType: 'request',
    })

    await vi.waitFor(() => {
      expect(mockInsert).toHaveBeenCalled()
    })

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ resource_id: null }))
  })

  it('defaults metadata to empty object when not provided', async () => {
    logAuditEvent({
      userId: 'user-123',
      action: 'delete',
      resourceType: 'endpoint',
      resourceId: 'ep-123',
    })

    await vi.waitFor(() => {
      expect(mockInsert).toHaveBeenCalled()
    })

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ metadata: {} }))
  })

  it('does not throw when the database insert fails', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'DB error' } })

    expect(() => {
      logAuditEvent({
        userId: 'user-123',
        action: 'create',
        resourceType: 'endpoint',
      })
    }).not.toThrow()

    // Allow the promise to settle without errors propagating
    await vi.waitFor(() => {
      expect(mockInsert).toHaveBeenCalled()
    })
  })

  it('does not throw when the insert promise rejects', async () => {
    mockInsert.mockRejectedValue(new Error('Network error'))

    expect(() => {
      logAuditEvent({
        userId: 'user-123',
        action: 'create',
        resourceType: 'endpoint',
      })
    }).not.toThrow()

    // Allow microtasks to flush
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
})
