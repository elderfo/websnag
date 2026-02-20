import { describe, it, expect } from 'vitest'
import { createLogger, createRequestLogger } from '../logger'

describe('createLogger', () => {
  it('creates a logger with info, error, warn, and debug methods', () => {
    const log = createLogger('test-module')

    expect(typeof log.info).toBe('function')
    expect(typeof log.error).toBe('function')
    expect(typeof log.warn).toBe('function')
    expect(typeof log.debug).toBe('function')
  })

  it('includes the module name in the logger bindings', () => {
    const log = createLogger('my-module')
    const bindings = log.bindings()

    expect(bindings.module).toBe('my-module')
  })
})

describe('createRequestLogger', () => {
  it('creates a logger with a requestId property', () => {
    const log = createRequestLogger('test-module')

    expect(typeof log.requestId).toBe('string')
    expect(log.requestId.length).toBeGreaterThan(0)
  })

  it('uses the provided requestId when given', () => {
    const log = createRequestLogger('test-module', { requestId: 'custom-id-123' })

    expect(log.requestId).toBe('custom-id-123')
  })

  it('generates a random requestId when none is provided', () => {
    const log1 = createRequestLogger('test-module')
    const log2 = createRequestLogger('test-module')

    expect(log1.requestId).not.toBe(log2.requestId)
  })

  it('includes userId in bindings when provided', () => {
    const log = createRequestLogger('test-module', { userId: 'user-456' })
    const bindings = log.bindings()

    expect(bindings.userId).toBe('user-456')
  })

  it('does not include userId in bindings when not provided', () => {
    const log = createRequestLogger('test-module')
    const bindings = log.bindings()

    expect(bindings.userId).toBeUndefined()
  })

  it('has info, error, warn, and debug methods', () => {
    const log = createRequestLogger('test-module')

    expect(typeof log.info).toBe('function')
    expect(typeof log.error).toBe('function')
    expect(typeof log.warn).toBe('function')
    expect(typeof log.debug).toBe('function')
  })
})
