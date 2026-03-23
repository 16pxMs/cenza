-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 6 — Subscriptions hybrid model
--
-- Tracks the month a subscription was last confirmed so the monthly
-- check-in knows which ones need attention.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.subscriptions
  add column if not exists last_confirmed_month text;  -- 'YYYY-MM', null = never confirmed
