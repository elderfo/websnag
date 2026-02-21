import { createLogger } from '@/lib/logger'

const log = createLogger('email')

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://websnag.dev'

function buildWelcomeEmailText(username?: string): string {
  const greeting = username ? `Hey ${username}` : 'Hey there'

  return [
    `${greeting},`,
    '',
    'Welcome to Websnag! You now have a personal webhook debugger with AI-powered payload analysis.',
    '',
    'Here is how to get started:',
    '',
    '1. Set your username',
    `   ${APP_URL}/settings`,
    '   Your username becomes part of your webhook URLs.',
    '',
    '2. Create your first endpoint',
    `   ${APP_URL}/endpoints/new`,
    '   You will get a unique URL to start capturing webhooks.',
    '',
    '3. Send a test request',
    '   Point any webhook (Stripe, GitHub, etc.) at your endpoint URL,',
    '   or use cURL to send a test payload.',
    '',
    '4. Analyze with AI',
    '   Click "Analyze" on any captured request to get a plain-English',
    '   explanation and generated handler code.',
    '',
    `Dashboard: ${APP_URL}/dashboard`,
    '',
    'Happy debugging!',
    'The Websnag Team',
  ].join('\n')
}

function buildWelcomeEmailHtml(username?: string): string {
  const greeting = username ? `Hey ${username}` : 'Hey there'

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #e0e0e0; background-color: #0a0a0b; padding: 32px;">
  <h1 style="color: #00ff88; font-size: 24px; margin-bottom: 8px;">Welcome to Websnag</h1>
  <p style="color: #a0a0a0; font-size: 14px; margin-top: 0;">See what your webhooks are really saying.</p>

  <p style="font-size: 15px;">${greeting},</p>
  <p style="font-size: 15px;">You now have a personal webhook debugger with AI-powered payload analysis. Here is how to get started:</p>

  <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
    <tr>
      <td style="padding: 12px 16px; border: 1px solid #1f1f23; border-radius: 6px;">
        <strong style="color: #00ff88;">1.</strong> <strong>Set your username</strong><br/>
        <span style="font-size: 13px; color: #a0a0a0;">Your username becomes part of your webhook URLs.</span><br/>
        <a href="${APP_URL}/settings" style="color: #00ff88; font-size: 13px;">Go to Settings &rarr;</a>
      </td>
    </tr>
    <tr><td style="height: 8px;"></td></tr>
    <tr>
      <td style="padding: 12px 16px; border: 1px solid #1f1f23; border-radius: 6px;">
        <strong style="color: #00ff88;">2.</strong> <strong>Create your first endpoint</strong><br/>
        <span style="font-size: 13px; color: #a0a0a0;">You will get a unique URL to start capturing webhooks.</span><br/>
        <a href="${APP_URL}/endpoints/new" style="color: #00ff88; font-size: 13px;">Create Endpoint &rarr;</a>
      </td>
    </tr>
    <tr><td style="height: 8px;"></td></tr>
    <tr>
      <td style="padding: 12px 16px; border: 1px solid #1f1f23; border-radius: 6px;">
        <strong style="color: #00ff88;">3.</strong> <strong>Send a test request</strong><br/>
        <span style="font-size: 13px; color: #a0a0a0;">Point any webhook at your endpoint URL or use cURL.</span>
      </td>
    </tr>
    <tr><td style="height: 8px;"></td></tr>
    <tr>
      <td style="padding: 12px 16px; border: 1px solid #1f1f23; border-radius: 6px;">
        <strong style="color: #00ff88;">4.</strong> <strong>Analyze with AI</strong><br/>
        <span style="font-size: 13px; color: #a0a0a0;">Get plain-English explanations and generated handler code.</span>
      </td>
    </tr>
  </table>

  <a href="${APP_URL}/dashboard" style="display: inline-block; background-color: #00ff88; color: #0a0a0b; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Open Dashboard</a>

  <p style="font-size: 13px; color: #666; margin-top: 32px;">Happy debugging!<br/>The Websnag Team</p>
</div>`.trim()
}

/**
 * Sends a welcome email to a newly signed-up user.
 *
 * This is designed to be called fire-and-forget — it catches all errors
 * internally and logs them rather than throwing.
 */
export async function sendWelcomeEmail(email: string, username?: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const fromAddress =
    process.env.WELCOME_EMAIL_FROM ??
    process.env.ALERT_EMAIL_FROM ??
    'Websnag <welcome@websnag.dev>'

  const subject = 'Welcome to Websnag — your webhook debugger is ready'
  const text = buildWelcomeEmailText(username)
  const html = buildWelcomeEmailHtml(username)

  if (!apiKey) {
    log.info({ to: email, subject }, 'welcome email (placeholder — RESEND_API_KEY not configured)')
    log.debug({ text }, 'welcome email body')
    return
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 200)
      log.error({ status: response.status, detail, to: email }, 'failed to send welcome email')
      return
    }

    log.info({ to: email }, 'welcome email sent')
  } catch (err) {
    log.error({ err, to: email }, 'welcome email send error')
  }
}
