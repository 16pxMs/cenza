-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1 — Foundation
--
-- Adds columns required for the new onboarding flow and income model.
-- All additions use IF NOT EXISTS so this is safe to run on databases
-- that may have had these columns added manually already.
-- ─────────────────────────────────────────────────────────────────────────────

-- user_profiles: income type and pay day
alter table public.user_profiles
  add column if not exists income_type text,          -- 'salaried' | 'variable' | null
  add column if not exists pay_day     integer;       -- day of month income usually arrives (1–31)

-- user_profiles: allow currency to be null so locale detection can set it
-- after sign-up instead of defaulting to KES immediately
alter table public.user_profiles
  alter column currency drop default,
  alter column currency drop not null;

-- income_entries: actual received amount + confirmation timestamp
alter table public.income_entries
  add column if not exists received               numeric,
  add column if not exists received_confirmed_at  timestamptz;
