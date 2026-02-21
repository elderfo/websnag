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

/**
 * Set of lowercase header names that must never appear in user-configured
 * webhook endpoint responses. These headers can be exploited for session
 * hijacking, open redirects, CORS bypass, or transport-level attacks.
 */
export const FORBIDDEN_RESPONSE_HEADERS: Set<string> = new Set([
  'set-cookie',
  'location',
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-headers',
  'access-control-allow-methods',
  'content-security-policy',
  'strict-transport-security',
  'x-frame-options',
  'www-authenticate',
  'proxy-authenticate',
  'transfer-encoding',
  'connection',
  'upgrade',
])

/**
 * Returns true if the given header name is allowed in user-configured
 * webhook responses (i.e. it is NOT in the forbidden set).
 */
export function isAllowedResponseHeader(name: string): boolean {
  return !FORBIDDEN_RESPONSE_HEADERS.has(name.toLowerCase())
}

/**
 * Escapes SQL LIKE pattern metacharacters (%, _, \) by prefixing each
 * with a backslash so they are treated as literal characters.
 */
export function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * Validates that a request's Origin header matches the application URL.
 * Returns true if the origin is null (non-browser clients don't send Origin),
 * false if the origin is an empty string, and otherwise compares the origin
 * portion (scheme + host + port) of both values.
 */
export function isValidOrigin(origin: string | null, appUrl: string): boolean {
  if (origin === null) return true
  if (origin === '') return false

  try {
    const originUrl = new URL(origin)
    const appUrlParsed = new URL(appUrl)
    return originUrl.origin === appUrlParsed.origin
  } catch {
    return false
  }
}
