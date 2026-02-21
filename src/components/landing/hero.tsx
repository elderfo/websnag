import Link from 'next/link'
import { Wordmark } from '@/components/ui/wordmark'

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 py-24 sm:py-32 lg:py-40">
      {/* Dot pattern background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, #fafafa 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative mx-auto max-w-4xl text-center">
        <Wordmark size="lg" className="mb-6 block" />

        <h1 className="bg-gradient-to-b from-text-primary to-text-secondary bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl lg:text-7xl">
          See what your webhooks are really saying.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-secondary sm:text-xl">
          Catch every webhook. Understand every payload.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center rounded-md bg-accent px-6 py-3 text-base font-medium text-black transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            Start for Free
          </Link>
          <Link
            href="#pricing"
            className="inline-flex items-center rounded-md border border-border bg-surface px-6 py-3 text-base font-medium text-text-primary transition-colors hover:bg-surface-hover"
          >
            View Pricing
          </Link>
        </div>

        {/* Terminal illustration */}
        <div className="mx-auto mt-16 max-w-2xl overflow-hidden rounded-lg border border-border bg-surface font-mono text-sm">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-500/60" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
            <span className="h-3 w-3 rounded-full bg-green-500/60" />
            <span className="ml-2 text-text-muted">terminal</span>
          </div>
          <div className="space-y-1 px-4 py-4 text-left text-xs leading-relaxed sm:text-sm">
            <p className="text-text-muted">
              <span className="text-accent">$</span> curl -X POST
              https://websnag.dev/wh/a7k3m9x2p4nq \
            </p>
            <p className="pl-4 text-text-muted">-H &quot;Content-Type: application/json&quot; \</p>
            <p className="pl-4 text-text-muted">
              -d &apos;{'{'}&#34;type&#34;: &#34;payment_intent.succeeded&#34;, &#34;amount&#34;:
              2000{'}'}&apos;
            </p>
            <p className="mt-3 text-text-secondary">
              <span className="text-accent">{'>'}</span> 200 OK
            </p>
            <p className="mt-3 text-text-muted">
              <span className="text-accent">[websnag]</span>{' '}
              <span className="text-method-post">POST</span> received &mdash;{' '}
              <span className="text-text-primary">Stripe payment_intent.succeeded</span>
            </p>
            <p className="text-text-muted">
              <span className="text-accent">[websnag]</span> Payment of $20.00 USD completed for
              customer cus_N1k...
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
