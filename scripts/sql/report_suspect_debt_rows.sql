-- Diagnostic only: review debts that look like old leftovers before deleting anything.
-- These rows have no history, no positive balance, and sit outside the normal active flow.
-- Run manually in Supabase SQL editor when investigating suspicious "deleted" debts.

select
  d.id,
  d.name,
  d.status,
  d.current_balance,
  d.currency,
  d.debt_kind,
  d.created_at,
  d.updated_at,
  count(t.id) as transaction_count
from debts d
left join debt_transactions t
  on t.debt_id = d.id
group by
  d.id,
  d.name,
  d.status,
  d.current_balance,
  d.currency,
  d.debt_kind,
  d.created_at,
  d.updated_at
having
  count(t.id) = 0
  and d.current_balance <= 0
  and d.status in ('active', 'cleared', 'cancelled')
order by d.updated_at desc nulls last, d.created_at desc nulls last;
