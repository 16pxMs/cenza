export type PulseSignalType =
  | 'missing_essential'
  | 'trend_shift'

export type PulseSurface = 'overview'

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