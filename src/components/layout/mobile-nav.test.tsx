import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileNav } from './mobile-nav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

describe('MobileNav', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  it('renders the hamburger button', () => {
    render(<MobileNav />)
    expect(screen.getByLabelText('Open navigation')).toBeInTheDocument()
  })

  it('opens the sidebar when hamburger is clicked', () => {
    render(<MobileNav />)
    const hamburger = screen.getByLabelText('Open navigation')
    fireEvent.click(hamburger)
    expect(screen.getByLabelText('Close navigation')).toBeInTheDocument()
  })

  it('closes the sidebar when close button is clicked', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByLabelText('Open navigation'))
    fireEvent.click(screen.getByLabelText('Close navigation'))
    const hamburger = screen.getByLabelText('Open navigation')
    expect(hamburger).toBeInTheDocument()
  })

  it('prevents body scroll when open', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByLabelText('Open navigation'))
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores body scroll when closed', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByLabelText('Open navigation'))
    fireEvent.click(screen.getByLabelText('Close navigation'))
    expect(document.body.style.overflow).toBe('')
  })

  it('closes when a link inside is clicked', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByLabelText('Open navigation'))
    // Click a link inside the sidebar
    const dashboardLinks = screen.getAllByText('Dashboard')
    const link = dashboardLinks[0].closest('a')
    if (link) {
      fireEvent.click(link)
    }
    expect(document.body.style.overflow).toBe('')
  })
})
