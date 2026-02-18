'use client'

import { useState, useCallback } from 'react'
import { Button } from './button'

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
}

export function CopyButton({ text, label = 'Copy', className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: do nothing if clipboard is unavailable
    }
  }, [text])

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleCopy} className={className}>
      {copied ? 'Copied!' : label}
    </Button>
  )
}
