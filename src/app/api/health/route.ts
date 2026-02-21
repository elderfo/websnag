import { createClient } from '@supabase/supabase-js'
import { createRequestLogger } from '@/lib/logger'
import { NextResponse } from 'next/server'

export async function GET(req: Request): Promise<NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const expectedToken = process.env.HEALTH_CHECK_TOKEN
  const isAuthenticated = expectedToken && token === expectedToken

  if (!isAuthenticated) {
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  }

  const start = Date.now()
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'Missing Supabase configuration',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      )
    }

    // Use the anon/public client for health checks — no admin privileges needed
    // for a simple connectivity probe, and this endpoint has no auth context.
    // Note: RLS on the endpoints table means this returns zero rows, but that's
    // fine — we only check for connectivity errors, not results.
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { error } = await supabase.from('endpoints').select('id').limit(1)
    const durationMs = Date.now() - start

    if (error) {
      const log = createRequestLogger('health')
      log.error({ err: error, durationMs }, 'database health check failed')
      return NextResponse.json(
        {
          status: 'degraded',
          database: 'unreachable',
          durationMs,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      )
    }

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      durationMs,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const durationMs = Date.now() - start
    const log = createRequestLogger('health')
    log.error({ err: error, durationMs }, 'health check failed')
    return NextResponse.json(
      { status: 'error', durationMs, timestamp: new Date().toISOString() },
      { status: 503 }
    )
  }
}
