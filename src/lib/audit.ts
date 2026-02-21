import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'

const log = createLogger('audit')

export interface AuditEventParams {
  userId: string
  action: string
  resourceType: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Records an audit log entry. Fire-and-forget: never throws, errors are
 * logged but do not propagate to the caller.
 */
export function logAuditEvent(params: AuditEventParams): void {
  const admin = createAdminClient()

  Promise.resolve(
    admin.from('audit_log').insert({
      user_id: params.userId,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId ?? null,
      metadata: params.metadata ?? {},
      ip_address: params.ipAddress ?? null,
    })
  )
    .then(({ error }) => {
      if (error) {
        log.error(
          { err: error, userId: params.userId, action: params.action },
          'failed to write audit log entry'
        )
      }
    })
    .catch((err: unknown) => {
      log.error(
        { err, userId: params.userId, action: params.action },
        'unexpected error writing audit log entry'
      )
    })
}
