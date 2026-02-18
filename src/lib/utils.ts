import { customAlphabet } from 'nanoid'

const SLUG_ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789'
const generateId = customAlphabet(SLUG_ALPHABET, 12)

export function generateSlug(): string {
  return generateId()
}

export function isValidCustomSlug(slug: string): boolean {
  // 3-48 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens
  return /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(slug)
}
