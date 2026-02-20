import pino from 'pino'

const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level(label) {
      return { level: label }
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})

export function createLogger(module: string): pino.Logger {
  return rootLogger.child({ module })
}

export function createRequestLogger(
  module: string,
  options?: { userId?: string; requestId?: string }
): pino.Logger & { requestId: string } {
  const requestId = options?.requestId ?? crypto.randomUUID()
  const child = rootLogger.child({
    module,
    requestId,
    ...(options?.userId ? { userId: options.userId } : {}),
  })
  return Object.assign(child, { requestId })
}
