'use client'

import { useState } from 'react'
import { CopyButton } from '@/components/ui/copy-button'
import { Button } from '@/components/ui/button'
import { MethodBadge } from './method-badge'
import { formatBytes, formatJson, isJsonString, generateCurlCommand, timeAgo } from '@/lib/format'
import type { WebhookRequest } from '@/types'

type Tab = 'body' | 'headers' | 'query' | 'analysis'

interface RequestDetailProps {
  request: WebhookRequest
  endpointUrl: string
}

export function RequestDetail({ request, endpointUrl }: RequestDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('body')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'body', label: 'Body' },
    { id: 'headers', label: 'Headers' },
    { id: 'query', label: 'Query Params' },
    { id: 'analysis', label: 'Analysis' },
  ]

  const curlCommand = generateCurlCommand(request, endpointUrl)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <MethodBadge method={request.method} />
        <span className="text-sm text-text-secondary">{formatBytes(request.size_bytes)}</span>
        <span className="text-sm text-text-muted">{timeAgo(request.received_at)}</span>
        {request.source_ip && (
          <span className="text-xs text-text-muted ml-auto">from {request.source_ip}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-text-primary border-b-2 border-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'body' && <BodyTab request={request} curlCommand={curlCommand} />}
        {activeTab === 'headers' && <HeadersTab headers={request.headers} />}
        {activeTab === 'query' && <QueryTab params={request.query_params} />}
        {activeTab === 'analysis' && <AnalysisTab request={request} />}
      </div>
    </div>
  )
}

function BodyTab({ request, curlCommand }: { request: WebhookRequest; curlCommand: string }) {
  const body = request.body
  const hasBody = body !== null && body.length > 0

  return (
    <div className="space-y-4">
      {/* Request body */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Request Body
          </h3>
          {hasBody && <CopyButton text={body} label="Copy" />}
        </div>
        {hasBody ? (
          <pre className="rounded-lg bg-background p-4 font-mono text-sm text-text-primary overflow-auto max-h-96">
            {isJsonString(body) ? formatJson(body) : body}
          </pre>
        ) : (
          <p className="text-sm text-text-muted italic">No request body</p>
        )}
      </div>

      {/* cURL command */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">
            cURL Command
          </h3>
          <CopyButton text={curlCommand} label="Copy cURL" />
        </div>
        <pre className="rounded-lg bg-background p-4 font-mono text-xs text-text-secondary overflow-auto max-h-48">
          {curlCommand}
        </pre>
      </div>
    </div>
  )
}

function HeadersTab({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers)

  if (entries.length === 0) {
    return <p className="text-sm text-text-muted italic">No headers</p>
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface border-b border-border">
            <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-muted">
              Header
            </th>
            <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-muted">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-border last:border-b-0">
              <td className="px-4 py-2 font-mono text-xs text-accent whitespace-nowrap">{key}</td>
              <td className="px-4 py-2 font-mono text-xs text-text-secondary break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function QueryTab({ params }: { params: Record<string, string> }) {
  const entries = Object.entries(params)

  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-text-muted">No query parameters</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface border-b border-border">
            <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-muted">
              Parameter
            </th>
            <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-muted">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-border last:border-b-0">
              <td className="px-4 py-2 font-mono text-xs text-accent whitespace-nowrap">{key}</td>
              <td className="px-4 py-2 font-mono text-xs text-text-secondary break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AnalysisTab({ request }: { request: WebhookRequest }) {
  if (request.ai_analysis) {
    const analysis = request.ai_analysis
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
            {analysis.source}
          </span>
          <span className="text-sm text-text-secondary">{analysis.webhook_type}</span>
        </div>
        <p className="text-sm text-text-primary">{analysis.summary}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
        <svg
          className="h-5 w-5 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
          />
        </svg>
      </div>
      <p className="text-sm text-text-secondary mb-3">Use AI to analyze this webhook payload</p>
      <Button variant="secondary" size="sm" disabled>
        Analyze with AI
      </Button>
      <p className="text-xs text-text-muted mt-2">Coming soon</p>
    </div>
  )
}
