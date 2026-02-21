'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ProBadge } from '@/components/ui/pro-badge'
import type { Endpoint } from '@/types'

interface EndpointFormProps {
  mode: 'create' | 'edit'
  endpoint?: Endpoint
  isPro?: boolean
}

interface FormErrors {
  name?: string
  slug?: string
  response_code?: string
  response_body?: string
  response_headers?: string
  general?: string
}

export function EndpointForm({ mode, endpoint, isPro = false }: EndpointFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const [name, setName] = useState(endpoint?.name ?? '')
  const [description, setDescription] = useState(endpoint?.description ?? '')
  const [slug, setSlug] = useState(endpoint?.slug ?? '')
  const [responseCode, setResponseCode] = useState(String(endpoint?.response_code ?? 200))
  const [responseBody, setResponseBody] = useState(endpoint?.response_body ?? '{"ok": true}')
  const [responseHeaders, setResponseHeaders] = useState(
    endpoint?.response_headers
      ? JSON.stringify(endpoint.response_headers, null, 2)
      : '{"Content-Type": "application/json"}'
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setSubmitting(true)

    // Client-side validation
    const newErrors: FormErrors = {}
    if (!name.trim()) {
      newErrors.name = 'Name is required'
    }

    const code = parseInt(responseCode, 10)
    if (isNaN(code) || code < 100 || code > 599) {
      newErrors.response_code = 'Must be a valid HTTP status code (100-599)'
    }

    let parsedHeaders: Record<string, string> | undefined
    try {
      parsedHeaders = JSON.parse(responseHeaders)
    } catch {
      newErrors.response_headers = 'Must be valid JSON'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setSubmitting(false)
      return
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      response_code: code,
      response_body: responseBody,
      response_headers: parsedHeaders,
    }

    // Only include slug if user entered one
    if (slug.trim()) {
      payload.slug = slug.trim().toLowerCase()
    }

    try {
      const url = mode === 'create' ? '/api/endpoints' : `/api/endpoints/${endpoint?.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        setErrors({ general: data.error ?? 'Something went wrong' })
        setSubmitting(false)
        return
      }

      const data = await res.json()
      if (mode === 'create') {
        router.push(`/endpoints/${data.id}`)
      } else {
        router.push(`/endpoints/${endpoint?.id}`)
        router.refresh()
      }
    } catch {
      setErrors({ general: 'Network error. Please try again.' })
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      {errors.general && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {errors.general}
        </div>
      )}

      <div>
        <Input
          label="Name"
          placeholder="My Stripe Webhook"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
        />
        <p className="mt-1 text-xs text-text-muted">
          A friendly name for this endpoint (e.g., &quot;Stripe Webhooks&quot;)
        </p>
      </div>

      <div>
        <Textarea
          label="Description"
          placeholder="Optional description for this endpoint"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
        <p className="mt-1 text-xs text-text-muted">
          Optional notes about what this endpoint captures.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <label htmlFor="custom-slug" className="block text-sm font-medium text-text-secondary">
            Custom Slug
          </label>
          <ProBadge />
        </div>
        <Input
          id="custom-slug"
          placeholder={isPro ? 'my-custom-slug' : 'Upgrade to Pro for custom slugs'}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          error={errors.slug}
          disabled={!isPro}
        />
      </div>
      <p className="-mt-3 text-xs text-text-muted">
        {isPro
          ? 'Leave empty for an auto-generated slug.'
          : 'Upgrade to Pro for custom slugs. A random slug will be generated.'}
      </p>

      <div>
        <Input
          label="Response Code"
          type="number"
          min={100}
          max={599}
          value={responseCode}
          onChange={(e) => setResponseCode(e.target.value)}
          error={errors.response_code}
        />
        <p className="mt-1 text-xs text-text-muted">
          HTTP status code returned to the webhook sender (e.g., 200 for OK).
        </p>
      </div>

      <div>
        <Textarea
          label="Response Body"
          value={responseBody}
          onChange={(e) => setResponseBody(e.target.value)}
          error={errors.response_body}
          rows={3}
          className="font-mono text-xs"
        />
        <p className="mt-1 text-xs text-text-muted">
          The response body sent back to the webhook sender.
        </p>
      </div>

      <div>
        <Textarea
          label="Response Headers (JSON)"
          value={responseHeaders}
          onChange={(e) => setResponseHeaders(e.target.value)}
          error={errors.response_headers}
          rows={3}
          className="font-mono text-xs"
        />
        <p className="mt-1 text-xs text-text-muted">
          Response headers as a JSON object (e.g., {`{"Content-Type": "application/json"}`}).
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting
            ? mode === 'create'
              ? 'Creating...'
              : 'Saving...'
            : mode === 'create'
              ? 'Create Endpoint'
              : 'Save Changes'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
