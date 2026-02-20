import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UsageWarningBanner } from './usage-warning-banner'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('UsageWarningBanner', () => {
  it('returns null when below 80% for both metrics', () => {
    const { container } = render(
      <UsageWarningBanner
        requestCount={50}
        maxRequests={100}
        aiAnalysisCount={2}
        maxAiAnalyses={5}
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows warning banner at 80% request usage', () => {
    render(
      <UsageWarningBanner
        requestCount={80}
        maxRequests={100}
        aiAnalysisCount={0}
        maxAiAnalyses={5}
      />
    )
    expect(screen.getByText('Approaching request limit')).toBeInTheDocument()
    expect(screen.getByText(/80 of 100 requests/)).toBeInTheDocument()
  })

  it('shows alert banner at 100% request usage', () => {
    render(
      <UsageWarningBanner
        requestCount={100}
        maxRequests={100}
        aiAnalysisCount={0}
        maxAiAnalyses={5}
      />
    )
    expect(screen.getByText('Monthly request limit reached')).toBeInTheDocument()
    expect(screen.getByText(/all 100 requests/)).toBeInTheDocument()
  })

  it('shows warning banner at 80% AI analysis usage', () => {
    render(
      <UsageWarningBanner
        requestCount={0}
        maxRequests={100}
        aiAnalysisCount={4}
        maxAiAnalyses={5}
      />
    )
    expect(screen.getByText('Approaching AI analysis limit')).toBeInTheDocument()
    expect(screen.getByText(/4 of 5 AI analyses/)).toBeInTheDocument()
  })

  it('shows alert banner at 100% AI analysis usage', () => {
    render(
      <UsageWarningBanner
        requestCount={0}
        maxRequests={100}
        aiAnalysisCount={5}
        maxAiAnalyses={5}
      />
    )
    expect(screen.getByText('AI analysis limit reached')).toBeInTheDocument()
    expect(screen.getByText(/all 5 AI analyses/)).toBeInTheDocument()
  })

  it('shows upgrade link pointing to /billing', () => {
    render(
      <UsageWarningBanner
        requestCount={100}
        maxRequests={100}
        aiAnalysisCount={0}
        maxAiAnalyses={5}
      />
    )
    const upgradeLink = screen.getByRole('link', { name: 'Upgrade to Pro' })
    expect(upgradeLink).toHaveAttribute('href', '/billing')
  })

  it('returns null when limits are Infinity (Pro users)', () => {
    const { container } = render(
      <UsageWarningBanner
        requestCount={500}
        maxRequests={Infinity}
        aiAnalysisCount={50}
        maxAiAnalyses={Infinity}
      />
    )
    expect(container.innerHTML).toBe('')
  })
})
