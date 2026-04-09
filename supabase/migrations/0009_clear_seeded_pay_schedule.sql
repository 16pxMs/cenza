-- ─────────────────────────────────────────────────────────────────────────────
-- Clear legacy seeded pay schedule defaults
--
-- Older onboarding writes could pre-fill monthly day 1 before the user chose a
-- schedule. For incomplete onboarding profiles, reset those seeded defaults.
-- ─────────────────────────────────────────────────────────────────────────────

update public.user_profiles
set
  pay_schedule_type = null,
  pay_schedule_days = null
where
  onboarding_complete = false
  and pay_schedule_type = 'monthly'
  and pay_schedule_days = array[1]::integer[];

