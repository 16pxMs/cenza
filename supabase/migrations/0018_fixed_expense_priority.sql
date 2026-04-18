-- Add explicit `priority` to fixed_expenses.entries items.
-- Existing entries default to `core`.

update public.fixed_expenses fe
set entries = rebuilt.entries
from (
  select
    fe_inner.id,
    jsonb_agg(
      case
        when e.elem ? 'priority' then e.elem
        else jsonb_set(e.elem, '{priority}', '"core"'::jsonb, true)
      end
      order by e.ord
    ) as entries
  from public.fixed_expenses fe_inner
  cross join lateral jsonb_array_elements(coalesce(fe_inner.entries, '[]'::jsonb))
    with ordinality as e(elem, ord)
  group by fe_inner.id
) as rebuilt
where fe.id = rebuilt.id;
