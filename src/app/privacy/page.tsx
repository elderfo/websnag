import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — Websnag',
  description:
    'How Websnag collects, uses, and protects your data. Clear, developer-friendly privacy practices.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <article className="mx-auto max-w-3xl">
        <header className="mb-12">
          <Link
            href="/"
            className="mb-8 inline-block font-mono text-sm text-text-muted transition-colors hover:text-text-secondary"
          >
            &larr; Back to home
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Privacy Policy</h1>
          <p className="mt-2 text-sm text-text-muted">Last updated: February 21, 2026</p>
        </header>

        <div className="space-y-10 text-text-secondary leading-relaxed">
          <section>
            <p>
              Websnag is a webhook debugging tool built for developers. We take a straightforward
              approach to privacy: we collect only what we need to provide the service, we are
              transparent about what that includes, and we delete it on a clear schedule.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-text-primary">What We Collect</h2>

            <h3 className="mb-2 mt-6 text-lg font-medium text-text-primary">Account information</h3>
            <p>
              When you sign up, we store your email address and basic profile information provided
              through GitHub OAuth or magic link authentication. This includes your username and
              user ID managed by Supabase Auth.
            </p>

            <h3 className="mb-2 mt-6 text-lg font-medium text-text-primary">Webhook data</h3>
            <p>
              When an external service sends a request to your Websnag endpoint, we capture and
              store:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-text-muted">
              <li>HTTP method (GET, POST, PUT, etc.)</li>
              <li>Request headers</li>
              <li>Request body (up to 1 MB)</li>
              <li>Query parameters</li>
              <li>Content type</li>
              <li>Source IP address</li>
              <li>Payload size in bytes</li>
              <li>Timestamp of receipt</li>
            </ul>
            <p className="mt-3">
              This is the core of what Websnag does. Without storing these fields, we cannot show
              you what your webhooks contain.
            </p>

            <h3 className="mb-2 mt-6 text-lg font-medium text-text-primary">AI analysis results</h3>
            <p>
              When you request an AI analysis of a webhook payload, the analysis output (source
              identification, event type, summary, key fields, and generated handler code) is stored
              alongside the original request so you can reference it later.
            </p>

            <h3 className="mb-2 mt-6 text-lg font-medium text-text-primary">Usage and billing</h3>
            <p>
              We track monthly request counts and AI analysis counts per account to enforce plan
              limits. If you subscribe to the Pro plan, we store your Stripe customer ID and
              subscription ID. We do not store credit card numbers or payment details directly
              &mdash; Stripe handles that.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-text-primary">How We Use Your Data</h2>
            <ul className="list-inside list-disc space-y-2 text-text-muted">
              <li>
                <span className="text-text-secondary">Display captured webhook requests</span> in
                your dashboard so you can inspect and debug them.
              </li>
              <li>
                <span className="text-text-secondary">Provide AI-powered analysis</span> of webhook
                payloads when you request it.
              </li>
              <li>
                <span className="text-text-secondary">Enforce plan limits</span> (endpoint count,
                request volume, AI analysis quota).
              </li>
              <li>
                <span className="text-text-secondary">Process payments</span> through Stripe for Pro
                subscriptions.
              </li>
              <li>
                <span className="text-text-secondary">Send transactional emails</span> related to
                your account (authentication, billing).
              </li>
            </ul>
            <p className="mt-4">
              We do not sell your data. We do not use your webhook payloads to train AI models. We
              do not serve ads.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-text-primary">Data Retention</h2>
            <p>Webhook request data is automatically deleted based on your plan:</p>
            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="px-4 py-3 font-medium text-text-primary">Plan</th>
                    <th className="px-4 py-3 font-medium text-text-primary">Retention Window</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="px-4 py-3 text-text-secondary">Free</td>
                    <td className="px-4 py-3 text-text-muted">24 hours</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-text-secondary">Pro ($7/mo)</td>
                    <td className="px-4 py-3 text-text-muted">30 days</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              Deletion is handled by an automated job that runs on a regular schedule. Once the
              retention window passes, the request data (including headers, body, query parameters,
              source IP, and any AI analysis) is permanently removed.
            </p>
            <p className="mt-3">
              Account information and subscription records are retained as long as your account
              exists. If you delete your account, all associated data (endpoints, requests, usage
              records, and subscription info) is permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-text-primary">Third-Party Services</h2>
            <p>
              Websnag relies on the following third-party services to operate. Each has its own
              privacy policy governing how they handle data:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2 text-text-muted">
              <li>
                <span className="text-text-secondary">Supabase</span> &mdash; Database hosting, user
                authentication, and real-time data delivery.
              </li>
              <li>
                <span className="text-text-secondary">Stripe</span> &mdash; Payment processing for
                Pro subscriptions. Stripe receives your payment details directly; we never see or
                store card numbers.
              </li>
              <li>
                <span className="text-text-secondary">Anthropic (Claude API)</span> &mdash;
                AI-powered webhook analysis. When you request an analysis, the webhook method,
                headers, and body are sent to Anthropic for processing. Anthropic does not use API
                inputs to train their models.
              </li>
              <li>
                <span className="text-text-secondary">Vercel</span> &mdash; Application hosting and
                serverless function execution.
              </li>
              <li>
                <span className="text-text-secondary">Upstash</span> &mdash; Rate limiting via Redis
                to protect the service from abuse.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-text-primary">Your Rights</h2>
            <p>You can:</p>
            <ul className="mt-2 list-inside list-disc space-y-2 text-text-muted">
              <li>
                <span className="text-text-secondary">Delete individual requests</span> or
                bulk-delete requests from your dashboard at any time.
              </li>
              <li>
                <span className="text-text-secondary">Delete your endpoints</span>, which
                permanently removes all associated request data.
              </li>
              <li>
                <span className="text-text-secondary">Export your data</span> by downloading request
                history as JSON from the dashboard.
              </li>
              <li>
                <span className="text-text-secondary">Delete your account</span> to permanently
                remove all your data from our systems.
              </li>
              <li>
                <span className="text-text-secondary">Contact us</span> with questions about your
                data or to request its removal.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-text-primary">Contact</h2>
            <p>
              If you have questions about this privacy policy or how your data is handled, reach out
              at{' '}
              <a
                href="mailto:privacy@websnag.dev"
                className="text-text-primary underline underline-offset-4 transition-colors hover:text-text-secondary"
              >
                privacy@websnag.dev
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
