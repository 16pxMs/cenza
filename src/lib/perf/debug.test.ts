import { afterEach, describe, expect, it, vi } from 'vitest'
import { logPerfSpan, timePerf } from './debug'

describe('perf debug helper', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('does not log unless PERF_DEBUG is enabled', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    logPerfSpan('sms-import.parse', 'total', Date.now(), { rowCount: 1 })

    expect(info).not.toHaveBeenCalled()
  })

  it('logs safe structured metadata when PERF_DEBUG is enabled', () => {
    vi.stubEnv('PERF_DEBUG', 'true')
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    logPerfSpan('sms-import.parse', 'total', Date.now(), {
      rowCount: 1,
      fastPath: true,
      unsafe: { nested: true } as any,
    })

    expect(info).toHaveBeenCalledWith('[perf]', expect.objectContaining({
      flow: 'sms-import.parse',
      step: 'total',
      durationMs: expect.any(Number),
      rowCount: 1,
      fastPath: true,
    }))
    expect(info.mock.calls[0]?.[1]).not.toHaveProperty('unsafe')
  })

  it('times async work only when debug logging is enabled', async () => {
    vi.stubEnv('PERF_DEBUG', 'true')
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    await expect(timePerf('sms-import.save', 'duplicate-check', async () => 'ok', {
      rowCount: 2,
    })).resolves.toBe('ok')

    expect(info).toHaveBeenCalledWith('[perf]', expect.objectContaining({
      flow: 'sms-import.save',
      step: 'duplicate-check',
      rowCount: 2,
    }))
  })
})

