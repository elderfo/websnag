import { createClient } from '@/lib/supabase/server'
import { createRequestLogger } from '@/lib/logger'
import { NextResponse, type NextRequest } from 'next/server'

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
  const endpointId = searchParams.get('endpointId')

  if (!endpointId) {
    return NextResponse.json({ error: 'endpointId is required' }, { status: 400 })
  }

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
    .limit(10000)

  const method = searchParams.get('method')
  if (method) {
    query = query.eq('method', method)
  }

  const dateFrom = searchParams.get('dateFrom')
  if (dateFrom) {
    query = query.gte('received_at', dateFrom)
  }

  const dateTo = searchParams.get('dateTo')
  if (dateTo) {
    query = query.lte('received_at', dateTo)
  }

  const search = searchParams.get('search')
  if (search) {
    query = query.ilike('body', `%${search}%`)
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
