import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(): Promise<NextResponse> {
  const start = Date.now()
  try {
    const supabase = createAdminClient()
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
