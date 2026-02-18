export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 0) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function generateCurlCommand(
  request: {
    method: string
    headers: Record<string, string>
    body: string | null
    query_params: Record<string, string>
  },
  endpointUrl: string
): string {
  const parts = [`curl -X ${request.method}`]

  // Include relevant headers (skip hop-by-hop and internal Next.js/infra headers)
  const skipPrefixes = [
    'host',
    'connection',
    'accept-encoding',
    'content-length',
    'transfer-encoding',
    'x-forwarded',
    'x-real-ip',
    'x-vercel',
    'x-invoke',
    'x-middleware',
  ]

  for (const [key, value] of Object.entries(request.headers)) {
    const lower = key.toLowerCase()
    if (skipPrefixes.some((prefix) => lower.startsWith(prefix))) continue
    parts.push(`  -H "${key}: ${value}"`)
  }

  if (request.body) {
    // Escape single quotes in body for shell safety
    const escaped = request.body.replace(/'/g, "'\\''")
    parts.push(`  -d '${escaped}'`)
  }

  const queryString = new URLSearchParams(request.query_params).toString()
  const url = queryString ? `${endpointUrl}?${queryString}` : endpointUrl
  parts.push(`  "${url}"`)

  return parts.join(' \\\n')
}

export function isJsonString(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

export function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}
