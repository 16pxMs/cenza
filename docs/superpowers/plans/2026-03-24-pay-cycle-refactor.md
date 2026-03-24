# Pay-Cycle Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all `YYYY-MM` calendar-month logic with a `cycle_id`-based pay-cycle system that supports monthly and twice-monthly pay schedules, while keeping the UI human-readable.

**Architecture:** `pay_schedule_type` + `pay_schedule_days` columns on `user_profiles` define each user's pay rhythm. A `cycles` table stores concrete date-range rows, identified by `(user_id, start_date)` as a composite primary key. The `cycle_id` stored in all budget tables is a `TEXT` string equal to the cycle's `start_date` in `YYYY-MM-DD` format — no UUID lookup needed. A pure TypeScript engine in `src/lib/cycles.ts` handles all date math. All queries replace `.eq('month', currentMonth)` with `.eq('cycle_id', cycleId)`. The `month` column is kept alongside `cycle_id` temporarily during migration, then removed in cleanup.

**Tech Stack:** Next.js 15, TypeScript, Supabase Postgres (SQL migrations run in Supabase dashboard), Vitest

**Spec:** User-provided spec in conversation (2026-03-24)

---

## Design decisions (locked in this plan)

- `pay_schedule` stored as two columns on `user_profiles` (not a separate table) — simpler, consistent with existing pattern, one less join
- `cycles` table uses `(user_id, start_date)` unique constraint — allows idempotent upserts
- `getOrCreateCycle()` upserts lazily on each page load — no background job needed
- For twice_monthly `[d1, d2]`: Cycle A = `d1 → d2-1`, Cycle B = `d2 → end-of-month` — both contained within a calendar month. UI must constrain d1 ≤ 3 to avoid uncovered dates.
- `is_current` flag on cycles table is set only for the cycle returned by `getCurrentCycle()`

---

## File Map

| Path | Action | Responsibility |
|------|--------|----------------|
| `src/lib/cycles.ts` | **Create** | Pure cycle engine — all date math lives here |
| `src/lib/cycles.test.ts` | **Create** | Comprehensive tests for cycles.ts |
| `src/lib/supabase/cycles-db.ts` | **Create** | `getOrCreateCycle()` — DB upsert wrapper |
| `src/types/database.ts` | **Modify** | Add `PaySchedule`, `Cycle` types; update `UserProfile`; add `cycle_id` to table rows |
| `src/lib/context/UserContext.tsx` | **Modify** | Expose `paySchedule` (derived from profile); remove `pay_day` |
| `src/app/auth/callback/route.ts` | **Modify** | Remove `month_start`, `custom_day` from profile insert |
| `src/app/(app)/app/page.tsx` | **Modify** | Replace `currentMonth` + all `.eq('month',…)` with `cycleId` |
| `src/app/(app)/log/new/NewExpenseClient.tsx` | **Modify** | Replace `month:` in transaction inserts with `cycle_id:` |
| `src/app/(app)/log/page.tsx` | **Modify** | Replace `currentMonth` with `cycleId` |
| `src/app/(app)/income/page.tsx` | **Modify** | Replace `currentMonth` with `cycleId`; update save/upsert conflict keys |
| `src/app/(app)/settings/page.tsx` | **Modify** | Replace `pay_day` UI with `pay_schedule` picker |
| `src/app/(app)/history/page.tsx` | **Modify** | Replace month filter with cycle_id filter |
| `src/app/(app)/history/[key]/page.tsx` | **Modify** | Same |
| `src/app/(app)/goals/page.tsx` | **Modify** | Replace month filter if present |
| `src/app/(app)/log/first/page.tsx` | **Modify** | Replace month on transaction insert |
| `src/components/flows/overview/CarryForwardScreen.tsx` | **Modify** | Replace `prevMonth` with `prevCycle` label |
| `src/components/flows/overview/MonthRecapScreen.tsx` | **Modify** | Replace month label with cycle label |
| `src/components/flows/log/ReceivedIncomeSheet.tsx` | **Modify** | Remove pay-day capture step (schedule comes from profile now) |
| `src/components/flows/log/CommittedExpenseConfirmSheet.tsx` | **Modify** | `last_confirmed_month` → `last_confirmed_cycle_id` |
| `src/components/flows/log/SubscriptionConfirmSheet.tsx` | **Modify** | Update `currentMonth` prop to accept cycle label string; fix display logic |
| `src/app/(app)/plan/page.tsx` | **Modify** | Replace month filter with cycle_id filter (3 queries) |
| `src/lib/finance.ts` | **Modify** | Remove `getPrevMonth()` |

---

## Task 1: Schema changes (SQL — run in Supabase dashboard)

**Files:** SQL only (no TypeScript in this task)

This is the only task that requires manual action in the Supabase dashboard. All SQL must be run before any code changes are deployed.

- [ ] **Step 1: Add pay_schedule fields to user_profiles**

```sql
-- Add pay schedule fields (keep pay_day temporarily for migration)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS pay_schedule_type TEXT CHECK (pay_schedule_type IN ('monthly', 'twice_monthly')),
  ADD COLUMN IF NOT EXISTS pay_schedule_days INTEGER[];

-- Backfill from existing pay_day
UPDATE user_profiles
SET
  pay_schedule_type = 'monthly',
  pay_schedule_days = ARRAY[pay_day]
WHERE pay_day IS NOT NULL;

-- Users without a pay_day default to monthly on the 1st
UPDATE user_profiles
SET
  pay_schedule_type = 'monthly',
  pay_schedule_days = ARRAY[1]
WHERE pay_day IS NULL;
```

- [ ] **Step 2: Create cycles table**

```sql
-- cycle_id in all other tables stores start_date as TEXT ('YYYY-MM-DD').
-- No UUID; the composite (user_id, start_date) IS the identity.
CREATE TABLE IF NOT EXISTS cycles (
  user_id    UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, start_date)
);

CREATE INDEX IF NOT EXISTS cycles_user_current ON cycles(user_id, is_current);
```

- [ ] **Step 3: Add cycle_id columns (non-breaking — nullable to start)**

```sql
-- cycle_id stores the TEXT start_date string ('YYYY-MM-DD'), matching cycles.start_date.
-- No FK constraint (composite PK can't be referenced by a single TEXT column).
ALTER TABLE income_entries
  ADD COLUMN IF NOT EXISTS cycle_id TEXT;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS cycle_id TEXT;
CREATE INDEX IF NOT EXISTS transactions_cycle ON transactions(cycle_id);

ALTER TABLE fixed_expenses
  ADD COLUMN IF NOT EXISTS cycle_id TEXT;

ALTER TABLE spending_budgets
  ADD COLUMN IF NOT EXISTS cycle_id TEXT;
```

- [ ] **Step 4: Add last_confirmed_cycle_id to subscriptions and fixed_expenses**

```sql
-- last_confirmed_cycle_id stores TEXT start_date string (same format as cycle_id)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS last_confirmed_cycle_id TEXT;

ALTER TABLE fixed_expenses
  ADD COLUMN IF NOT EXISTS last_confirmed_cycle_id TEXT;
```

- [ ] **Step 5: Update upsert conflict keys**

The current `income_entries` and other tables use `(user_id, month)` as the upsert conflict key. After migration, the key becomes `(user_id, cycle_id)`. Add unique constraint now (nullable `TEXT` column — constraint only fires on non-null values in Postgres):

```sql
ALTER TABLE income_entries
  ADD CONSTRAINT income_entries_user_cycle UNIQUE (user_id, cycle_id);

ALTER TABLE spending_budgets
  ADD CONSTRAINT spending_budgets_user_cycle UNIQUE (user_id, cycle_id);

ALTER TABLE fixed_expenses
  ADD CONSTRAINT fixed_expenses_user_cycle UNIQUE (user_id, cycle_id);
```

- [ ] **Step 6: Verify in Supabase table editor**

Check that:
- `user_profiles` has `pay_schedule_type` and `pay_schedule_days` with values for all existing users
- `cycles` table exists and is empty
- `income_entries` has `cycle_id` column (nullable)
- `transactions` has `cycle_id` column (nullable)

---

## Task 2: TypeScript types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add PaySchedule type and update UserProfile**

Replace the current `UserProfile` interface and add new types:

```ts
// New types at the top of src/types/database.ts

export interface PaySchedule {
  type: 'monthly' | 'twice_monthly'
  days: number[]  // sorted ascending; 1 element for monthly, 2 for twice_monthly
}

export interface Cycle {
  user_id:    string
  start_date: string  // 'YYYY-MM-DD' — composite PK with user_id; also used as cycle_id in other tables
  end_date:   string  // 'YYYY-MM-DD'
  is_current: boolean
  created_at: string
}
```

Update `UserProfile`:

```ts
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
  // Deprecated — remove in cleanup task (Task 11)
  pay_day:             number | null
  month_start:         'first' | 'custom' | null
  custom_day:          number | null
}
```

Update `IncomeEntry`:

```ts
export interface IncomeEntry {
  id:                    string
  user_id:               string
  cycle_id:              string | null  // null during migration period
  month:                 string         // 'YYYY-MM' — kept during migration
  salary:                number
  extra_income:          ExtraIncomeItem[]
  total:                 number
  received:              number | null
  received_confirmed_at: string | null
  created_at:            string
  updated_at:            string
}
```

Update `Transaction`:

```ts
export interface Transaction {
  id:             string
  user_id:        string
  date:           string   // 'YYYY-MM-DD'
  cycle_id:       string | null
  month:          string   // 'YYYY-MM' — kept during migration
  category_type:  CategoryType
  category_key:   string
  category_label: string
  amount:         number
  note:           string | null
  created_at:     string
}
```

Add `SpendingBudget` interface (this type is currently missing from database.ts):

```ts
export interface SpendingBudget {
  id:         string
  user_id:    string
  cycle_id:   string | null  // null during migration
  month:      string          // 'YYYY-MM' — kept during migration
  budgets:    Record<string, number>  // category_key → amount
  created_at: string
  updated_at: string
}
```

Update `Database` interface to include `cycles` and `spending_budgets` tables:

```ts
export interface Database {
  public: {
    Tables: {
      user_profiles:       { Row: UserProfile;       Insert: Omit<UserProfile, 'created_at' | 'updated_at'>; Update: Partial<UserProfile> }
      cycles:              { Row: Cycle;             Insert: Omit<Cycle, 'created_at'>; Update: Partial<Cycle> }
      income_entries:      { Row: IncomeEntry;        Insert: Omit<IncomeEntry, 'id' | 'total' | 'created_at' | 'updated_at'>; Update: Partial<IncomeEntry> }
      fixed_expenses:      { Row: FixedExpense;       Insert: Omit<FixedExpense, 'id' | 'created_at' | 'updated_at'>; Update: Partial<FixedExpense> }
      spending_categories: { Row: SpendingCategory;   Insert: Omit<SpendingCategory, 'id' | 'created_at' | 'updated_at'>; Update: Partial<SpendingCategory> }
      spending_budgets:    { Row: SpendingBudget;     Insert: Omit<SpendingBudget, 'id' | 'created_at' | 'updated_at'>; Update: Partial<SpendingBudget> }
      subscriptions:       { Row: Subscription;       Insert: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Subscription> }
      goal_targets:        { Row: GoalTarget;         Insert: Omit<GoalTarget, 'id' | 'created_at' | 'updated_at'>; Update: Partial<GoalTarget> }
      transactions:        { Row: Transaction;        Insert: Omit<Transaction, 'id' | 'created_at'>; Update: Partial<Transaction> }
    }
  }
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /path/to/worktree && npx tsc --noEmit 2>&1
```

Expected: errors only about `pay_day` refs that will be fixed in later tasks — not errors in `database.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add PaySchedule, Cycle types; extend IncomeEntry and Transaction with cycle_id"
```

---

## Task 3: Cycle engine — TDD

**Files:**
- Create: `src/lib/cycles.ts`
- Create: `src/lib/cycles.test.ts`

This is the most critical task. All cycle logic must live here. No date math anywhere else.

- [ ] **Step 1: Write the test file first**

Create `src/lib/cycles.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  clampDay,
  generateCycles,
  getCycleByDate,
  getCurrentCycle,
  formatCycleLabel,
  formatCycleMonthLabel,
} from './cycles'
import type { PaySchedule } from './cycles'

// ─── clampDay ─────────────────────────────────────────────────
describe('clampDay', () => {
  it('returns day unchanged when valid for month', () => {
    expect(clampDay(2026, 2, 15)).toBe(15)   // March 15
    expect(clampDay(2026, 0, 31)).toBe(31)   // Jan 31
  })

  it('clamps to last day of February (non-leap)', () => {
    expect(clampDay(2026, 1, 30)).toBe(28)   // Feb 30 → 28
    expect(clampDay(2026, 1, 31)).toBe(28)
    expect(clampDay(2026, 1, 29)).toBe(28)
  })

  it('clamps to 29 in leap year February', () => {
    expect(clampDay(2024, 1, 30)).toBe(29)   // 2024 is leap
    expect(clampDay(2024, 1, 31)).toBe(29)
  })

  it('clamps 31 in 30-day months', () => {
    expect(clampDay(2026, 3, 31)).toBe(30)   // April has 30 days
    expect(clampDay(2026, 5, 31)).toBe(30)   // June
    expect(clampDay(2026, 8, 31)).toBe(30)   // September
    expect(clampDay(2026, 10, 31)).toBe(30)  // November
  })
})

// ─── generateCycles (monthly) ─────────────────────────────────
describe('generateCycles — monthly', () => {
  const monthly14: PaySchedule = { type: 'monthly', days: [14] }

  it('generates a cycle starting on payday and ending day before next payday', () => {
    const from = new Date(2026, 2, 14) // Mar 14
    const to   = new Date(2026, 3, 13) // Apr 13
    const cycles = generateCycles(monthly14, from, to)
    expect(cycles).toHaveLength(1)
    expect(cycles[0].startDate).toEqual(new Date(2026, 2, 14))
    expect(cycles[0].endDate).toEqual(new Date(2026, 3, 13))
  })

  it('generates multiple cycles over a range', () => {
    const from = new Date(2026, 0, 14) // Jan 14
    const to   = new Date(2026, 3, 13) // Apr 13
    const cycles = generateCycles(monthly14, from, to)
    expect(cycles).toHaveLength(3)
    expect(cycles[0].startDate).toEqual(new Date(2026, 0, 14)) // Jan 14
    expect(cycles[0].endDate).toEqual(new Date(2026, 1, 13))   // Feb 13
    expect(cycles[1].startDate).toEqual(new Date(2026, 1, 14)) // Feb 14
    expect(cycles[2].startDate).toEqual(new Date(2026, 2, 14)) // Mar 14
    expect(cycles[2].endDate).toEqual(new Date(2026, 3, 13))   // Apr 13
  })

  it('clamps payday 31 in February — non-leap year', () => {
    const monthly31: PaySchedule = { type: 'monthly', days: [31] }
    const from = new Date(2026, 0, 31) // Jan 31
    const to   = new Date(2026, 2, 30) // Mar 30
    const cycles = generateCycles(monthly31, from, to)
    // Jan 31 → Feb 27, Feb 28 → Mar 30
    expect(cycles).toHaveLength(2)
    expect(cycles[0].startDate).toEqual(new Date(2026, 0, 31)) // Jan 31
    expect(cycles[0].endDate).toEqual(new Date(2026, 1, 27))   // Feb 27
    expect(cycles[1].startDate).toEqual(new Date(2026, 1, 28)) // Feb 28 (clamped from 31)
    expect(cycles[1].endDate).toEqual(new Date(2026, 2, 30))   // Mar 30
  })

  it('clamps payday 31 in February — leap year', () => {
    const monthly31: PaySchedule = { type: 'monthly', days: [31] }
    const from = new Date(2024, 0, 31) // Jan 31 (2024 is leap)
    const to   = new Date(2024, 2, 30)
    const cycles = generateCycles(monthly31, from, to)
    expect(cycles[0].endDate).toEqual(new Date(2024, 1, 28))   // Feb 28 (day before Feb 29)
    expect(cycles[1].startDate).toEqual(new Date(2024, 1, 29)) // Feb 29
  })

  it('handles year boundary', () => {
    const from = new Date(2025, 11, 14) // Dec 14
    const to   = new Date(2026, 1, 13)  // Feb 13 2026
    const cycles = generateCycles(monthly14, from, to)
    expect(cycles).toHaveLength(2)
    expect(cycles[0].startDate).toEqual(new Date(2025, 11, 14)) // Dec 14 2025
    expect(cycles[0].endDate).toEqual(new Date(2026, 0, 13))    // Jan 13 2026
    expect(cycles[1].startDate).toEqual(new Date(2026, 0, 14))  // Jan 14 2026
  })
})

// ─── generateCycles (twice_monthly) ───────────────────────────
describe('generateCycles — twice_monthly', () => {
  const twice115: PaySchedule = { type: 'twice_monthly', days: [1, 15] }

  it('generates two cycles per month: 1→14 and 15→end', () => {
    const from = new Date(2026, 2, 1)  // Mar 1
    const to   = new Date(2026, 2, 31) // Mar 31
    const cycles = generateCycles(twice115, from, to)
    expect(cycles).toHaveLength(2)
    expect(cycles[0].startDate).toEqual(new Date(2026, 2, 1))
    expect(cycles[0].endDate).toEqual(new Date(2026, 2, 14))
    expect(cycles[1].startDate).toEqual(new Date(2026, 2, 15))
    expect(cycles[1].endDate).toEqual(new Date(2026, 2, 31))
  })

  it('generates four cycles over two months', () => {
    const from = new Date(2026, 2, 1)  // Mar 1
    const to   = new Date(2026, 3, 30) // Apr 30
    const cycles = generateCycles(twice115, from, to)
    expect(cycles).toHaveLength(4)
  })

  it('clamps in February', () => {
    const from = new Date(2026, 1, 1)  // Feb 1
    const to   = new Date(2026, 1, 28) // Feb 28
    const cycles = generateCycles(twice115, from, to)
    expect(cycles).toHaveLength(2)
    expect(cycles[0].endDate).toEqual(new Date(2026, 1, 14))  // Feb 14
    expect(cycles[1].startDate).toEqual(new Date(2026, 1, 15))
    expect(cycles[1].endDate).toEqual(new Date(2026, 1, 28))  // Feb 28 (last day)
  })
})

// ─── getCycleByDate ────────────────────────────────────────────
describe('getCycleByDate', () => {
  const monthly14: PaySchedule = { type: 'monthly', days: [14] }
  const twice115:  PaySchedule = { type: 'twice_monthly', days: [1, 15] }

  it('returns the cycle containing the given date (monthly)', () => {
    const date  = new Date(2026, 2, 20) // Mar 20
    const cycle = getCycleByDate(date, monthly14)
    expect(cycle.startDate).toEqual(new Date(2026, 2, 14)) // Mar 14
    expect(cycle.endDate).toEqual(new Date(2026, 3, 13))   // Apr 13
  })

  it('returns the correct cycle when date is before payday (monthly)', () => {
    const date  = new Date(2026, 2, 5) // Mar 5 — before Mar 14
    const cycle = getCycleByDate(date, monthly14)
    expect(cycle.startDate).toEqual(new Date(2026, 1, 14)) // Feb 14
    expect(cycle.endDate).toEqual(new Date(2026, 2, 13))   // Mar 13
  })

  it('returns correct cycle for twice_monthly', () => {
    const dateA = new Date(2026, 2, 10) // Mar 10 → cycle A
    const cycleA = getCycleByDate(dateA, twice115)
    expect(cycleA.startDate).toEqual(new Date(2026, 2, 1))
    expect(cycleA.endDate).toEqual(new Date(2026, 2, 14))

    const dateB = new Date(2026, 2, 20) // Mar 20 → cycle B
    const cycleB = getCycleByDate(dateB, twice115)
    expect(cycleB.startDate).toEqual(new Date(2026, 2, 15))
    expect(cycleB.endDate).toEqual(new Date(2026, 2, 31))
  })

  it('returns cycle for date exactly on start boundary', () => {
    const date  = new Date(2026, 2, 14) // Exactly Mar 14
    const cycle = getCycleByDate(date, monthly14)
    expect(cycle.startDate).toEqual(new Date(2026, 2, 14))
  })

  it('returns cycle for date exactly on end boundary', () => {
    const date  = new Date(2026, 3, 13) // Exactly Apr 13 (end of Mar 14 cycle)
    const cycle = getCycleByDate(date, monthly14)
    expect(cycle.startDate).toEqual(new Date(2026, 2, 14))
    expect(cycle.endDate).toEqual(new Date(2026, 3, 13))
  })
})

// ─── formatCycleLabel ─────────────────────────────────────────
describe('formatCycleLabel', () => {
  it('formats a cross-month cycle', () => {
    const label = formatCycleLabel({
      startDate: new Date(2026, 2, 14),  // Mar 14
      endDate:   new Date(2026, 3, 13),  // Apr 13
    })
    expect(label).toBe('Mar 14 – Apr 13')
  })

  it('formats a within-month cycle', () => {
    const label = formatCycleLabel({
      startDate: new Date(2026, 2, 1),   // Mar 1
      endDate:   new Date(2026, 2, 14),  // Mar 14
    })
    expect(label).toBe('Mar 1 – Mar 14')
  })
})

// ─── formatCycleMonthLabel ────────────────────────────────────
describe('formatCycleMonthLabel', () => {
  it('shows two months when cycle spans a month boundary', () => {
    const label = formatCycleMonthLabel({
      startDate: new Date(2026, 2, 14),  // Mar
      endDate:   new Date(2026, 3, 13),  // Apr
    })
    expect(label).toBe('Mar–Apr 2026')
  })

  it('shows single month when cycle is within one month', () => {
    const label = formatCycleMonthLabel({
      startDate: new Date(2026, 2, 1),
      endDate:   new Date(2026, 2, 14),
    })
    expect(label).toBe('Mar 2026')
  })

  it('uses end year when cycle spans Dec → Jan', () => {
    const label = formatCycleMonthLabel({
      startDate: new Date(2025, 11, 14), // Dec 2025
      endDate:   new Date(2026, 0, 13),  // Jan 2026
    })
    expect(label).toBe('Dec–Jan 2026')
  })
})
```

- [ ] **Step 2: Run tests — confirm they all fail (no implementation yet)**

```bash
npx vitest run src/lib/cycles.test.ts 2>&1
```

Expected: FAIL — `Cannot find module './cycles'`

- [ ] **Step 3: Create `src/lib/cycles.ts`**

```ts
// ─────────────────────────────────────────────────────────────
// src/lib/cycles.ts — Pay-cycle engine
//
// All cycle date math lives here. No date logic anywhere else.
// Pure functions only — no imports, no side-effects.
// ─────────────────────────────────────────────────────────────

export interface PaySchedule {
  type: 'monthly' | 'twice_monthly'
  days: number[]  // sorted ascending
}

export interface CycleDates {
  startDate: Date
  endDate:   Date
}

// ─── Utilities ────────────────────────────────────────────────

/**
 * Clamp a day number to the last valid day of a given month.
 * @param year  Full year (e.g. 2026)
 * @param month 0-indexed month (0=Jan, 11=Dec)
 * @param day   Day to clamp (1–31)
 */
export function clampDay(year: number, month: number, day: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Math.min(day, lastDay)
}

// ─── Core generators ──────────────────────────────────────────

/**
 * Generate all cycles that overlap with [fromDate, toDate].
 * Delegates to the appropriate generator based on schedule type.
 */
export function generateCycles(
  schedule: PaySchedule,
  fromDate: Date,
  toDate:   Date,
): CycleDates[] {
  if (schedule.type === 'twice_monthly') {
    const sorted = [...schedule.days].sort((a, b) => a - b) as [number, number]
    return generateTwiceMonthlyCycles(sorted, fromDate, toDate)
  }
  return generateMonthlyCycles(schedule.days[0], fromDate, toDate)
}

function generateMonthlyCycles(
  payDay:   number,
  fromDate: Date,
  toDate:   Date,
): CycleDates[] {
  const cycles: CycleDates[] = []

  // Find the cycle that contains fromDate.
  // A cycle starts on `payDay` of some month. Find the most recent start <= fromDate.
  let year  = fromDate.getFullYear()
  let month = fromDate.getMonth()

  const clampedThisMonth = clampDay(year, month, payDay)

  // Has this month's payday passed (or is today the payday)?
  let startYear: number
  let startMonth: number

  if (fromDate.getDate() >= clampedThisMonth) {
    startYear  = year
    startMonth = month
  } else {
    // Payday hasn't arrived yet — cycle started last month
    if (month === 0) {
      startYear  = year - 1
      startMonth = 11
    } else {
      startYear  = year
      startMonth = month - 1
    }
  }

  // Generate forward until we exceed toDate
  while (true) {
    const sd  = clampDay(startYear, startMonth, payDay)
    const start = new Date(startYear, startMonth, sd)

    if (start > toDate) break

    // Next cycle start
    const nextMonth = (startMonth + 1) % 12
    const nextYear  = startMonth === 11 ? startYear + 1 : startYear
    const nd        = clampDay(nextYear, nextMonth, payDay)
    const nextStart = new Date(nextYear, nextMonth, nd)

    // End = day before next cycle start
    const end = new Date(nextStart)
    end.setDate(end.getDate() - 1)

    cycles.push({ startDate: start, endDate: end })

    startYear  = nextYear
    startMonth = nextMonth
  }

  return cycles
}

function generateTwiceMonthlyCycles(
  days:     [number, number],  // sorted ascending
  fromDate: Date,
  toDate:   Date,
): CycleDates[] {
  const [d1, d2] = days
  const cycles: CycleDates[] = []

  let year  = fromDate.getFullYear()
  let month = fromDate.getMonth()

  while (true) {
    const cd1     = clampDay(year, month, d1)
    const cd2     = clampDay(year, month, d2)
    const lastDay = new Date(year, month + 1, 0).getDate()

    // Cycle A: d1 → d2-1
    const startA = new Date(year, month, cd1)
    const endA   = new Date(year, month, cd2 - 1)

    if (startA > toDate) break
    cycles.push({ startDate: startA, endDate: endA })

    // Cycle B: d2 → end of month
    const startB = new Date(year, month, cd2)
    const endB   = new Date(year, month, lastDay)

    if (startB > toDate) break
    cycles.push({ startDate: startB, endDate: endB })

    // Advance to next month
    if (month === 11) { year++; month = 0 }
    else              { month++ }
  }

  return cycles
}

// ─── Lookup functions ──────────────────────────────────────────

/**
 * Return the cycle containing the given date.
 * Searches a ±2 year window which covers all practical cases.
 * Throws if no cycle found (indicates a gap in twice_monthly schedule).
 */
export function getCycleByDate(date: Date, schedule: PaySchedule): CycleDates {
  const y    = date.getFullYear()
  const from = new Date(y - 2, 0, 1)
  const to   = new Date(y + 2, 11, 31)

  const cycles = generateCycles(schedule, from, to)

  const found = cycles.find(c =>
    date >= c.startDate && date <= c.endDate
  )

  if (!found) {
    throw new Error(
      `No cycle found for ${date.toDateString()} with schedule ${JSON.stringify(schedule)}`
    )
  }

  return found
}

/**
 * Return the current cycle (cycle containing today).
 * Uses local date (not UTC) to avoid timezone offset issues.
 */
export function getCurrentCycle(schedule: PaySchedule): CycleDates {
  const now      = new Date()
  const localDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return getCycleByDate(localDay, schedule)
}

// ─── Formatting ───────────────────────────────────────────────

/**
 * "Mar 14 – Apr 13"  or  "Mar 1 – Mar 14"
 */
export function formatCycleLabel(cycle: CycleDates): string {
  const s = cycle.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const e = cycle.endDate.toLocaleDateString('en-US',   { month: 'short', day: 'numeric' })
  return `${s} – ${e}`
}

/**
 * "Mar–Apr 2026"  or  "Mar 2026"
 * Uses the end year to handle Dec→Jan correctly.
 */
export function formatCycleMonthLabel(cycle: CycleDates): string {
  const startMonth = cycle.startDate.toLocaleDateString('en-US', { month: 'short' })
  const endMonth   = cycle.endDate.toLocaleDateString('en-US',   { month: 'short' })
  const year       = cycle.endDate.getFullYear()

  if (startMonth === endMonth) return `${startMonth} ${year}`
  return `${startMonth}–${endMonth} ${year}`
}

// ─── Schedule helpers ──────────────────────────────────────────

/**
 * Convert a profile's raw pay_schedule fields to a PaySchedule object.
 * Falls back to monthly/1st if fields are null (new users without schedule set).
 */
export function profileToPaySchedule(profile: {
  pay_schedule_type: 'monthly' | 'twice_monthly' | null
  pay_schedule_days: number[] | null
}): PaySchedule {
  const type = profile.pay_schedule_type ?? 'monthly'
  const days = profile.pay_schedule_days ?? [1]
  return { type, days: [...days].sort((a, b) => a - b) }
}

/**
 * Format a date as 'YYYY-MM-DD' in local time (no UTC conversion).
 * Use this when storing dates in Supabase DATE columns.
 */
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
```

- [ ] **Step 4: Run tests — confirm they all pass**

```bash
npx vitest run src/lib/cycles.test.ts 2>&1
```

Expected: all 20+ tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run 2>&1
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/cycles.ts src/lib/cycles.test.ts
git commit -m "feat: add pay-cycle engine with full test coverage"
```

---

## Task 4: Cycle DB utility

**Files:**
- Create: `src/lib/supabase/cycles-db.ts`

This is the only place that touches the `cycles` table. All pages call this to get a `cycleId` string.

- [ ] **Step 1: Create `src/lib/supabase/cycles-db.ts`**

```ts
// ─────────────────────────────────────────────────────────────
// src/lib/supabase/cycles-db.ts
//
// Wraps cycles table interactions. Uses passed-in supabase client
// so it works in both client components and server actions.
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getCurrentCycle,
  getCycleByDate,
  toLocalDateStr,
  profileToPaySchedule,
} from '@/lib/cycles'
import type { PaySchedule } from '@/lib/cycles'

/**
 * Get or create the cycles row for the given schedule and date.
 * Defaults to today's cycle when `date` is not provided.
 *
 * Returns the cycle's start_date string ('YYYY-MM-DD') — use it as `cycle_id` in all queries.
 * cycle_id IS the start_date; no UUID lookup needed.
 */
export async function getOrCreateCycle(
  supabase:  SupabaseClient,
  userId:    string,
  schedule:  PaySchedule,
  date?:     Date,
): Promise<string> {
  const cycleDates = date
    ? getCycleByDate(date, schedule)
    : getCurrentCycle(schedule)

  const startStr = toLocalDateStr(cycleDates.startDate)
  const endStr   = toLocalDateStr(cycleDates.endDate)

  // Upsert — idempotent on composite PK (user_id, start_date)
  const { error } = await (supabase as any)
    .from('cycles')
    .upsert(
      {
        user_id:    userId,
        start_date: startStr,
        end_date:   endStr,
        is_current: !date, // true only when getting today's cycle
      },
      { onConflict: 'user_id,start_date' }
    )

  if (error) throw new Error(`getOrCreateCycle failed: ${error.message}`)

  return startStr  // cycle_id IS the start_date string
}

/**
 * Convenience: derive schedule from profile and get current cycle id.
 * This is the main entry point used by page components.
 */
export async function getCurrentCycleId(
  supabase: SupabaseClient,
  userId:   string,
  profile:  { pay_schedule_type: 'monthly' | 'twice_monthly' | null; pay_schedule_days: number[] | null },
): Promise<string> {
  const schedule = profileToPaySchedule(profile)
  return getOrCreateCycle(supabase, userId, schedule)
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors in new files.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/cycles-db.ts
git commit -m "feat: add getOrCreateCycle DB utility"
```

---

## Task 5: Backfill existing data

This task runs a one-time migration to populate `cycle_id` on all existing records. It must be run ONCE in Supabase dashboard (or as a server action triggered manually). After this, all new writes will set `cycle_id` directly.

- [ ] **Step 1: Run backfill SQL in Supabase dashboard**

This script iterates all users, generates their cycles, creates cycle rows, and updates income_entries and transactions.

**WARNING: Run this on staging/dev first. Back up prod before running.**

```sql
-- ─── Step A: Create a cycle row for each (user, month) pair in income_entries ───
-- For monthly users: cycle starts on pay_schedule_days[1] of the month
-- For no-schedule users: default to 1st of month (monthly, day=1)

-- NOTE: Backfill intentionally skips twice_monthly users (none exist yet in prod).
-- If any twice_monthly users exist, their cycle_id will remain NULL and the
-- verification queries in Step 2 will flag them.
-- NOTE: The `cycle_start + INTERVAL '1 month'` expression uses Postgres date normalization
-- (e.g., Jan 31 + 1 month = Feb 28) which matches the TypeScript clampDay() logic.
DO $$
DECLARE
  r RECORD;
  cycle_start DATE;
  cycle_end DATE;
  pay_day INT;
BEGIN
  FOR r IN
    SELECT DISTINCT ie.user_id, ie.month,
      COALESCE(up.pay_schedule_days[1], 1) AS pay_day
    FROM income_entries ie
    JOIN user_profiles up ON up.id = ie.user_id
    WHERE ie.cycle_id IS NULL
      AND (up.pay_schedule_type = 'monthly' OR up.pay_schedule_type IS NULL)
  LOOP
    pay_day := LEAST(r.pay_day, DATE_PART('day', (DATE_TRUNC('month', TO_DATE(r.month, 'YYYY-MM')) + INTERVAL '1 month - 1 day'))::INT);

    cycle_start := TO_DATE(r.month, 'YYYY-MM') + (pay_day - 1) * INTERVAL '1 day';
    -- end = next month's payday - 1
    -- Postgres month normalization (e.g., Jan 31 + 1 month = Feb 28) is intentional here.
    cycle_end := (cycle_start + INTERVAL '1 month') - INTERVAL '1 day';

    -- Upsert cycle row (cycle_id = start_date as TEXT)
    INSERT INTO cycles (user_id, start_date, end_date, is_current)
    VALUES (r.user_id, cycle_start, cycle_end, false)
    ON CONFLICT (user_id, start_date) DO NOTHING;

    -- Update income_entries — cycle_id IS the start_date string
    UPDATE income_entries
    SET cycle_id = TO_CHAR(cycle_start, 'YYYY-MM-DD')
    WHERE user_id = r.user_id AND month = r.month AND cycle_id IS NULL;
  END LOOP;
END $$;

-- ─── Step B: Backfill transactions using their date field ───
DO $$
DECLARE
  r RECORD;
  cycle_row RECORD;
BEGIN
  FOR r IN
    SELECT t.id, t.user_id, t.date::DATE AS txn_date,
      COALESCE(up.pay_schedule_days[1], 1) AS pay_day
    FROM transactions t
    JOIN user_profiles up ON up.id = t.user_id
    WHERE t.cycle_id IS NULL
      AND (up.pay_schedule_type = 'monthly' OR up.pay_schedule_type IS NULL)
  LOOP
    -- Find the cycle for this transaction's date
    SELECT c.start_date INTO cycle_row
    FROM cycles c
    WHERE c.user_id = r.user_id
      AND c.start_date <= r.txn_date
      AND c.end_date   >= r.txn_date
    LIMIT 1;

    IF cycle_row.start_date IS NOT NULL THEN
      UPDATE transactions
      SET cycle_id = TO_CHAR(cycle_row.start_date, 'YYYY-MM-DD')
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- ─── Step C: Backfill fixed_expenses and spending_budgets (same pattern as income_entries) ───
UPDATE fixed_expenses fe
SET cycle_id = ie.cycle_id
FROM income_entries ie
WHERE fe.user_id = ie.user_id
  AND fe.month   = ie.month
  AND fe.cycle_id IS NULL
  AND ie.cycle_id IS NOT NULL;

UPDATE spending_budgets sb
SET cycle_id = ie.cycle_id
FROM income_entries ie
WHERE sb.user_id = ie.user_id
  AND sb.month   = ie.month
  AND sb.cycle_id IS NULL
  AND ie.cycle_id IS NOT NULL;
```

- [ ] **Step 2: Verify backfill in Supabase**

```sql
-- Should return 0 rows if backfill succeeded
SELECT COUNT(*) FROM income_entries WHERE cycle_id IS NULL;
SELECT COUNT(*) FROM transactions WHERE cycle_id IS NULL AND date > '2020-01-01';
```

- [ ] **Step 3: No code commit needed — this is a data migration only**

---

## Task 6: Switch overview page to cycle_id

**Files:**
- Modify: `src/app/(app)/app/page.tsx`

This is the largest single-file change. Read the file before editing.

The pattern replaces:
```ts
// BEFORE
const currentMonth = new Date().toISOString().slice(0, 7)
// ...
.eq('month', currentMonth)
```

With:
```ts
// AFTER
const cycleId = await getCurrentCycleId(supabase, user.id, profile)
// ...
.eq('cycle_id', cycleId)
```

- [ ] **Step 1: Add cycleId initialization at the top of `loadOverviewData`**

After `const user = ...` and `const profile = ...` are available, add:

```ts
import { getCurrentCycleId } from '@/lib/supabase/cycles-db'
import { getCurrentCycle, formatCycleLabel, formatCycleMonthLabel, profileToPaySchedule } from '@/lib/cycles'

// Inside loadOverviewData, after fetching user/profile:
const cycleId      = await getCurrentCycleId(supabase, user.id, ctxProfile)
const currentCycle = getCurrentCycle(profileToPaySchedule(ctxProfile))
const cycleLabel   = formatCycleLabel(currentCycle)        // "Mar 14 – Apr 13"
const cycleMonthLabel = formatCycleMonthLabel(currentCycle) // "Mar–Apr 2026"
```

- [ ] **Step 2: Replace all `.eq('month', currentMonth)` with `.eq('cycle_id', cycleId)`**

Affected queries in this file:
- `income_entries` fetch (line ~203)
- `transactions` fetch (line ~208-209)
- `fixed_expenses` fetch (line ~211)
- `spending_budgets` fetch (line ~212-213)
- Income confirmation update (line ~145-148)

Also replace in `carryForward`:
```ts
// BEFORE
const prevMonth = getPrevMonth(currentMonth)
const [{ data: prevIncome }, ...] = await Promise.all([
  supabase.from('income_entries').eq('month', prevMonth)...
])

// AFTER — get the previous cycle id (the cycle before the current one)
const prevCycleId = await getPrevCycleId(supabase, user.id, ctxProfile)
const [{ data: prevIncome }, ...] = await Promise.all([
  supabase.from('income_entries').eq('cycle_id', prevCycleId)...
])
```

Add `getPrevCycleId` to `cycles-db.ts`:

```ts
// Add to src/lib/supabase/cycles-db.ts:

/**
 * Get the cycle_id for the cycle immediately preceding the current cycle.
 * Used for carry-forward: fetch previous cycle's income/budgets.
 */
export async function getPrevCycleId(
  supabase:  SupabaseClient,
  userId:    string,
  profile:   { pay_schedule_type: 'monthly' | 'twice_monthly' | null; pay_schedule_days: number[] | null },
): Promise<string | null> {
  const schedule     = profileToPaySchedule(profile)
  const currentCycle = getCurrentCycle(schedule)

  // The day before the current cycle's start is the last day of the prev cycle
  const dayBefore = new Date(currentCycle.startDate)
  dayBefore.setDate(dayBefore.getDate() - 1)

  try {
    return await getOrCreateCycle(supabase, userId, schedule, dayBefore)
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Update committed-expense check-in comparison**

```ts
// BEFORE
.filter((s: any) => s.last_confirmed_month !== currentMonth)

// AFTER
.filter((s: any) => s.last_confirmed_cycle_id !== cycleId)
```

And the update:
```ts
// BEFORE
.update({ last_confirmed_month: currentMonth })

// AFTER
.update({ last_confirmed_cycle_id: cycleId })
```

- [ ] **Step 4: Update localStorage carry-forward key**

```ts
// BEFORE
const CARRY_DISMISSED_KEY = `cenza:carry-dismissed:${currentMonth}`

// AFTER
const CARRY_DISMISSED_KEY = `cenza:carry-dismissed:${cycleId}`
```

- [ ] **Step 5: Update income save**

```ts
// BEFORE
await supabase.from('income_entries').upsert({
  user_id: user.id,
  month:   currentMonth,
  ...
}, { onConflict: 'user_id,month' })

// AFTER
await (supabase as any).from('income_entries').upsert({
  user_id:  user.id,
  month:    currentMonth,  // keep for now — removed in cleanup
  cycle_id: cycleId,
  ...
}, { onConflict: 'user_id,cycle_id' })
```

- [ ] **Step 6: Pass cycle labels to CarryForwardData**

Update `CarryForwardData` interface to include cycle info:
```ts
// In CarryForwardScreen.tsx props or local type:
prevCycleLabel: string  // "Feb 14 – Mar 13" — replaces prevMonth display
```

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Fix any errors before committing.

- [ ] **Step 8: Commit**

```bash
git add src/app/(app)/app/page.tsx src/lib/supabase/cycles-db.ts
git commit -m "feat: switch overview page to cycle_id queries"
```

---

## Task 7: Switch write paths (log, income)

**Files:**
- Modify: `src/app/(app)/log/new/NewExpenseClient.tsx`
- Modify: `src/app/(app)/log/first/page.tsx`
- Modify: `src/app/(app)/income/page.tsx`

These files write records with a `month` field. They need to also write `cycle_id`.

- [ ] **Step 1: Update NewExpenseClient — transaction insert**

Find where transactions are inserted (the `handleSave` function). Read the file first.

Add cycle_id to the insert:

```ts
// BEFORE (approximate current code):
await (supabase.from('transactions') as any).insert({
  user_id:        user.id,
  date:           txnDate,
  month:          new Date().toISOString().slice(0, 7),
  category_type:  ...,
  ...
})

// AFTER:
import { getCurrentCycleId } from '@/lib/supabase/cycles-db'
// ...
const cycleId = await getCurrentCycleId(supabase, user.id, profile)

await (supabase.from('transactions') as any).insert({
  user_id:        user.id,
  date:           txnDate,
  month:          new Date().toISOString().slice(0, 7),  // keep during migration
  cycle_id:       cycleId,
  category_type:  ...,
  ...
})
```

Note: `profile` comes from `useUser()` which already loads `pay_schedule_type` and `pay_schedule_days` via `SELECT *`.

- [ ] **Step 2: Update income/page.tsx — all three upserts**

Pattern:
```ts
// At top of save handler, get cycleId:
const cycleId = await getCurrentCycleId(supabase, user.id, profile)

// Add cycle_id to each upsert, update onConflict:
await (supabase.from('income_entries') as any).upsert({
  user_id:  user.id,
  month:    currentMonth,   // keep during migration
  cycle_id: cycleId,
  ...
}, { onConflict: 'user_id,cycle_id' })

await (supabase.from('fixed_expenses') as any).upsert({
  user_id:  user.id,
  month:    currentMonth,
  cycle_id: cycleId,
  ...
}, { onConflict: 'user_id,cycle_id' })

await (supabase.from('spending_budgets') as any).upsert({
  user_id:  user.id,
  month:    currentMonth,
  cycle_id: cycleId,
  ...
}, { onConflict: 'user_id,cycle_id' })
```

Also update reads in income/page.tsx from `.eq('month', currentMonth)` → `.eq('cycle_id', cycleId)`.

- [ ] **Step 3: Update log/first/page.tsx**

Read the file. Same pattern — find transaction inserts, add `cycle_id`.

- [ ] **Step 4: TypeScript check + commit**

```bash
npx tsc --noEmit 2>&1
git add src/app/(app)/log/new/NewExpenseClient.tsx \
        src/app/(app)/log/first/page.tsx \
        src/app/(app)/income/page.tsx
git commit -m "feat: add cycle_id to all transaction and income writes"
```

---

## Task 8: Switch remaining read pages

**Files:**
- Modify: `src/app/(app)/log/page.tsx`
- Modify: `src/app/(app)/settings/page.tsx`
- Modify: `src/app/(app)/history/page.tsx`
- Modify: `src/app/(app)/history/[key]/page.tsx`
- Modify: `src/app/(app)/goals/page.tsx`
- Modify: `src/app/(app)/goals/new/NewGoalClient.tsx`

For each file, the pattern is:

1. Read the file
2. Find `currentMonth = new Date().toISOString().slice(0, 7)`
3. Replace with `const cycleId = await getCurrentCycleId(supabase, user.id, profile)` (get profile from UserContext or local fetch)
4. Replace `.eq('month', currentMonth)` with `.eq('cycle_id', cycleId)`
5. Remove unused `getPrevMonth` imports

- [ ] **Step 1: Update log/page.tsx**

Read the file. All month queries become cycle queries. The month display header (e.g., "MARCH 2026") becomes the cycle label — see Task 9.

- [ ] **Step 2: Update settings/page.tsx**

This file:
- Has a `currentMonth` for income query — replace with `cycleId`
- Has `pay_day` UI picker — replace with pay_schedule picker (see Task 9 for UI)

For now, just update the query. Leave the pay_day UI — it's replaced in Task 9.

- [ ] **Step 3: Update history/page.tsx and history/[key]/page.tsx**

These likely filter transactions by month. Replace with cycle_id.

Note: History may need to show multiple past cycles. Keep the ability to pass a specific cycle_id parameter. For now, default to current cycle.

- [ ] **Step 4: Update goals pages**

Goals transactions are queried all-time (no month filter) in most cases. Verify with a read of the file. If there's a month filter, replace it.

- [ ] **Step 5: Update plan/page.tsx**

Read `src/app/(app)/plan/page.tsx`. It has 3 queries filtered by month (income_entries, fixed_expenses, spending_budgets on lines ~129, 151, 162). Apply the same pattern:

```ts
// At the top of the data-loading function:
const cycleId = await getCurrentCycleId(supabase, user.id, profile)

// Replace all three:
.eq('month', month)   →   .eq('cycle_id', cycleId)
```

- [ ] **Step 6: TypeScript check + commit**

```bash
npx tsc --noEmit 2>&1
git add src/app/(app)/log/page.tsx \
        src/app/(app)/settings/page.tsx \
        src/app/(app)/history/page.tsx \
        "src/app/(app)/history/[key]/page.tsx" \
        src/app/(app)/goals/page.tsx \
        src/app/(app)/goals/new/NewGoalClient.tsx \
        src/app/(app)/plan/page.tsx
git commit -m "feat: switch all remaining read pages to cycle_id queries"
```

---

## Task 9: UI — cycle labels + pay schedule settings

**Files:**
- Modify: `src/app/(app)/app/page.tsx` (header label)
- Modify: `src/app/(app)/log/page.tsx` (month header)
- Modify: `src/app/(app)/settings/page.tsx` (pay schedule picker)
- Modify: `src/components/flows/overview/CarryForwardScreen.tsx`
- Modify: `src/components/flows/overview/MonthRecapScreen.tsx`
- Modify: `src/components/flows/log/ReceivedIncomeSheet.tsx`

- [ ] **Step 1: Update overview header**

In `app/page.tsx`, find where "MARCH 2026" (the current month label) is rendered. Replace:

```tsx
// BEFORE — something like:
<span>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}</span>

// AFTER:
<div>
  <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
    This pay period
  </p>
  <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '2px 0 0' }}>
    {cycleLabel} {/* "Mar 14 – Apr 13" */}
  </p>
</div>
```

The `cycleLabel` is already computed in Task 6.

- [ ] **Step 2: Update log page header if it shows month**

Same replacement: "MARCH 2026" → "This pay period" + cycle label.

- [ ] **Step 3: Update settings — replace pay_day picker with pay_schedule picker**

Read `settings/page.tsx` to find the pay_day section. Replace:

```tsx
// BEFORE: single day picker (PAY_DAYS = 1-28)
const [payDay, setPayDay] = useState<number | null>(null)
// ...
{row('Pay day', payDay ? `${payDay}th of the month` : 'Not set', () => setPayDayOpen(true))}

// AFTER: schedule type + days
const [scheduleType, setScheduleType] = useState<'monthly' | 'twice_monthly'>('monthly')
const [scheduleDays, setScheduleDays] = useState<number[]>([1])

const savePaySchedule = async () => {
  await (supabase.from('user_profiles') as any)
    .update({ pay_schedule_type: scheduleType, pay_schedule_days: scheduleDays })
    .eq('id', user.id)
}

// Display:
const scheduleLabel = scheduleType === 'monthly'
  ? `${scheduleDays[0]}th of the month`
  : `${scheduleDays[0]}th & ${scheduleDays[1]}th`
```

Keep the UI simple — a sheet/panel with:
1. Toggle: "Monthly" / "Twice a month"
2. Day picker(s): one for monthly, two for twice_monthly
3. Constraint: for twice_monthly, first day must be ≤ 3 (to avoid date gaps)

- [ ] **Step 4: Update CarryForwardScreen**

The screen currently shows "prevMonth" as a label. Replace:

```tsx
// BEFORE: prop prevMonth: string  (e.g. "2026-02")
// AFTER: prop prevCycleLabel: string (e.g. "Feb 14 – Mar 13")

// Update the display text:
// BEFORE: "Carrying from February"
// AFTER: "Carrying from {prevCycleLabel}"
```

Read the file to find exact location of `prevMonth` usage.

- [ ] **Step 5: Update ReceivedIncomeSheet — remove pay_day capture step**

The second step ("what day does your income arrive?") is no longer needed because pay_schedule is now captured in Settings.

Remove step `'payday'` entirely:
- Remove `Step = 'amount' | 'payday'`
- Change to just `step = 'amount'` (or remove step state entirely)
- Remove the pay day chips UI
- `handleAmountNext` → calls `onConfirm(parsedAmount)` directly (no day param)
- Remove `payDay` from Props interface (no longer needed)

```tsx
// Simplified component signature:
interface Props {
  open:          boolean
  onClose:       () => void
  declaredTotal: number
  currency:      string
  onConfirm:     (received: number) => Promise<void>  // removed payDay param
}
```

- [ ] **Step 6: Update SubscriptionConfirmSheet**

Read `src/components/flows/log/SubscriptionConfirmSheet.tsx`. It has a `currentMonth: string` prop used to build a display date (`new Date(\`${currentMonth}-01\`)`). After Task 6, the caller (`app/page.tsx`) passes a `cycleId` (now a `YYYY-MM-DD` string) where it previously passed a `YYYY-MM` string. This will silently break the date display.

Fix by renaming the prop and using the cycle label string directly:

```tsx
// BEFORE:
interface Props {
  currentMonth: string  // 'YYYY-MM'
  // ...
}
// Usage inside: new Date(`${currentMonth}-01`).toLocaleDateString(...)

// AFTER:
interface Props {
  cycleLabel: string  // e.g. "Mar 14 – Apr 13" — passed from formatCycleLabel()
  // ...
}
// Usage inside: display cycleLabel directly (no Date construction needed)
```

Update the caller in `app/page.tsx` to pass `cycleLabel` (already computed in Task 6 Step 1) instead of `currentMonth`.

- [ ] **Step 7: TypeScript check + commit**

```bash
npx tsc --noEmit 2>&1
git add src/app/(app)/app/page.tsx \
        src/app/(app)/log/page.tsx \
        src/app/(app)/settings/page.tsx \
        src/components/flows/overview/CarryForwardScreen.tsx \
        src/components/flows/overview/MonthRecapScreen.tsx \
        src/components/flows/log/ReceivedIncomeSheet.tsx \
        src/components/flows/log/SubscriptionConfirmSheet.tsx
git commit -m "feat: update UI to show cycle labels and pay schedule settings"
```

---

## Task 10: Check-in logic update

**Files:**
- Modify: `src/app/(app)/app/page.tsx`

- [ ] **Step 1: Update income check-in trigger**

```ts
// BEFORE (line ~225):
if (income.received_confirmed_at === null && ctxProfile?.income_type !== 'variable') {
  setIncomeCheckOpen(true)
}

// AFTER — income_type check remains; cycle is already correct since we fetched
// income by cycle_id. The check-in fires whenever the current cycle's income
// hasn't been confirmed yet.
if (income && income.received_confirmed_at === null && ctxProfile?.income_type !== 'variable') {
  setIncomeCheckOpen(true)
}
```

The logic is essentially the same — but now "income for this period" is correctly scoped to the current cycle instead of the calendar month.

- [ ] **Step 2: Update income confirmation save**

```ts
// BEFORE:
await (supabase.from('income_entries') as any)
  .update({ received, received_confirmed_at: new Date().toISOString() })
  .eq('user_id', user.id)
  .eq('month', currentMonth)

// AFTER:
await (supabase.from('income_entries') as any)
  .update({ received, received_confirmed_at: new Date().toISOString() })
  .eq('user_id', user.id)
  .eq('cycle_id', cycleId)
```

- [ ] **Step 3: Remove pay_day save from income confirmation**

Previously, when a user confirmed income, we also saved their pay_day if it wasn't set. That path is removed — pay_schedule is now set in Settings:

```ts
// BEFORE (in handleIncomeConfirm):
if (day !== null && !profile?.pay_day) {
  ops.push(
    (supabase.from('user_profiles') as any).update({ pay_day: day }).eq('id', user.id)
  )
}

// AFTER: Remove the above block entirely.
```

- [ ] **Step 4: TypeScript check + commit**

```bash
npx tsc --noEmit 2>&1
git add src/app/(app)/app/page.tsx
git commit -m "feat: update income check-in to use cycle_id; remove pay_day capture"
```

---

## Task 11: Cleanup

**Files:**
- Modify: `src/types/database.ts` — remove deprecated fields
- Modify: `src/lib/context/UserContext.tsx` — remove pay_day, expose paySchedule
- Modify: `src/app/auth/callback/route.ts` — remove month_start, custom_day, pay_day
- Modify: `src/lib/finance.ts` — remove getPrevMonth()
- SQL (Supabase dashboard) — drop deprecated columns

Only run this task after all previous tasks are verified working in production.

- [ ] **Step 1: Drop deprecated columns (SQL — run in dashboard)**

```sql
-- Remove deprecated columns only after verifying cycle_id is populated everywhere
ALTER TABLE user_profiles
  DROP COLUMN IF EXISTS pay_day,
  DROP COLUMN IF EXISTS month_start,
  DROP COLUMN IF EXISTS custom_day;

-- Remove month column from transactional tables
-- WARNING: Run only after 100% of app reads use cycle_id
ALTER TABLE income_entries    DROP COLUMN IF EXISTS month;
ALTER TABLE transactions       DROP COLUMN IF EXISTS month;
ALTER TABLE fixed_expenses     DROP COLUMN IF EXISTS month;
ALTER TABLE spending_budgets   DROP COLUMN IF EXISTS month;
```

- [ ] **Step 2: Update UserProfile type — remove deprecated fields**

In `src/types/database.ts`, remove:
```ts
// Remove these from UserProfile:
pay_day:     number | null
month_start: 'first' | 'custom' | null
custom_day:  number | null

// Remove from IncomeEntry:
month: string

// Remove from Transaction:
month: string
```

- [ ] **Step 3: Update UserContext — replace pay_day with paySchedule**

```ts
// BEFORE:
interface Profile {
  id:       string
  currency: string
  pay_day:  number | null
  [key: string]: any
}

// AFTER:
import { profileToPaySchedule } from '@/lib/cycles'
import type { PaySchedule } from '@/lib/cycles'

interface Profile {
  id:                  string
  currency:            string
  pay_schedule_type:   'monthly' | 'twice_monthly' | null
  pay_schedule_days:   number[] | null
  [key: string]:       any
}

interface UserContextValue {
  user:         User | null
  profile:      Profile | null
  paySchedule:  PaySchedule  // derived, never null
  loading:      boolean
  profileIncome: number
}

// In UserProvider, derive paySchedule from profile:
const paySchedule = useMemo(
  () => profileToPaySchedule(profile ?? {}),
  [profile]
)
```

- [ ] **Step 4: Remove getPrevMonth from finance.ts**

In `src/lib/finance.ts`, delete:

```ts
// Remove this function:
export function getPrevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 1
    ? `${y - 1}-12`
    : `${y}-${String(m - 1).padStart(2, '0')}`
}
```

Also remove its test from `src/lib/finance.test.ts`.

- [ ] **Step 5: Update auth callback — remove month_start, custom_day, pay_day**

In `src/app/auth/callback/route.ts`, the profile insert currently sets `month_start: 'first'` and `custom_day: null`. Remove both. Add default pay_schedule:

```ts
// BEFORE:
.insert({
  id:            user.id,
  name:          safeName,
  month_start:   'first',
  custom_day:    null,
  goals:         [],
  onboarding_complete: false,
})

// AFTER:
.insert({
  id:                  user.id,
  name:                safeName,
  pay_schedule_type:   'monthly',
  pay_schedule_days:   [1],
  goals:               [],
  onboarding_complete: false,
})
```

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run 2>&1
```

Expected: all 100+ tests pass.

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore: remove deprecated YYYY-MM fields; cleanup pay_day, month_start, custom_day"
```

---

## Worktree setup (run before starting tasks)

```bash
cd /Users/mshumaker/Documents/codeFile/publicFinance

# Verify .worktrees is gitignored
git check-ignore -q .worktrees && echo "ignored" || echo "NOT IGNORED — add to .gitignore first"

# Create worktree
git worktree add .worktrees/pay-cycle-refactor -b feature/pay-cycle-refactor

cd .worktrees/pay-cycle-refactor
npm install
```

---

## Risks and notes

| Risk | Mitigation |
|------|------------|
| Backfill SQL (Task 5) fails for some users | Run on dev/staging first; verify counts before prod |
| Twice_monthly users with d1 > 3 have date gaps | UI in Task 9 constrains d1 ≤ 3; existing data defaults to [1, 15] |
| Race condition in getOrCreateCycle | Handled by retry-on-conflict logic |
| Settings page pay_schedule update invalidates current cycleId | Acceptable — page reload picks up new schedule |
| `last_confirmed_month` on subscriptions not migrated | Task 6 updates to `last_confirmed_cycle_id`; old `last_confirmed_month` data effectively forces a one-time re-confirm |
