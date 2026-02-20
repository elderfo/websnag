import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Pricing } from './pricing'

describe('Pricing', () => {
  it('links Free CTA to /login without intent param', () => {
    render(<Pricing />)
    const freeLink = screen.getByRole('link', { name: 'Get Started' })
    expect(freeLink).toHaveAttribute('href', '/login')
  })

  it('links Pro CTA to /login with intent=upgrade param', () => {
    render(<Pricing />)
    const proLink = screen.getByRole('link', { name: 'Upgrade to Pro' })
    expect(proLink).toHaveAttribute('href', '/login?intent=upgrade')
  })
})
