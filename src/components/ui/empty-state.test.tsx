import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No items" description="You have no items yet." />)
    expect(screen.getByText('No items')).toBeInTheDocument()
    expect(screen.getByText('You have no items yet.')).toBeInTheDocument()
  })

  it('renders without an action by default', () => {
    render(<EmptyState title="Empty" description="Nothing here." />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders an action link when provided', () => {
    render(
      <EmptyState
        title="No endpoints"
        description="Create one to get started."
        action={{ label: 'Create Endpoint', href: '/endpoints/new' }}
      />
    )
    const link = screen.getByRole('link', { name: 'Create Endpoint' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/endpoints/new')
  })
})
