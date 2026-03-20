// ─────────────────────────────────────────────────────────────────────────────
// Database types — mirrors Supabase schema exactly
// ─────────────────────────────────────────────────────────────────────────────

export type GoalId = 'emergency' | 'car' | 'travel' | 'home' | 'education' | 'business' | 'family' | 'other'
export type Frequency = 'monthly' | 'quarterly' | 'biannual' | 'yearly' | 'weekly'
export type CategoryType = 'variable' | 'fixed' | 'subscription' | 'goal' | 'debt' | 'other'
export type SubscriptionStatus = 'yes_known' | 'yes_unknown'

// ─── Table row types ──────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  name: string
  currency: string
  month_start: 'first' | 'custom'
  custom_day: number | null
  pay_day: number | null      // day of month income usually arrives (1–31)
  income_type: 'salaried' | 'variable' | null  // how the user earns — drives pay day and cycle logic
  goals: GoalId[]
  onboarding_complete: boolean
  created_at: string
  updated_at: string
}

export interface ExtraIncomeItem {
  id: number
  label: string
  amount: number
}

export interface IncomeEntry {
  id: string
  user_id: string
  month: string                        // 'YYYY-MM'
  salary: number
  extra_income: ExtraIncomeItem[]
  total: number                        // generated column
  received: number | null              // actual income received this month
  received_confirmed_at: string | null // when the user confirmed it
  created_at: string
  updated_at: string
}

export interface FixedExpense {
  id: string
  user_id: string
  key: string | null
  amount: number | null
  frequency: Frequency | null
  monthly_equivalent: number | null
  month: string | null
  entries: any[] | null
  total_monthly: number | null
  created_at: string
  updated_at: string
}

export interface SpendingCategory {
  id: string
  user_id: string
  key: string
  known: boolean
  estimated_amount: number | null
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  key: string
  label: string
  status: SubscriptionStatus
  amount: number | null
  needs_check: boolean
  created_at: string
  updated_at: string
}

export interface GoalTarget {
  id: string
  user_id: string
  goal_id: GoalId
  amount: number | null
  destination: string | null   // travel goal only
  added_at: string             // when this goal instance was (re)activated
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  date: string              // 'YYYY-MM-DD'
  month: string             // 'YYYY-MM'
  category_type: CategoryType
  category_key: string
  category_label: string
  amount: number
  note: string | null
  created_at: string
}

// ─── Supabase database shape (for typed client) ───────────────────────────────

export interface Database {
  public: {
    Tables: {
      user_profiles:       { Row: UserProfile;       Insert: Omit<UserProfile, 'created_at' | 'updated_at'>; Update: Partial<UserProfile> }
      income_entries:      { Row: IncomeEntry;        Insert: Omit<IncomeEntry, 'id' | 'total' | 'created_at' | 'updated_at'>; Update: Partial<IncomeEntry> }
      fixed_expenses:      { Row: FixedExpense;       Insert: Omit<FixedExpense, 'id' | 'created_at' | 'updated_at'>; Update: Partial<FixedExpense> }
      spending_categories: { Row: SpendingCategory;   Insert: Omit<SpendingCategory, 'id' | 'created_at' | 'updated_at'>; Update: Partial<SpendingCategory> }
      subscriptions:       { Row: Subscription;       Insert: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Subscription> }
      goal_targets:        { Row: GoalTarget;         Insert: Omit<GoalTarget, 'id' | 'created_at' | 'updated_at'>; Update: Partial<GoalTarget> }
      transactions:        { Row: Transaction;        Insert: Omit<Transaction, 'id' | 'created_at'>; Update: Partial<Transaction> }
    }
  }
}
