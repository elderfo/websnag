/**
 * Security helpers for input validation and sanitization.
 */

/**
 * Validates that a redirect path is safe (relative, no protocol-relative URLs,
 * no backslashes, no CRLF injection).
 */
export function isSafeRedirectPath(path: string): boolean {
  if (!path || !path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (path.includes('\\')) return false
  if (path.includes('\r') || path.includes('\n')) return false
  return true
}
