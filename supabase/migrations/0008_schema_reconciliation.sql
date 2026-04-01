-- ─────────────────────────────────────────────────────────────────────────────
-- Schema reconciliation
--
-- Captures the live-database fixes that the app now relies on:
-- - user_profiles.income_type
-- - fixed_expenses/subscriptions last_confirmed_month
-- - cycle_id required across cycle-based tables
-- - remove stale fixed_expenses (user_id, key) uniqueness
-- - add cycle-scoped transaction indexes
-- - ensure spending_budgets has RLS + policy
-- ─────────────────────────────────────────────────────────────────────────────

-- user_profiles
alter table public.user_profiles
  add column if not exists income_type text;

comment on column public.user_profiles.income_type is
  'Expected values: salaried | variable | null';

-- fixed_expenses / subscriptions
alter table public.fixed_expenses
  add column if not exists last_confirmed_month text;

alter table public.subscriptions
  add column if not exists last_confirmed_month text;

comment on column public.fixed_expenses.last_confirmed_month is
  'YYYY-MM string for the last month this fixed expense was confirmed or logged';

comment on column public.subscriptions.last_confirmed_month is
  'YYYY-MM string for the last month this subscription was confirmed';

-- Remove stale pre-cycle uniqueness if it is still present.
alter table public.fixed_expenses
  drop constraint if exists fixed_expenses_user_id_key_key;

-- Tighten cycle linkage now that live data has no null cycle rows.
alter table public.income_entries
  alter column cycle_id set not null;

alter table public.fixed_expenses
  alter column cycle_id set not null;

alter table public.spending_budgets
  alter column cycle_id set not null;

alter table public.transactions
  alter column cycle_id set not null;

-- Query patterns used heavily by server loaders and actions.
create index if not exists transactions_user_cycle
  on public.transactions (user_id, cycle_id);

create index if not exists transactions_user_cycle_category
  on public.transactions (user_id, cycle_id, category_key);

create index if not exists transactions_user_cycle_type
  on public.transactions (user_id, cycle_id, category_type);

-- Ensure newer tables have RLS coverage.
alter table public.spending_budgets enable row level security;

drop policy if exists "Users can manage own spending budgets"
  on public.spending_budgets;

create policy "Users can manage own spending budgets"
on public.spending_budgets
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
