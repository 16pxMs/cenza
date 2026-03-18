-- Fix missing ON DELETE CASCADE on spending_budgets.user_id
ALTER TABLE public.spending_budgets
  DROP CONSTRAINT spending_budgets_user_id_fkey,
  ADD CONSTRAINT spending_budgets_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
