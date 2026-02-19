import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EndpointForm } from './endpoint-form'
import type { Endpoint } from '@/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
}))

const mockEndpoint: Endpoint = {
  id: 'test-id-123',
  user_id: 'user-1',
  name: 'My Webhook',
  slug: 'my-webhook',
  description: 'Test description',
  response_code: 200,
  response_body: '{"ok": true}',
  response_headers: { 'Content-Type': 'application/json' },
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

describe('EndpointForm', () => {
  it('renders in create mode with empty fields', () => {
    render(<EndpointForm mode="create" />)
    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Create Endpoint' })).toBeInTheDocument()
  })

  it('renders in edit mode with pre-populated fields', () => {
    render(<EndpointForm mode="edit" endpoint={mockEndpoint} />)
    expect(screen.getByLabelText('Name')).toHaveValue('My Webhook')
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
  })

  it('renders cancel button', () => {
    render(<EndpointForm mode="create" />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('renders all form fields', () => {
    render(<EndpointForm mode="create" />)
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByLabelText('Custom Slug')).toBeInTheDocument()
    expect(screen.getByLabelText('Response Code')).toBeInTheDocument()
    expect(screen.getByLabelText('Response Body')).toBeInTheDocument()
    expect(screen.getByLabelText('Response Headers (JSON)')).toBeInTheDocument()
  })

  it('renders PRO badge next to slug label', () => {
    render(<EndpointForm mode="create" />)
    expect(screen.getByText('PRO')).toBeInTheDocument()
  })

  it('disables slug field when isPro is false', () => {
    render(<EndpointForm mode="create" isPro={false} />)
    expect(screen.getByLabelText('Custom Slug')).toBeDisabled()
  })

  it('enables slug field when isPro is true', () => {
    render(<EndpointForm mode="create" isPro />)
    expect(screen.getByLabelText('Custom Slug')).toBeEnabled()
  })

  it('shows upgrade message when not pro', () => {
    render(<EndpointForm mode="create" isPro={false} />)
    expect(
      screen.getByText('Upgrade to Pro for custom slugs. A random slug will be generated.')
    ).toBeInTheDocument()
  })

  it('shows optional slug message when pro', () => {
    render(<EndpointForm mode="create" isPro />)
    expect(screen.getByText('Leave empty for an auto-generated slug.')).toBeInTheDocument()
  })
})
