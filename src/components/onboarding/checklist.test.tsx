import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OnboardingChecklist } from './checklist'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

const store: Record<string, string> = {}
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key]
  }),
}

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

describe('OnboardingChecklist', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key]
    }
    mockLocalStorage.getItem.mockClear()
    mockLocalStorage.setItem.mockClear()
    mockLocalStorage.removeItem.mockClear()
  })

  it('renders all four steps when nothing is completed', () => {
    render(
      <OnboardingChecklist
        hasUsername={false}
        hasEndpoints={false}
        hasRequests={false}
        hasAnalysis={false}
      />
    )

    expect(screen.getByText('Getting Started')).toBeInTheDocument()
    expect(screen.getByText('Set your username')).toBeInTheDocument()
    expect(screen.getByText('Create your first endpoint')).toBeInTheDocument()
    expect(screen.getByText('Receive your first request')).toBeInTheDocument()
    expect(screen.getByText('Run your first AI analysis')).toBeInTheDocument()
    expect(screen.getByText('0 of 4 complete')).toBeInTheDocument()
  })

  it('shows completed count and applies line-through for completed steps', () => {
    render(
      <OnboardingChecklist
        hasUsername={true}
        hasEndpoints={true}
        hasRequests={false}
        hasAnalysis={false}
      />
    )

    expect(screen.getByText('2 of 4 complete')).toBeInTheDocument()

    const usernameStep = screen.getByText('Set your username')
    expect(usernameStep).toHaveClass('line-through')

    const endpointStep = screen.getByText('Create your first endpoint')
    expect(endpointStep).toHaveClass('line-through')
  })

  it('does not render when all steps are complete', () => {
    const { container } = render(
      <OnboardingChecklist
        hasUsername={true}
        hasEndpoints={true}
        hasRequests={true}
        hasAnalysis={true}
      />
    )

    expect(container.innerHTML).toBe('')
  })

  it('does not render when dismissed via localStorage', () => {
    store['websnag_onboarding_dismissed'] = 'true'

    const { container } = render(
      <OnboardingChecklist
        hasUsername={false}
        hasEndpoints={false}
        hasRequests={false}
        hasAnalysis={false}
      />
    )

    expect(container.innerHTML).toBe('')
  })

  it('dismisses and sets localStorage when dismiss button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <OnboardingChecklist
        hasUsername={false}
        hasEndpoints={false}
        hasRequests={false}
        hasAnalysis={false}
      />
    )

    const dismissButton = screen.getByRole('button', { name: 'Dismiss onboarding checklist' })
    await user.click(dismissButton)

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('websnag_onboarding_dismissed', 'true')
  })

  it('shows action links for incomplete steps', () => {
    render(
      <OnboardingChecklist
        hasUsername={false}
        hasEndpoints={false}
        hasRequests={false}
        hasAnalysis={false}
      />
    )

    expect(screen.getByRole('link', { name: /Go to Settings/ })).toHaveAttribute(
      'href',
      '/settings?setup=username'
    )
    expect(screen.getByRole('link', { name: /Create Endpoint/ })).toHaveAttribute(
      'href',
      '/endpoints/new'
    )
  })

  it('does not show action links for completed steps', () => {
    render(
      <OnboardingChecklist
        hasUsername={true}
        hasEndpoints={false}
        hasRequests={false}
        hasAnalysis={false}
      />
    )

    expect(screen.queryByRole('link', { name: /Go to Settings/ })).not.toBeInTheDocument()
  })
})
