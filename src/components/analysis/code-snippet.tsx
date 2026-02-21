'use client'

import { useState } from 'react'
import { CopyButton } from '@/components/ui/copy-button'

type Language = 'node' | 'python'

interface CodeSnippetProps {
  handlerNode: string
  handlerPython: string
}

export function CodeSnippet({ handlerNode, handlerPython }: CodeSnippetProps) {
  const [language, setLanguage] = useState<Language>('node')

  const code = language === 'node' ? handlerNode : handlerPython
  const tabs: { id: Language; label: string }[] = [
    { id: 'node', label: 'Node.js' },
    { id: 'python', label: 'Python' },
  ]

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Handler Code
        </h4>
        <CopyButton text={code} label="Copy Code" className="shrink-0" />
      </div>
      <div className="rounded-lg border border-border overflow-hidden min-w-0">
        {/* Language tabs */}
        <div className="flex border-b border-border bg-surface" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={language === tab.id}
              onClick={() => setLanguage(tab.id)}
              className={`shrink-0 whitespace-nowrap px-4 min-h-[44px] text-xs font-medium transition-colors ${
                language === tab.id
                  ? 'text-text-primary bg-background border-b-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Code block */}
        <pre className="p-4 font-mono text-xs text-text-primary bg-[#0d0d0e] overflow-x-auto max-h-80 leading-relaxed">
          {code}
        </pre>
      </div>
    </div>
  )
}
