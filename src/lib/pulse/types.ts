export type PulseSignalType =
  | 'duplicate_suspect'
  | 'missing_essential'
  | 'trend_shift'
  | 'income_confidence'

export type PulseSurface = 'log_review' | 'overview'

export interface PulseAction {
  key: string
  label: string
}

export interface PulseSignal {
  type: PulseSignalType
  surface: PulseSurface
  key: string
  priority: number
  title: string
  message: string
  actions: PulseAction[]
}

export interface DuplicateCandidate {
  id: string
  label: string
  amount: number
  date: string
}
