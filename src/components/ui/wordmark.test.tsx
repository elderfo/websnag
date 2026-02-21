import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Wordmark } from './wordmark'

describe('Wordmark', () => {
  it('renders "web" in gray and "snag" in accent', () => {
    render(<Wordmark />)
    const web = screen.getByText('web')
    const snag = screen.getByText('snag')
    expect(web.className).toContain('text-gray-400')
    expect(web.className).toContain('font-normal')
    expect(snag.className).toContain('text-accent')
    expect(snag.className).toContain('font-semibold')
  })

  it('uses font-mono on the wrapper', () => {
    const { container } = render(<Wordmark />)
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('font-mono')
  })

  it('applies sm size class', () => {
    const { container } = render(<Wordmark size="sm" />)
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('text-sm')
  })

  it('applies md size class by default', () => {
    const { container } = render(<Wordmark />)
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('text-lg')
  })

  it('applies lg size class', () => {
    const { container } = render(<Wordmark size="lg" />)
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('text-3xl')
  })

  it('accepts additional className', () => {
    const { container } = render(<Wordmark className="block mb-6" />)
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('block')
    expect(wrapper?.className).toContain('mb-6')
  })
})
