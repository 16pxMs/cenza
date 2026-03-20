import type { GoalId } from '@/types/database'
import { T } from './tokens'

export interface GoalMeta {
  id:          GoalId
  label:       string
  icon:        string
  description: string
  tip:         string
  light:       string
  border:      string
  dark:        string
}

export const GOAL_META: Record<GoalId, GoalMeta> = {
  emergency: {
    id:          'emergency',
    label:       'Emergency Fund',
    icon:        '🛡️',
    description: 'How much do you want in your emergency fund? A common target is 3 to 6 months of expenses.',
    tip:         'Keep your emergency fund in an account you cannot easily dip into. A money market fund works well — better returns than a current account and just enough friction to protect you from impulse withdrawals. The goal is accessible when you truly need it, but not instant.',
    light:       '#F0FDF4',
    border:      '#BBF7D0',
    dark:        T.greenDark,
  },
  car: {
    id:          'car',
    label:       'Car Fund',
    icon:        '🚗',
    description: 'What is your target for buying or maintaining a car?',
    tip:         'Set the full amount you are saving towards. The app will tell you how long it will take based on what you put aside each month.',
    light:       '#FEF3C7',
    border:      '#FDE68A',
    dark:        T.amberDark,
  },
  travel: {
    id:          'travel',
    label:       'Travel Buffer',
    icon:        '✈️',
    description: 'How much do you want to set aside for travel?',
    tip:         'Even a small monthly amount adds up. Setting a target helps you know when you can actually book.',
    light:       '#EFF6FF',
    border:      '#BFDBFE',
    dark:        '#1E40AF',
  },
  home: {
    id:          'home',
    label:       'Home Deposit',
    icon:        '🏠',
    description: 'How much are you saving towards a home?',
    tip:         'A deposit is usually 10 to 20% of the property value. Knowing your target makes the timeline real.',
    light:       '#FFF7ED',
    border:      '#FED7AA',
    dark:        '#9A3412',
  },
  education: {
    id:          'education',
    label:       'Education Fund',
    icon:        '🎓',
    description: 'How much do you want to save for education?',
    tip:         'Whether for yourself or someone else, setting a target turns an aspiration into a plan.',
    light:       '#F5F3FF',
    border:      '#DDD6FE',
    dark:        '#5B21B6',
  },
  business: {
    id:          'business',
    label:       'Business Capital',
    icon:        '💼',
    description: 'What amount do you need to start or grow your business?',
    tip:         'This could be start-up costs, stock, or equipment. A specific number makes it easier to plan.',
    light:       '#ECFDF5',
    border:      '#A7F3D0',
    dark:        '#065F46',
  },
  family: {
    id:          'family',
    label:       'Family Fund',
    icon:        '👨‍👩‍👧',
    description: 'How much do you want to set aside for family needs?',
    tip:         'This could cover school fees, medical costs, or supporting relatives. Naming the amount helps you plan for it.',
    light:       '#FFF1F2',
    border:      '#FECACA',
    dark:        T.redDark,
  },
  other: {
    id:          'other',
    label:       'Other Goal',
    icon:        '🎯',
    description: 'What are you saving towards?',
    tip:         'Any goal with a number attached to it is a goal you can actually reach.',
    light:       T.brand + '44',
    border:      T.brandMid,
    dark:        T.brandDark,
  },
}

export const GOAL_OPTIONS = Object.values(GOAL_META)
