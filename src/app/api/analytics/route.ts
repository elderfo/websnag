import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createRequestLogger } from '@/lib/logger'
import { NextResponse, type NextRequest } from 'next/server'

const VALID_RANGES = [7, 30, 90] as const

const AnalyticsQuerySchema = z.object({
  range: z.coerce
    .number()
    .refine((v): v is (typeof VALID_RANGES)[number] => VALID_RANGES.includes(v as never), {
      message: 'range must be 7, 30, or 90',
    }),
})

export interface VolumeByDay {
  date: string
  count: number
}

export interface MethodBreakdown {
  method: string
  count: number
}

export interface TopEndpoint {
  id: string
  name: string
  slug: string
  count: number
}

export interface AnalyticsResponse {
  volumeByDay: VolumeByDay[]
  methodBreakdown: MethodBreakdown[]
  topEndpoints: TopEndpoint[]
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
  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - range)
  const sinceIso = sinceDate.toISOString()

  try {
    // Fetch user's endpoint IDs (RLS ensures only their own)
    const { data: endpoints, error: endpointsError } = await supabase
      .from('endpoints')
      .select('id, name, slug')

    if (endpointsError) {
      log.error({ err: endpointsError }, 'failed to fetch endpoints')
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    if (!endpoints || endpoints.length === 0) {
      const empty: AnalyticsResponse = {
        volumeByDay: [],
        methodBreakdown: [],
        topEndpoints: [],
      }
      return NextResponse.json(empty)
    }

    const endpointIds = endpoints.map((e) => e.id)

    // Volume by day: aggregate request count per day
    // Using Supabase's PostgREST, we need to fetch received_at and aggregate client-side
    // for date grouping. However, to keep it efficient we only select the fields we need.
    // A better approach would be an RPC, but to avoid a migration we'll use a targeted query.
    const { data: volumeRows, error: volumeError } = await supabase
      .from('requests')
      .select('received_at')
      .in('endpoint_id', endpointIds)
      .gte('received_at', sinceIso)
      .order('received_at', { ascending: true })

    if (volumeError) {
      log.error({ err: volumeError }, 'failed to fetch volume data')
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    // Aggregate volume by day
    const volumeMap = new Map<string, number>()
    for (const row of volumeRows ?? []) {
      const day = row.received_at.slice(0, 10)
      volumeMap.set(day, (volumeMap.get(day) ?? 0) + 1)
    }

    // Fill in missing days with zero counts
    const volumeByDay: VolumeByDay[] = []
    const current = new Date(sinceDate)
    current.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    while (current <= today) {
      const dateStr = current.toISOString().slice(0, 10)
      volumeByDay.push({ date: dateStr, count: volumeMap.get(dateStr) ?? 0 })
      current.setDate(current.getDate() + 1)
    }

    // Method breakdown: aggregate request count per method
    const { data: methodRows, error: methodError } = await supabase
      .from('requests')
      .select('method')
      .in('endpoint_id', endpointIds)
      .gte('received_at', sinceIso)

    if (methodError) {
      log.error({ err: methodError }, 'failed to fetch method data')
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    const methodMap = new Map<string, number>()
    for (const row of methodRows ?? []) {
      methodMap.set(row.method, (methodMap.get(row.method) ?? 0) + 1)
    }
    const methodBreakdown: MethodBreakdown[] = Array.from(methodMap.entries())
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count)

    // Top endpoints: aggregate request count per endpoint
    const { data: endpointRows, error: endpointError } = await supabase
      .from('requests')
      .select('endpoint_id')
      .in('endpoint_id', endpointIds)
      .gte('received_at', sinceIso)

    if (endpointError) {
      log.error({ err: endpointError }, 'failed to fetch endpoint data')
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    const endpointCountMap = new Map<string, number>()
    for (const row of endpointRows ?? []) {
      endpointCountMap.set(row.endpoint_id, (endpointCountMap.get(row.endpoint_id) ?? 0) + 1)
    }

    const endpointLookup = new Map(endpoints.map((e) => [e.id, e]))
    const topEndpoints: TopEndpoint[] = Array.from(endpointCountMap.entries())
      .map(([id, count]) => {
        const ep = endpointLookup.get(id)
        return {
          id,
          name: ep?.name ?? 'Unknown',
          slug: ep?.slug ?? '',
          count,
        }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

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
