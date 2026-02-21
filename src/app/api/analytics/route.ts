import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createRequestLogger } from '@/lib/logger'
import { NextResponse, type NextRequest } from 'next/server'
import type { VolumeByDay, MethodBreakdown, TopEndpoint, AnalyticsResponse } from '@/types'

const VALID_RANGES = [7, 30, 90] as const

const AnalyticsQuerySchema = z.object({
  range: z.coerce
    .number()
    .refine((v): v is (typeof VALID_RANGES)[number] => VALID_RANGES.includes(v as never), {
      message: 'range must be 7, 30, or 90',
    }),
})

function fillMissingDays(
  rows: Array<{ day: string; count: number }>,
  range: number
): VolumeByDay[] {
  const dayMap = new Map<string, number>()
  for (const row of rows) {
    // RPC returns DATE as 'YYYY-MM-DD' string
    dayMap.set(row.day, Number(row.count))
  }

  const result: VolumeByDay[] = []
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    result.push({ date: dateStr, count: dayMap.get(dateStr) ?? 0 })
  }

  return result
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const log = createRequestLogger('analytics')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const parsed = AnalyticsQuerySchema.safeParse({
    range: searchParams.get('range') ?? '30',
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { range } = parsed.data

  try {
    // Execute all three RPC calls in parallel — aggregation happens in PostgreSQL
    const [volumeResult, methodResult, topEndpointsResult] = await Promise.all([
      supabase.rpc('get_volume_by_day', { p_user_id: user.id, p_days: range }),
      supabase.rpc('get_method_breakdown', { p_user_id: user.id, p_days: range }),
      supabase.rpc('get_top_endpoints', { p_user_id: user.id, p_days: range, p_limit: 10 }),
    ])

    if (volumeResult.error) {
      log.error({ err: volumeResult.error }, 'failed to fetch volume data')
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    if (methodResult.error) {
      log.error({ err: methodResult.error }, 'failed to fetch method data')
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    if (topEndpointsResult.error) {
      log.error({ err: topEndpointsResult.error }, 'failed to fetch top endpoints data')
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    const volumeByDay = fillMissingDays(volumeResult.data ?? [], range)

    const methodBreakdown: MethodBreakdown[] = (methodResult.data ?? []).map(
      (row: { method: string; count: number }) => ({
        method: row.method,
        count: Number(row.count),
      })
    )

    const topEndpoints: TopEndpoint[] = (topEndpointsResult.data ?? []).map(
      (row: {
        endpoint_id: string
        endpoint_name: string
        endpoint_slug: string
        count: number
      }) => ({
        id: row.endpoint_id,
        name: row.endpoint_name,
        slug: row.endpoint_slug,
        count: Number(row.count),
      })
    )

    const response: AnalyticsResponse = {
      volumeByDay,
      methodBreakdown,
      topEndpoints,
    }

    return NextResponse.json(response)
  } catch (error) {
    log.error({ err: error }, 'analytics query failed')
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
