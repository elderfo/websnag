import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from './page'

describe('Home page', () => {
  it('renders the hero heading', () => {
    render(<Home />)
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /see what your webhooks are really saying/i,
      })
    ).toBeInTheDocument()
  })

  it('renders the Start for Free CTA link', () => {
    render(<Home />)
    const cta = screen.getByRole('link', { name: /start for free/i })
    expect(cta).toBeInTheDocument()
    expect(cta).toHaveAttribute('href', '/login')
  })

  it('renders feature cards', () => {
    render(<Home />)
    expect(screen.getByText('Real-time Capture')).toBeInTheDocument()
    expect(screen.getByText('AI Analysis')).toBeInTheDocument()
    expect(screen.getByText('Replay & Forward')).toBeInTheDocument()
    expect(screen.getByText('Developer First')).toBeInTheDocument()
  })

  it('renders pricing section with both plans', () => {
    render(<Home />)
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('$0')).toBeInTheDocument()
    expect(screen.getByText('$7')).toBeInTheDocument()
  })

  it('renders the footer with copyright', () => {
    render(<Home />)
    expect(screen.getByText(/2026 Websnag/)).toBeInTheDocument()
  })

  it('renders footer navigation links', () => {
    render(<Home />)
    expect(screen.getByRole('navigation', { name: /footer/i })).toBeInTheDocument()
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('Docs')).toBeInTheDocument()
    expect(screen.getByText('Privacy')).toBeInTheDocument()
    expect(screen.getByText('Terms')).toBeInTheDocument()
  })
})
