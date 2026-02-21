import Link from 'next/link'

import { Wordmark } from '@/components/ui/wordmark'

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div>
            <Wordmark size="sm" />
            <p className="mt-1 text-sm text-text-muted">Built by developers, for developers.</p>
          </div>

          <nav className="flex gap-6" aria-label="Footer">
            <a
              href="#"
              className="text-sm text-text-muted transition-colors hover:text-text-secondary"
            >
              GitHub
            </a>
            <a
              href="#"
              className="text-sm text-text-muted transition-colors hover:text-text-secondary"
            >
              Docs
            </a>
            <Link
              href="/privacy"
              className="text-sm text-text-muted transition-colors hover:text-text-secondary"
            >
              Privacy
            </Link>
            <a
              href="#"
              className="text-sm text-text-muted transition-colors hover:text-text-secondary"
            >
              Terms
            </a>
          </nav>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-center">
          <p className="text-xs text-text-muted">&copy; 2026 Websnag</p>
        </div>
      </div>
    </footer>
  )
}
