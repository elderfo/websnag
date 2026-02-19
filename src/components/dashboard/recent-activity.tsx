import Link from 'next/link'
import type { WebhookRequest } from '@/types'
import { MethodBadge } from '@/components/requests/method-badge'
import { formatBytes, timeAgo } from '@/lib/format'

type RecentRequest = Pick<
  WebhookRequest,
  'id' | 'endpoint_id' | 'method' | 'size_bytes' | 'received_at'
>

interface RecentActivityProps {
  requests: RecentRequest[]
  endpointNames: Record<string, string>
}

export function RecentActivity({ requests, endpointNames }: RecentActivityProps) {
  if (requests.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-text-muted">No requests yet — send a webhook to get started.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-surface">
            <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
              Method
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">
              Endpoint
            </th>
            <th className="hidden px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted sm:table-cell">
              Size
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-text-muted">
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr
              key={req.id}
              className="border-b border-border last:border-b-0 hover:bg-white/[0.02] transition-colors"
            >
              <td className="px-4 py-2.5">
                <MethodBadge method={req.method} />
              </td>
              <td className="px-4 py-2.5">
                <Link
                  href={`/endpoints/${req.endpoint_id}`}
                  className="text-sm text-text-primary hover:text-accent transition-colors"
                >
                  {endpointNames[req.endpoint_id] ?? 'Unknown'}
                </Link>
              </td>
              <td className="hidden px-4 py-2.5 text-sm text-text-muted sm:table-cell">
                {formatBytes(req.size_bytes)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs text-text-muted">
                {timeAgo(req.received_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
