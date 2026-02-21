const features = [
  {
    title: 'Real-time Capture',
    description:
      'Instant webhook capture with live streaming. See requests the moment they arrive.',
    icon: (
      <svg
        className="h-6 w-6 text-accent"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
        />
      </svg>
    ),
  },
  {
    title: 'AI Analysis',
    description:
      'Auto-detect webhook types, get plain English explanations, and generated handler code.',
    icon: (
      <svg
        className="h-6 w-6 text-accent"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
        />
      </svg>
    ),
  },
  {
    title: 'Replay & Forward',
    description:
      'Replay captured webhooks to any URL. Debug integrations without re-triggering events.',
    icon: (
      <svg
        className="h-6 w-6 text-accent"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182"
        />
      </svg>
    ),
  },
  {
    title: 'Developer First',
    description:
      'Dark mode, keyboard shortcuts, cURL commands, and JSON everywhere. Built by developers, for developers.',
    icon: (
      <svg
        className="h-6 w-6 text-accent"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
        />
      </svg>
    ),
  },
]

export function Features() {
  return (
    <section id="features" className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Everything you need to debug webhooks
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-text-secondary">
          Catch every webhook. Understand every payload.
        </p>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-border bg-surface p-6 transition-colors hover:border-border hover:bg-surface-hover"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-text-primary">{feature.title}</h3>
              <p className="mt-2 leading-relaxed text-text-secondary">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
