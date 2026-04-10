-- Cycle start context for first-time users who join mid-month.
-- full_month: user is planning from fresh income
-- mid_month: user starts from current remaining balance

alter table public.income_entries
  add column if not exists cycle_start_mode text not null default 'full_month';

alter table public.income_entries
  add column if not exists opening_balance numeric;

update public.income_entries
set cycle_start_mode = 'full_month'
where cycle_start_mode is null;

alter table public.income_entries
  drop constraint if exists income_entries_cycle_start_mode_check;

alter table public.income_entries
  add constraint income_entries_cycle_start_mode_check
  check (cycle_start_mode in ('full_month', 'mid_month'));

alter table public.income_entries
  drop constraint if exists income_entries_opening_balance_check;

alter table public.income_entries
  add constraint income_entries_opening_balance_check
  check (opening_balance is null or opening_balance >= 0);
