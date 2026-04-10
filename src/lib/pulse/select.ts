import type { PulseSignal } from './types'

export function selectTopPulseSignal(signals: Array<PulseSignal | null | undefined>): PulseSignal | null {
  const filtered = signals.filter(Boolean) as PulseSignal[]
  if (filtered.length === 0) return null
  return filtered.sort((a, b) => b.priority - a.priority)[0] ?? null
}
