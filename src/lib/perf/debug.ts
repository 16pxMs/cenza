type PerfMetaValue = string | number | boolean | null | undefined
type PerfMeta = Record<string, PerfMetaValue>

function isPerfDebugEnabled() {
  return process.env.PERF_DEBUG === 'true'
}

function safeMeta(meta: PerfMeta = {}) {
  return Object.fromEntries(
    Object.entries(meta).filter(([, value]) => {
      const type = typeof value
      return value == null || type === 'string' || type === 'number' || type === 'boolean'
    })
  )
}

export function logPerfSpan(
  flow: string,
  step: string,
  startedAt: number,
  meta?: PerfMeta
) {
  if (!isPerfDebugEnabled()) return
  console.info('[perf]', {
    flow,
    step,
    durationMs: Date.now() - startedAt,
    ...safeMeta(meta),
  })
}

export async function timePerf<T>(
  flow: string,
  step: string,
  work: () => Promise<T>,
  meta?: PerfMeta
): Promise<T> {
  const startedAt = Date.now()
  try {
    return await work()
  } finally {
    logPerfSpan(flow, step, startedAt, meta)
  }
}

