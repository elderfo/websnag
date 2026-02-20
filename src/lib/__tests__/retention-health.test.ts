import { describe, it, expect } from 'vitest'
import {
  evaluateRetentionHealth,
  DEFAULT_OVERDUE_THRESHOLD_MS,
  type CronJobRun,
} from '../retention-health'

const NOW = new Date('2026-02-20T04:00:00.000Z')

function makeRun(overrides: Partial<CronJobRun> & { hoursAgo?: number } = {}): CronJobRun {
  const { hoursAgo = 1, ...rest } = overrides
  const startTime = new Date(NOW.getTime() - hoursAgo * 60 * 60 * 1000)
  return {
    runid: 1,
    start_time: startTime.toISOString(),
    end_time: startTime.toISOString(),
    status: 'succeeded',
    return_message: '(10,3)',
    ...rest,
  }
}

describe('evaluateRetentionHealth', () => {
  it('returns healthy when last run succeeded within threshold', () => {
    const runs = [makeRun({ hoursAgo: 1 })]
    const result = evaluateRetentionHealth(runs, NOW)

    expect(result.status).toBe('healthy')
    expect(result.overdueByMs).toBeNull()
    expect(result.lastRunAt).toBe(runs[0].start_time)
    expect(result.lastSuccessAt).toBe(runs[0].start_time)
    expect(result.message).toContain('on schedule')
  })

  it('returns healthy when last run is exactly at the threshold boundary', () => {
    const thresholdHours = DEFAULT_OVERDUE_THRESHOLD_MS / (60 * 60 * 1000)
    const runs = [makeRun({ hoursAgo: thresholdHours })]
    const result = evaluateRetentionHealth(runs, NOW)

    expect(result.status).toBe('healthy')
  })

  it('returns overdue when last success exceeds threshold', () => {
    const runs = [makeRun({ hoursAgo: 26 })]
    const result = evaluateRetentionHealth(runs, NOW)

    expect(result.status).toBe('overdue')
    expect(result.overdueByMs).toBeGreaterThan(0)
    expect(result.message).toContain('26h ago')
    expect(result.message).toContain('overdue')
  })

  it('returns failed when last run has failed status', () => {
    const runs = [makeRun({ status: 'failed', return_message: 'ERROR: relation not found' })]
    const result = evaluateRetentionHealth(runs, NOW)

    expect(result.status).toBe('failed')
    expect(result.lastRunOutcome).toBe('ERROR: relation not found')
    expect(result.message).toContain('"failed"')
    expect(result.lastSuccessAt).toBeNull()
  })

  it('includes last success when recent run failed but older run succeeded', () => {
    const runs = [
      makeRun({
        runid: 2,
        hoursAgo: 1,
        status: 'failed',
        return_message: 'timeout',
      }),
      makeRun({ runid: 1, hoursAgo: 25 }),
    ]
    const result = evaluateRetentionHealth(runs, NOW)

    expect(result.status).toBe('failed')
    expect(result.lastSuccessAt).toBe(runs[1].start_time)
  })

  it('returns never_run when no runs exist', () => {
    const result = evaluateRetentionHealth([], NOW)

    expect(result.status).toBe('never_run')
    expect(result.lastRunAt).toBeNull()
    expect(result.lastSuccessAt).toBeNull()
    expect(result.overdueByMs).toBeNull()
    expect(result.message).toContain('No pg_cron run history')
  })

  it('returns failed when last run has timeout status', () => {
    const runs = [makeRun({ status: 'timeout', return_message: null })]
    const result = evaluateRetentionHealth(runs, NOW)

    expect(result.status).toBe('failed')
    expect(result.message).toContain('"timeout"')
    expect(result.message).toContain('No error message')
  })

  it('respects custom overdue threshold', () => {
    const customThreshold = 2 * 60 * 60 * 1000 // 2 hours
    const runs = [makeRun({ hoursAgo: 3 })]
    const result = evaluateRetentionHealth(runs, NOW, customThreshold)

    expect(result.status).toBe('overdue')
    expect(result.overdueByMs).toBeGreaterThan(0)
  })
})
