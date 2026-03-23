-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 7 — Full hybrid model: extend monthly check-in to all committed expenses
--
-- fixed_expenses are now part of the monthly confirmation cycle.
-- last_confirmed_month tracks the last month a fixed expense was logged,
-- matching the same pattern used by subscriptions.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.fixed_expenses
  add column if not exists last_confirmed_month text;  -- 'YYYY-MM', null = never confirmed
