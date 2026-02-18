import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MethodBadge } from './method-badge'

describe('MethodBadge', () => {
  it('renders the method text in uppercase', () => {
    render(<MethodBadge method="post" />)
    expect(screen.getByText('POST')).toBeInTheDocument()
  })

  it('applies blue styling for GET', () => {
    render(<MethodBadge method="GET" />)
    const badge = screen.getByText('GET')
    expect(badge.className).toContain('text-blue-400')
    expect(badge.className).toContain('bg-blue-500/20')
  })

  it('applies green styling for POST', () => {
    render(<MethodBadge method="POST" />)
    const badge = screen.getByText('POST')
    expect(badge.className).toContain('text-green-400')
  })

  it('applies orange styling for PUT', () => {
    render(<MethodBadge method="PUT" />)
    const badge = screen.getByText('PUT')
    expect(badge.className).toContain('text-orange-400')
  })

  it('applies red styling for DELETE', () => {
    render(<MethodBadge method="DELETE" />)
    const badge = screen.getByText('DELETE')
    expect(badge.className).toContain('text-red-400')
  })

  it('applies purple styling for PATCH', () => {
    render(<MethodBadge method="PATCH" />)
    const badge = screen.getByText('PATCH')
    expect(badge.className).toContain('text-purple-400')
  })

  it('applies default styling for unknown methods', () => {
    render(<MethodBadge method="OPTIONS" />)
    const badge = screen.getByText('OPTIONS')
    expect(badge.className).toContain('text-text-secondary')
  })

  it('uses monospace font', () => {
    render(<MethodBadge method="GET" />)
    const badge = screen.getByText('GET')
    expect(badge.className).toContain('font-mono')
  })

  it('accepts custom className', () => {
    render(<MethodBadge method="GET" className="extra-class" />)
    const badge = screen.getByText('GET')
    expect(badge.className).toContain('extra-class')
  })
})
