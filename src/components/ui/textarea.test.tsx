import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Textarea } from './textarea'

describe('Textarea', () => {
  it('renders a textarea element', () => {
    render(<Textarea placeholder="Type here" />)
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument()
  })

  it('renders a label when provided', () => {
    render(<Textarea label="Description" />)
    expect(screen.getByText('Description')).toBeInTheDocument()
  })

  it('associates the label with the textarea', () => {
    render(<Textarea label="Description" />)
    const textarea = screen.getByLabelText('Description')
    expect(textarea).toBeInTheDocument()
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('renders an error message when provided', () => {
    render(<Textarea label="Body" error="Body is required" />)
    expect(screen.getByText('Body is required')).toBeInTheDocument()
  })

  it('applies error styling when error is present', () => {
    render(<Textarea error="Required" />)
    const textarea = screen.getByRole('textbox')
    expect(textarea.className).toContain('border-red-500')
  })
})
