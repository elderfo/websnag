import { NextResponse } from 'next/server'
import { createRequestLogger } from '@/lib/logger'
import { getRetentionJobRuns, CronQueryError } from '@/lib/supabase/cron'
import { evaluateRetentionHealth } from '@/lib/retention-health'
import type { RetentionHealthResult } from '@/lib/retention-health'

interface HealthResponse extends RetentionHealthResult {
  alertSent: boolean
  timestamp: string
}

async function sendAlert(
  subject: string,
  body: string,
  log: ReturnType<typeof createRequestLogger>
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const recipientsRaw = process.env.ALERT_EMAIL_RECIPIENTS
  const fromAddress = process.env.ALERT_EMAIL_FROM ?? 'alerts@websnag.dev'

  if (!apiKey || !recipientsRaw) {
    log.warn(
      { hasApiKey: !!apiKey, hasRecipients: !!recipientsRaw },
      'alert skipped — missing RESEND_API_KEY or ALERT_EMAIL_RECIPIENTS'
    )
    return false
  }

  const to = recipientsRaw
    .split(',')
    .map((addr) => addr.trim())
    .filter(Boolean)

  if (to.length === 0) {
    log.warn('alert skipped — ALERT_EMAIL_RECIPIENTS is empty after parsing')
    return false
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromAddress, to, subject, text: body }),
    signal: AbortSignal.timeout(5000),
  })

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200)
    log.error({ status: response.status, detail }, 'Resend API call failed')
    return false
  }

  log.info({ to, subject }, 'alert email sent')
  return true
}

export async function GET(req: Request): Promise<NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const expectedToken = process.env.HEALTH_CHECK_TOKEN
  const isAuthenticated = expectedToken && token === expectedToken

  if (!isAuthenticated) {
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  }

  const log = createRequestLogger('health.retention')
  const timestamp = new Date().toISOString()

  try {
    const runs = await getRetentionJobRuns()
    const health = evaluateRetentionHealth(runs, new Date())

    log.info(
      { status: health.status, lastSuccessAt: health.lastSuccessAt },
      'retention health evaluated'
    )

    let alertSent = false

    if (health.status !== 'healthy') {
      try {
        alertSent = await sendAlert(
          `[Websnag] Retention job ${health.status}`,
          [
            `Status: ${health.status}`,
            `Message: ${health.message}`,
            `Last run: ${health.lastRunAt ?? 'never'}`,
            `Last success: ${health.lastSuccessAt ?? 'never'}`,
            health.overdueByMs != null
              ? `Overdue by: ${Math.round(health.overdueByMs / 60000)} minutes`
              : null,
          ]
            .filter(Boolean)
            .join('\n'),
          log
        )
      } catch (alertErr) {
        log.error({ err: alertErr }, 'failed to send retention health alert')
      }
    }

    const httpStatus = health.status === 'healthy' ? 200 : 503
    return NextResponse.json<HealthResponse>(
      { ...health, alertSent, timestamp },
      { status: httpStatus }
    )
  } catch (err) {
    if (err instanceof CronQueryError) {
      log.error({ err }, 'cron query failed in retention health check')
      return NextResponse.json(
        {
          status: 'error',
          message:
            'Could not query retention job history. The get_retention_job_runs function may not exist.',
          alertSent: false,
          timestamp,
        },
        { status: 503 }
      )
    }

    log.error({ err }, 'unexpected error in retention health check')
    return NextResponse.json(
      {
        status: 'error',
        message: 'Internal server error',
        alertSent: false,
        timestamp,
      },
      { status: 500 }
    )
  }
}
