import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorPage from './error'

function makeError(message: string): globalThis.Error {
  return new globalThis.Error(message)
}

describe('Root Error Boundary', () => {
  it('renders error message', () => {
    const error = makeError('Test error message')
    render(<ErrorPage error={error} reset={vi.fn()} />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Test error message')).toBeInTheDocument()
  })

  it('calls reset when Try again is clicked', () => {
    const reset = vi.fn()
    render(<ErrorPage error={makeError('fail')} reset={reset} />)
    fireEvent.click(screen.getByText('Try again'))
    expect(reset).toHaveBeenCalledOnce()
  })
})
