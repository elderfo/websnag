import { createAdminClient } from '@/lib/supabase/admin'
import type { CronJobRun } from '@/lib/retention-health'

export class CronQueryError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown
  ) {
    super(message)
    this.name = 'CronQueryError'
  }
}

export async function getRetentionJobRuns(limit = 5): Promise<CronJobRun[]> {
  const admin = createAdminClient()

  const { data, error } = await admin.rpc('get_retention_job_runs', {
    p_limit: limit,
  })

  if (error) {
    throw new CronQueryError('Failed to query retention job run history', error)
  }

  return (data ?? []) as CronJobRun[]
}
