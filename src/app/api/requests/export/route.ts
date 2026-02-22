import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createRequestLogger } from '@/lib/logger'
import { escapeLikePattern } from '@/lib/security'
import { NextResponse, type NextRequest } from 'next/server'

const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

const ExportQuerySchema = z.object({
  endpointId: z.string().min(1, 'endpointId is required'),
  method: z.enum(VALID_METHODS).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  search: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const log = createRequestLogger('export-requests')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)

  const parsed = ExportQuerySchema.safeParse({
    endpointId: searchParams.get('endpointId') ?? undefined,
    method: searchParams.get('method') ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    search: searchParams.get('search') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { endpointId, method, dateFrom, dateTo, search } = parsed.data

  // Verify user owns the endpoint
  const { data: endpoint } = await supabase
    .from('endpoints')
    .select('id')
    .eq('id', endpointId)
    .eq('user_id', user.id)
    .single()

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
  }

  // Build filtered query — limit prevents unbounded result sets
  let query = supabase
    .from('requests')
    .select(
      'id, method, headers, body, query_params, content_type, source_ip, size_bytes, received_at, ai_analysis'
    )
    .eq('endpoint_id', endpointId)
    .order('received_at', { ascending: false })
    .limit(1000)

  if (method) {
    query = query.eq('method', method)
  }

  if (dateFrom) {
    query = query.gte('received_at', dateFrom)
  }

  if (dateTo) {
    query = query.lte('received_at', dateTo)
  }

  if (search) {
    query = query.ilike('body', `%${escapeLikePattern(search)}%`)
  }

  const { data: requests, error } = await query

  if (error) {
    log.error({ err: error, endpointId }, 'export query failed')
    return NextResponse.json({ error: 'Failed to export requests' }, { status: 500 })
  }

  if (!requests || requests.length === 0) {
    return NextResponse.json({ error: 'No requests match your filters' }, { status: 404 })
  }

  const json = JSON.stringify(requests, null, 2)

  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="requests-${endpointId}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
