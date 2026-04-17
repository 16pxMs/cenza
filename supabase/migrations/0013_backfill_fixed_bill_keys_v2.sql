-- ─────────────────────────────────────────────────────────────────────────────
-- 0013 — Backfill fixed-bill canonical keys (expanded mappings)
--
-- What this does:
--   - rewrites transactions.category_key for fixed rows to canonical keys
--   - rewrites fixed_expenses.entries[*].key using the same mapping
--   - rewrites item_dictionary.category_key for fixed rows so future
--     suggestions reuse the canonical key too
--   - leaves user-facing labels unchanged
--
-- Idempotent: re-running produces zero further changes.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create temp table _fixed_bill_synonyms_v2 (
  from_key text primary key,
  to_key   text not null
) on commit drop;

insert into _fixed_bill_synonyms_v2 (from_key, to_key) values
  ('wifi', 'internet'),
  ('home_wifi', 'internet'),
  ('office_wifi', 'internet'),
  ('home_internet', 'internet'),
  ('office_internet', 'internet'),
  ('fibre', 'internet'),
  ('fiber', 'internet'),
  ('home_fibre', 'internet'),
  ('home_fiber', 'internet'),
  ('safaricom_fibre', 'internet'),
  ('safaricom_fiber', 'internet'),
  ('zuku', 'internet'),
  ('faiba', 'internet'),
  ('jtl', 'internet'),
  ('phone_internet_and_minutes', 'phone'),
  ('internet_and_minutes', 'phone'),
  ('phone_data', 'phone'),
  ('mobile_data', 'phone'),
  ('mobile_internet', 'phone'),
  ('data_bundle', 'phone'),
  ('data_bundles', 'phone'),
  ('airtime_and_data', 'phone'),
  ('house_rent', 'rent'),
  ('home_rent', 'rent'),
  ('monthly_rent', 'rent'),
  ('water_bill', 'water'),
  ('water_tokens', 'water'),
  ('power', 'electricity'),
  ('kplc', 'electricity'),
  ('electricity_tokens', 'electricity'),
  ('electricity_token', 'electricity'),
  ('power_tokens', 'electricity'),
  ('power_bill', 'electricity'),
  ('cooking_gas', 'gas'),
  ('lpg', 'gas'),
  ('house_keeper', 'houseKeeping'),
  ('housekeeper', 'houseKeeping'),
  ('house_help', 'houseKeeping'),
  ('housekeeping', 'houseKeeping');

create or replace function pg_temp._slugify_bill_label_v2(src text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(
      both '_' from
      regexp_replace(lower(btrim(coalesce(src, ''))), '[^a-z0-9]+', '_', 'g')
    ),
    ''
  );
$$;

create or replace function pg_temp._canonicalize_fixed_bill_key_v2(raw_key text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text := pg_temp._slugify_bill_label_v2(raw_key);
  mapped  text;
begin
  if cleaned is null then
    return raw_key;
  end if;
  select to_key into mapped from _fixed_bill_synonyms_v2 where from_key = cleaned;
  return coalesce(mapped, cleaned);
end;
$$;

-- transactions.category_key (fixed only)
with candidates as (
  select
    id,
    category_key as prev_key,
    case
      when category_key ~ '_[0-9]{10,}$' then category_label
      else category_key
    end as source_value
  from public.transactions
  where category_type = 'fixed'
),
resolved as (
  select
    id,
    prev_key,
    pg_temp._canonicalize_fixed_bill_key_v2(source_value) as next_key
  from candidates
),
changed as (
  select id, prev_key, next_key
  from resolved
  where next_key is not null
    and next_key <> prev_key
)
update public.transactions t
set    category_key = c.next_key
from   changed c
where  t.id = c.id
  and  t.category_key = c.prev_key;

-- fixed_expenses.entries[*].key
with exploded as (
  select
    fe.id as fe_id,
    ord.idx as entry_index,
    elem as entry,
    elem->>'key'   as prev_key,
    elem->>'label' as label_value
  from public.fixed_expenses fe
  cross join lateral jsonb_array_elements(coalesce(fe.entries, '[]'::jsonb))
    with ordinality as ord(elem, idx)
),
resolved as (
  select
    fe_id,
    entry_index,
    entry,
    prev_key,
    pg_temp._canonicalize_fixed_bill_key_v2(
      case
        when prev_key is null then label_value
        when prev_key ~ '_[0-9]{10,}$' then coalesce(label_value, prev_key)
        else prev_key
      end
    ) as next_key
  from exploded
),
changed as (
  select *
  from resolved
  where prev_key is not null
    and next_key is not null
    and next_key <> prev_key
),
rebuilt as (
  select
    fe.id as fe_id,
    jsonb_agg(
      case
        when c.next_key is not null
          then jsonb_set(e.elem, '{key}', to_jsonb(c.next_key), true)
        else e.elem
      end
      order by e.idx
    ) as new_entries
  from public.fixed_expenses fe
  cross join lateral jsonb_array_elements(coalesce(fe.entries, '[]'::jsonb))
    with ordinality as e(elem, idx)
  left join changed c
    on c.fe_id = fe.id
   and c.entry_index = e.idx
  where exists (select 1 from changed c2 where c2.fe_id = fe.id)
  group by fe.id
)
update public.fixed_expenses fe
set    entries = r.new_entries
from   rebuilt r
where  fe.id = r.fe_id;

-- item_dictionary.category_key (fixed only)
update public.item_dictionary d
set    category_key = pg_temp._canonicalize_fixed_bill_key_v2(d.category_key)
where  d.category_type = 'fixed'
  and  d.category_key is not null
  and  pg_temp._canonicalize_fixed_bill_key_v2(d.category_key) <> d.category_key;

commit;
