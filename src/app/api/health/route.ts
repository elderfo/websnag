import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(): Promise<NextResponse> {
  const start = Date.now()
  try {
    // Use the anon/public client for health checks — no admin privileges needed
    // for a simple connectivity probe, and this endpoint has no auth context.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
    const { error } = await supabase.from('endpoints').select('id').limit(1)
    const durationMs = Date.now() - start

    if (error) {
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
  } catch {
    return NextResponse.json(
      { status: 'error', timestamp: new Date().toISOString() },
      { status: 503 }
    )
  }
}
