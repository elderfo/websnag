import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DashboardError from './error'

describe('Dashboard Error Boundary', () => {
  it('renders error message', () => {
    const error = new Error('Dashboard error')
    render(<DashboardError error={error} reset={vi.fn()} />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Dashboard error')).toBeInTheDocument()
  })

  it('calls reset when Try again is clicked', () => {
    const reset = vi.fn()
    render(<DashboardError error={new Error('fail')} reset={reset} />)
    fireEvent.click(screen.getByText('Try again'))
    expect(reset).toHaveBeenCalledOnce()
  })
})
