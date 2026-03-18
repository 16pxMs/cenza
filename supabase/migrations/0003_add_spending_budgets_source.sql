-- Add source field to spending_budgets to distinguish onboarding estimates from user-set budgets
ALTER TABLE public.spending_budgets
  ADD COLUMN IF NOT EXISTS source text not null default 'onboarding';
