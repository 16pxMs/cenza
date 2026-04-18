// ─────────────────────────────────────────────────────────────────────────────
// Database types — mirrors Supabase schema exactly
// ─────────────────────────────────────────────────────────────────────────────

export type GoalId = 'emergency' | 'car' | 'travel' | 'home' | 'education' | 'business' | 'family' | 'other'
export type Frequency = 'monthly' | 'quarterly' | 'biannual' | 'yearly' | 'weekly'
export type CategoryType = 'everyday' | 'fixed' | 'subscription' | 'goal' | 'debt' | 'other'
export type SubscriptionStatus = 'yes_known' | 'yes_unknown'
export type DebtDirection = 'owed_by_me' | 'owed_to_me'
export type DebtStatus = 'active' | 'cleared' | 'cancelled'
export type DebtKind = 'standard' | 'financing'
export type DebtTransactionEntryType =
  | 'principal_increase'
  | 'payment_in'
  | 'payment_out'
  | 'adjustment_increase'
  | 'adjustment_decrease'

// ─── Value-object types ───────────────────────────────────────────────────────

export interface PaySchedule {
  type: 'monthly' | 'twice_monthly'
  days: number[]  // sorted ascending; 1 element for monthly, 2 for twice_monthly
}

// ─── Table row types ──────────────────────────────────────────────────────────

export interface Cycle {
  user_id:    string
  start_date: string  // 'YYYY-MM-DD' — composite PK with user_id; also used as cycle_id in other tables
  end_date:   string  // 'YYYY-MM-DD'
  is_current: boolean
  created_at: string
}


export interface UserProfile {
  id:                  string
  name:                string
  currency:            string
  pay_schedule_type:   'monthly' | 'twice_monthly' | null
  pay_schedule_days:   number[] | null
  income_type:         'salaried' | 'variable' | null
  goals:               GoalId[]
  onboarding_complete: boolean
  pin_hash:            string | null
  created_at:          string
  updated_at:          string
}

export interface ExtraIncomeItem {
  id: number
  label: string
  amount: number
}

export interface IncomeEntry {
  id:                    string
  user_id:               string
  cycle_id:              string
  salary:                number
  extra_income:          ExtraIncomeItem[]
  total:                 number
  cycle_start_mode:      'full_month' | 'mid_month'
  opening_balance:       number | null
  received:              number | null
  received_confirmed_at: string | null
  created_at:            string
  updated_at:            string
}

export interface FixedExpense {
  id:                   string
  user_id:              string
  cycle_id:             string
  entries:              unknown[] | null
  total_monthly:        number | null
  last_confirmed_month: string | null
  created_at:           string
  updated_at:           string
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

export interface SpendingBudget {
  id:           string
  user_id:      string
  cycle_id:     string
  categories:   unknown[] | null
  total_budget: number | null
  source:       string | null
  created_at:   string
  updated_at:   string
}

export interface Subscription {
  id:                   string
  user_id:              string
  key:                  string
  label:                string
  status:               SubscriptionStatus
  amount:               number | null
  needs_check:          boolean
  last_confirmed_month: string | null
  created_at:           string
  updated_at:           string
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
  id:             string
  user_id:        string
  date:           string   // 'YYYY-MM-DD'
  cycle_id:       string
  category_type:  CategoryType
  category_key:   string
  category_label: string
  amount:         number
  note:           string | null
  created_at:     string
}

export interface ItemDictionary {
  id:              string
  user_id:         string
  name_normalized: string
  label:           string
  category_key:    string
  category_type:   CategoryType
  usage_count:     number
  created_at:      string
  updated_at:      string
}

export interface Debt {
  id: string
  user_id: string
  name: string
  normalized_name: string
  direction: DebtDirection
  currency: string
  debt_kind: DebtKind
  current_balance: number
  status: DebtStatus
  financing_total_cost: number | null
  financing_target_date: string | null
  financing_principal_tx_id: string | null
  standard_due_date: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export interface DebtTransaction {
  id: string
  user_id: string
  debt_id: string
  entry_type: DebtTransactionEntryType
  amount: number
  currency: string
  transaction_date: string
  note: string | null
  linked_transaction_id: string | null
  created_at: string
  updated_at: string
}

// ─── Supabase database shape (for typed client) ───────────────────────────────

export interface Database {
  public: {
    Tables: {
      user_profiles:       { Row: UserProfile;       Insert: Omit<UserProfile, 'created_at' | 'updated_at'>; Update: Partial<UserProfile> }
      cycles:              { Row: Cycle;             Insert: Omit<Cycle, 'created_at' | 'is_current'>; Update: Partial<Cycle> }
      income_entries:      { Row: IncomeEntry;        Insert: Omit<IncomeEntry, 'id' | 'total' | 'created_at' | 'updated_at'>; Update: Partial<IncomeEntry> }
      fixed_expenses:      { Row: FixedExpense;       Insert: Omit<FixedExpense, 'id' | 'created_at' | 'updated_at'>; Update: Partial<FixedExpense> }
      spending_categories: { Row: SpendingCategory;   Insert: Omit<SpendingCategory, 'id' | 'created_at' | 'updated_at'>; Update: Partial<SpendingCategory> }
      spending_budgets:    { Row: SpendingBudget;     Insert: Omit<SpendingBudget, 'id' | 'created_at' | 'updated_at'>; Update: Partial<SpendingBudget> }
      subscriptions:       { Row: Subscription;       Insert: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Subscription> }
      goal_targets:        { Row: GoalTarget;         Insert: Omit<GoalTarget, 'id' | 'created_at' | 'updated_at'>; Update: Partial<GoalTarget> }
      transactions:        { Row: Transaction;        Insert: Omit<Transaction, 'id' | 'created_at'>; Update: Partial<Transaction> }
      item_dictionary:     { Row: ItemDictionary;     Insert: Omit<ItemDictionary, 'id' | 'created_at' | 'updated_at'>; Update: Partial<ItemDictionary> }
      debts:               { Row: Debt;               Insert: Omit<Debt, 'id' | 'created_at' | 'updated_at' | 'current_balance' | 'status'>; Update: Partial<Debt> }
      debt_transactions:   { Row: DebtTransaction;    Insert: Omit<DebtTransaction, 'id' | 'created_at' | 'updated_at'>; Update: Partial<DebtTransaction> }
    }
  }
}
