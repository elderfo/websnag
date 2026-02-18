import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from './card'

describe('Card', () => {
  it('renders children content', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies default styling', () => {
    const { container } = render(<Card>Content</Card>)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('border-border')
    expect(card.className).toContain('bg-surface')
    expect(card.className).toContain('rounded-lg')
  })

  it('accepts additional className', () => {
    const { container } = render(<Card className="mt-4">Content</Card>)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('mt-4')
  })
})
