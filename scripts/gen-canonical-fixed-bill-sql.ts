// One-off generator for supabase/migrations/0012_backfill_fixed_bill_keys.sql.
//
// Reads FIXED_BILL_SYNONYMS from the canonical helper and emits a migration
// whose key-mapping is guaranteed to match the runtime canonicalizer.
// Re-run after editing the synonyms map; check the regenerated file in.
//
// Usage:
//   npx tsx scripts/gen-canonical-fixed-bill-sql.ts

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FIXED_BILL_SYNONYMS } from '../src/lib/fixed-bills/canonical'

const OUT_PATH = resolve(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '0012_backfill_fixed_bill_keys.sql'
)

function sqlEscape(v: string): string {
  return v.replace(/'/g, "''")
}

const pairs = Object.entries(FIXED_BILL_SYNONYMS)
  .map(([from, to]) => `  ('${sqlEscape(from)}', '${sqlEscape(to)}')`)
  .join(',\n')

const sql = `-- ─────────────────────────────────────────────────────────────────────────────
-- 0012 — Backfill fixed-bill canonical keys
--
-- GENERATED from src/lib/fixed-bills/canonical.ts.
-- Do not edit by hand. Re-run scripts/gen-canonical-fixed-bill-sql.ts.
--
-- What this does:
--   - rewrites transactions.category_key for category_type = 'fixed'
--     rows whose key (or label, if key is a slug_timestamp) matches a
--     canonical synonym (wifi → internet, kplc → electricity, ...).
--   - rewrites fixed_expenses.entries[*].key using the same mapping.
--   - leaves labels, non-fixed rows, subscriptions, and unknown keys alone.
--
-- Idempotent: re-running produces zero further changes.
-- Reversible: every UPDATE is wrapped in a CTE that logs before/after into
--   the audit temp table. Rollback by replaying inverse updates from the
--   audit table (see scripts/rollback notes at the bottom of this file).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ── 1. Synonym mapping (generated from canonicalize helper) ─────────────────
create temp table _fixed_bill_synonyms (
  from_key text primary key,
  to_key   text not null
) on commit drop;

insert into _fixed_bill_synonyms (from_key, to_key) values
${pairs};

-- ── 2. Local slugify(text) — mirrors slugifyBillLabel in TS ─────────────────
-- trim → lowercase → non-alphanumerics to '_' → trim leading/trailing '_'
create or replace function pg_temp._slugify_bill_label(src text)
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

-- ── 3. Local canonicalizer — mirrors canonicalizeFixedBillKey ───────────────
-- If cleaned slug is empty, return raw. Else look up synonym, else passthrough.
create or replace function pg_temp._canonicalize_fixed_bill_key(raw_key text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text := pg_temp._slugify_bill_label(raw_key);
  mapped  text;
begin
  if cleaned is null then
    return raw_key;
  end if;
  select to_key into mapped from _fixed_bill_synonyms where from_key = cleaned;
  return coalesce(mapped, cleaned);
end;
$$;

-- ── 4. Audit table (for rollback) ───────────────────────────────────────────
create table if not exists public._canonical_backfill_audit_0012 (
  id              bigserial primary key,
  target          text        not null,   -- 'transactions' | 'fixed_expenses_entries'
  row_id          text        not null,   -- uuid as text
  entry_index     int,                    -- only for fixed_expenses_entries
  prev_key        text        not null,
  next_key        text        not null,
  run_at          timestamptz not null default now()
);

-- ── 5. Backfill transactions.category_key (category_type = 'fixed' only) ────
-- Source rule: prefer category_label when category_key looks like a
-- slug_timestamp fallback (trailing "_<10+digits>"). Otherwise use the key.
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
    pg_temp._canonicalize_fixed_bill_key(source_value) as next_key
  from candidates
),
changed as (
  select id, prev_key, next_key
  from resolved
  where next_key is not null
    and next_key <> prev_key
),
logged as (
  insert into public._canonical_backfill_audit_0012
    (target, row_id, prev_key, next_key)
  select 'transactions', id::text, prev_key, next_key
  from changed
  returning row_id
)
update public.transactions t
set    category_key = c.next_key
from   changed c
where  t.id::text = c.id::text
  and  t.category_key = c.prev_key;

-- ── 6. Backfill fixed_expenses.entries[*].key ───────────────────────────────
-- Entries is jsonb array of objects { key, label, monthly, confidence }.
-- For each element, replace .key with the canonical form. Unknown keys pass
-- through unchanged. Objects without a key field are left alone.
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
    pg_temp._canonicalize_fixed_bill_key(
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
logged as (
  insert into public._canonical_backfill_audit_0012
    (target, row_id, entry_index, prev_key, next_key)
  select 'fixed_expenses_entries', fe_id::text, (entry_index - 1)::int, prev_key, next_key
  from changed
  returning id
),
-- Rebuild the entries array for every fixed_expenses row that had at least
-- one change. Preserve order; only rewrite the .key field.
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

-- ── 7. Summary output (safe no-op if nothing changed) ───────────────────────
do $$
declare
  txn_rows   int;
  entry_rows int;
begin
  select count(*) into txn_rows
    from public._canonical_backfill_audit_0012
    where target = 'transactions' and run_at >= now() - interval '1 minute';
  select count(*) into entry_rows
    from public._canonical_backfill_audit_0012
    where target = 'fixed_expenses_entries' and run_at >= now() - interval '1 minute';
  raise notice 'Backfill 0012: updated % transactions row(s), % fixed_expenses entry(ies).',
    txn_rows, entry_rows;
end
$$;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback (run manually if needed):
--
--   -- 1. Revert transactions
--   update public.transactions t
--   set    category_key = a.prev_key
--   from   public._canonical_backfill_audit_0012 a
--   where  a.target = 'transactions'
--     and  a.row_id = t.id::text
--     and  t.category_key = a.next_key;
--
--   -- 2. Revert fixed_expenses.entries (one row at a time is simplest).
--   --    See the audit table for entry_index → prev_key per row.
-- ─────────────────────────────────────────────────────────────────────────────
`

writeFileSync(OUT_PATH, sql, 'utf8')
console.log(`Wrote ${OUT_PATH} with ${Object.keys(FIXED_BILL_SYNONYMS).length} synonyms.`)
