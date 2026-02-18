import Link from 'next/link'

interface PlanFeature {
  text: string
  included: boolean
}

interface PricingPlan {
  name: string
  price: string
  period: string
  description: string
  features: PlanFeature[]
  cta: string
  ctaHref: string
  highlighted: boolean
}

const plans: PricingPlan[] = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for trying out webhook debugging.',
    features: [
      { text: '2 endpoints', included: true },
      { text: '100 requests/month', included: true },
      { text: '24-hour history', included: true },
      { text: '5 AI analyses/month', included: true },
      { text: 'Replay webhooks', included: false },
      { text: 'Custom endpoint slugs', included: false },
    ],
    cta: 'Get Started',
    ctaHref: '/login',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$7',
    period: '/month',
    description: 'For developers who ship fast and need full power.',
    features: [
      { text: 'Unlimited endpoints', included: true },
      { text: 'Unlimited requests', included: true },
      { text: '30-day history', included: true },
      { text: 'Unlimited AI analysis', included: true },
      { text: 'Replay webhooks', included: true },
      { text: 'Custom endpoint slugs', included: true },
    ],
    cta: 'Upgrade to Pro',
    ctaHref: '/login',
    highlighted: true,
  },
]

function CheckIcon({ included }: { included: boolean }) {
  if (included) {
    return (
      <svg
        className="h-4 w-4 shrink-0 text-accent"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    )
  }
  return (
    <svg
      className="h-4 w-4 shrink-0 text-text-muted"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export function Pricing() {
  return (
    <section id="pricing" className="px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-center text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Simple, transparent pricing
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-text-secondary">
          Start free. Upgrade when you need more power.
        </p>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-lg border p-6 ${
                plan.highlighted
                  ? 'border-accent bg-surface shadow-[0_0_24px_-4px_rgba(0,255,136,0.15)]'
                  : 'border-border bg-surface'
              }`}
            >
              {plan.highlighted && (
                <span className="mb-4 inline-flex w-fit rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  Most popular
                </span>
              )}

              <h3 className="text-xl font-semibold text-text-primary">{plan.name}</h3>
              <p className="mt-1 text-sm text-text-secondary">{plan.description}</p>

              <div className="mt-6 flex items-baseline">
                <span className="text-4xl font-bold text-text-primary">{plan.price}</span>
                <span className="ml-1 text-text-muted">{plan.period}</span>
              </div>

              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-center gap-3">
                    <CheckIcon included={feature.included} />
                    <span className={feature.included ? 'text-text-secondary' : 'text-text-muted'}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaHref}
                className={`mt-8 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                  plan.highlighted
                    ? 'bg-accent text-black hover:bg-accent-hover'
                    : 'border border-border bg-surface text-text-primary hover:bg-surface-hover'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
