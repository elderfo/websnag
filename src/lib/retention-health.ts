// Maximum age of a successful run before the job is considered overdue.
// The job runs at 3 AM UTC daily; 25 hours gives a 1-hour grace window.
export const DEFAULT_OVERDUE_THRESHOLD_MS = 25 * 60 * 60 * 1000

export type RetentionJobStatus = 'healthy' | 'overdue' | 'failed' | 'never_run'

export interface RetentionHealthResult {
  status: RetentionJobStatus
  lastRunAt: string | null
  lastRunOutcome: string | null
  lastSuccessAt: string | null
  overdueByMs: number | null
  message: string
}

export interface CronJobRun {
  runid: number
  start_time: string
  end_time: string | null
  status: string
  return_message: string | null
}

export function evaluateRetentionHealth(
  runs: CronJobRun[],
  now: Date,
  overdueThresholdMs: number = DEFAULT_OVERDUE_THRESHOLD_MS
): RetentionHealthResult {
  if (runs.length === 0) {
    return {
      status: 'never_run',
      lastRunAt: null,
      lastRunOutcome: null,
      lastSuccessAt: null,
      overdueByMs: null,
      message: 'No pg_cron run history found for the retention job. The job may not be scheduled.',
    }
  }

  // Runs are expected to be sorted newest-first
  const mostRecent = runs[0]
  const lastSuccessfulRun = runs.find((r) => r.status === 'succeeded')

  const lastRunAt = mostRecent.start_time
  const lastRunOutcome = mostRecent.return_message
  const lastSuccessAt = lastSuccessfulRun?.start_time ?? null

  if (mostRecent.status !== 'succeeded') {
    return {
      status: 'failed',
      lastRunAt,
      lastRunOutcome,
      lastSuccessAt,
      overdueByMs: null,
      message: `Retention job last run status: "${mostRecent.status}". ${mostRecent.return_message ?? 'No error message.'}`,
    }
  }

  const elapsedMs = now.getTime() - new Date(lastRunAt).getTime()

  if (elapsedMs > overdueThresholdMs) {
    const hoursAgo = Math.round(elapsedMs / (60 * 60 * 1000))
    return {
      status: 'overdue',
      lastRunAt,
      lastRunOutcome,
      lastSuccessAt,
      overdueByMs: elapsedMs - overdueThresholdMs,
      message: `Retention job last succeeded ${hoursAgo}h ago — overdue.`,
    }
  }

  return {
    status: 'healthy',
    lastRunAt,
    lastRunOutcome,
    lastSuccessAt,
    overdueByMs: null,
    message: 'Retention job is running on schedule.',
  }
}
