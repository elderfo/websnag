'use client'

import { MethodBadge } from './method-badge'
import { formatBytes, timeAgo } from '@/lib/format'
import type { WebhookRequest } from '@/types'

interface RequestRowProps {
  request: WebhookRequest
  isSelected: boolean
  isNew?: boolean
  onSelect: (request: WebhookRequest) => void
}

export function RequestRow({ request, isSelected, isNew = false, onSelect }: RequestRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(request)}
      className={`w-full text-left px-4 py-3 border-b border-border transition-all duration-200 hover:bg-surface-hover ${
        isSelected
          ? 'bg-surface-hover border-l-2 border-l-accent'
          : 'border-l-2 border-l-transparent'
      } ${isNew ? 'animate-highlight' : ''}`}
    >
      <div className="flex items-center gap-3">
        <MethodBadge method={request.method} />

        <span className="flex-1 truncate font-mono text-xs text-text-secondary">
          {request.content_type ?? 'no content-type'}
        </span>

        <span className="text-xs text-text-muted whitespace-nowrap">
          {formatBytes(request.size_bytes)}
        </span>

        <span
          className={`h-2 w-2 rounded-full flex-shrink-0 ${
            request.ai_analysis ? 'bg-green-400' : 'bg-white/20'
          }`}
          title={request.ai_analysis ? 'AI analyzed' : 'Not analyzed'}
        />

        <span className="text-xs text-text-muted whitespace-nowrap">
          {timeAgo(request.received_at)}
        </span>
      </div>
    </button>
  )
}
