import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProBadge } from './pro-badge'

describe('ProBadge', () => {
  it('renders PRO text', () => {
    render(<ProBadge />)
    expect(screen.getByText('PRO')).toBeInTheDocument()
  })

  it('renders with accent styling', () => {
    render(<ProBadge />)
    const badge = screen.getByText('PRO')
    expect(badge.className).toContain('bg-accent/10')
    expect(badge.className).toContain('text-accent')
    expect(badge.className).toContain('rounded-full')
  })
})
