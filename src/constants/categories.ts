import type { Frequency } from '@/types/database'

// ─── Fixed expense categories ─────────────────────────────────────────────────

export interface ExpenseCategory {
  key:         string
  label:       string
  group:       string
  defaultFreq: Frequency
  tip:         string | null
  // Benchmark thresholds — % of income. null = no benchmark for this category
  benchmark:   { low: number; high: number; label: string } | null
}

export const ALL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  // Housing
  {
    key: 'rent', label: 'Rent / Mortgage', group: 'Housing', defaultFreq: 'monthly',
    tip: 'Include your full monthly payment. If you pay utilities separately, add those below.',
    benchmark: { low: 30, high: 40, label: 'rent' },
  },
  {
    key: 'electricity', label: 'Electricity', group: 'Housing', defaultFreq: 'monthly',
    tip: 'Use your average monthly bill. It can vary by season so a rough average is fine.',
    benchmark: { low: 5, high: 10, label: 'electricity' },
  },
  {
    key: 'water', label: 'Water', group: 'Housing', defaultFreq: 'monthly',
    tip: null,
    benchmark: { low: 3, high: 6, label: 'water' },
  },
  {
    key: 'gas', label: 'Gas / Cooking fuel', group: 'Housing', defaultFreq: 'monthly',
    tip: null,
    benchmark: null,
  },
  // Utilities
  {
    key: 'internet', label: 'Internet', group: 'Utilities', defaultFreq: 'monthly',
    tip: null,
    benchmark: { low: 3, high: 6, label: 'internet' },
  },
  {
    key: 'phone', label: 'Phone', group: 'Utilities', defaultFreq: 'monthly',
    tip: 'Include your monthly plan or airtime budget.',
    benchmark: { low: 3, high: 6, label: 'phone' },
  },
  // Household
  {
    key: 'housekeeping', label: 'House help', group: 'Household', defaultFreq: 'monthly',
    tip: null,
    benchmark: null,
  },
  // Family
  {
    key: 'blackTax', label: 'Family support', group: 'Family', defaultFreq: 'monthly',
    tip: 'Money you regularly send home or contribute to family expenses.',
    benchmark: { low: 10, high: 20, label: 'family support' },
  },
  {
    key: 'schoolFees', label: 'School fees', group: 'Family', defaultFreq: 'quarterly',
    tip: 'If paid termly, enter the term amount and select every 3 months.',
    benchmark: { low: 10, high: 20, label: 'school fees' },
  },
  {
    key: 'childcare', label: 'Childcare', group: 'Family', defaultFreq: 'monthly',
    tip: null,
    benchmark: null,
  },
]

// ─── Variable spending categories ─────────────────────────────────────────────

export interface VariableCategory {
  key:   string
  label: string
  icon:  string
  group: string
}

export const ALL_VARIABLE_CATEGORIES: VariableCategory[] = [
  // Food
  { key: 'groceries',     label: 'Groceries',       icon: '🛒', group: 'Food' },
  { key: 'eatingOut',     label: 'Eating out',       icon: '🍽️', group: 'Food' },
  { key: 'coffee',        label: 'Coffee / Drinks',  icon: '☕', group: 'Food' },
  // Getting around
  { key: 'transport',     label: 'Transport',        icon: '🚌', group: 'Getting around' },
  { key: 'fuel',          label: 'Fuel',             icon: '⛽', group: 'Getting around' },
  { key: 'parking',       label: 'Parking',          icon: '🅿️', group: 'Getting around' },
  // Lifestyle
  { key: 'clothing',      label: 'Clothing',         icon: '👗', group: 'Lifestyle' },
  { key: 'personal',      label: 'Personal care',    icon: '💆', group: 'Lifestyle' },
  { key: 'entertainment', label: 'Entertainment',    icon: '🎬', group: 'Lifestyle' },
  { key: 'electronics',   label: 'Electronics',      icon: '💻', group: 'Lifestyle' },
  { key: 'homeGoods',     label: 'Home goods',       icon: '🛋️', group: 'Lifestyle' },
  // Wellbeing
  { key: 'health',        label: 'Health / Medical', icon: '💊', group: 'Wellbeing' },
  { key: 'fitness',       label: 'Fitness',          icon: '🏃', group: 'Wellbeing' },
  { key: 'education',     label: 'Learning',         icon: '📚', group: 'Wellbeing' },
  // Others
  { key: 'gifts',         label: 'Gifts',            icon: '🎁', group: 'Others' },
  { key: 'travel',        label: 'Travel',           icon: '✈️', group: 'Others' },
  { key: 'charity',       label: 'Giving / Tithe',   icon: '🤲', group: 'Others' },
  { key: 'kids',          label: 'Kids',             icon: '🧒', group: 'Others' },
  { key: 'pets',          label: 'Pets',             icon: '🐾', group: 'Others' },
  { key: 'misc',          label: 'Miscellaneous',    icon: '📦', group: 'Others' },
]

// Default pre-selected spending categories
export const DEFAULT_SPENDING_KEYS = ['groceries', 'eatingOut', 'transport']

// ─── Subscription categories ──────────────────────────────────────────────────

export interface SubscriptionCategory {
  key:      string
  label:    string
  icon:     string
  examples: string[]
  hint:     string
}

export const SUBSCRIPTION_CATEGORIES: SubscriptionCategory[] = [
  {
    key: 'streaming', label: 'Streaming', icon: '📺',
    examples: ['Netflix', 'Showmax', 'Disney+', 'YouTube Premium'],
    hint: 'Check your bank statement for monthly charges from streaming services.',
  },
  {
    key: 'music', label: 'Music', icon: '🎵',
    examples: ['Spotify', 'Apple Music', 'Boomplay', 'Audiomack Premium'],
    hint: 'Most music apps charge monthly. Check your app store subscriptions.',
  },
  {
    key: 'fitness', label: 'Fitness', icon: '🏋️',
    examples: ['Gym membership', 'Freeletics', 'Nike Training'],
    hint: 'Include gym memberships and any fitness app subscriptions.',
  },
  {
    key: 'cloud', label: 'Cloud storage', icon: '☁️',
    examples: ['iCloud', 'Google One', 'Dropbox', 'OneDrive'],
    hint: 'Check Settings on your phone under subscriptions or Apple / Google accounts.',
  },
  {
    key: 'software', label: 'Software', icon: '💻',
    examples: ['Adobe', 'Microsoft 365', 'Canva Pro', 'Notion'],
    hint: 'Work tools often charge annually. Check your email for renewal receipts.',
  },
  {
    key: 'news', label: 'News / Reading', icon: '📰',
    examples: ['The Economist', 'Medium', 'Substack'],
    hint: 'Check your email for billing receipts from publications.',
  },
  {
    key: 'games', label: 'Gaming', icon: '🎮',
    examples: ['Xbox Game Pass', 'PlayStation Plus', 'in-app purchases'],
    hint: 'Check your phone or console store for active subscriptions.',
  },
  {
    key: 'dating', label: 'Dating apps', icon: '❤️',
    examples: ['Tinder Gold', 'Bumble Premium', 'Hinge+'],
    hint: 'Check your app store subscription list.',
  },
  {
    key: 'other', label: 'Other', icon: '📦',
    examples: ['VPN', 'Password manager', 'Domain / hosting', 'Anything else'],
    hint: 'Scan your last bank statement for any recurring monthly charges.',
  },
]

// ─── Frequency helpers ────────────────────────────────────────────────────────

export const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'monthly',   label: 'Every month' },
  { value: 'quarterly', label: 'Every 3 months' },
  { value: 'biannual',  label: 'Every 6 months' },
  { value: 'yearly',    label: 'Once a year' },
  { value: 'weekly',    label: 'Every week' },
]

export function toMonthlyEquivalent(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case 'monthly':   return amount
    case 'quarterly': return amount / 3
    case 'biannual':  return amount / 6
    case 'yearly':    return amount / 12
    case 'weekly':    return amount * 52 / 12
  }
}
