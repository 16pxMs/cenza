-- Add explicit `due_day` to fixed_expenses.entries items.
-- Entries are stored as jsonb objects, so this is a source-model backfill
-- rather than a new table column.

update public.fixed_expenses fe
set entries = rebuilt.entries
from (
  select
    fe_inner.id,
    jsonb_agg(
      case
        when e.elem ? 'due_day' then e.elem
        else jsonb_set(e.elem, '{due_day}', 'null'::jsonb, true)
      end
      order by e.ord
    ) as entries
  from public.fixed_expenses fe_inner
  cross join lateral jsonb_array_elements(coalesce(fe_inner.entries, '[]'::jsonb))
    with ordinality as e(elem, ord)
  group by fe_inner.id
) as rebuilt
where fe.id = rebuilt.id;
