-- Fix invoice statuses: ensure the dim_invoice_statuses table, its RLS policies,
-- and the removal of the legacy status CHECK constraint are all in place.
-- This migration is fully idempotent and self-contained: it does not assume
-- 0019 ran, and it is safe to run more than once.

-- 1. Table (matches 0019)
create table if not exists dim_invoice_statuses (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  color text not null default '#6b7280',
  position integer not null default 0,
  created_at timestamptz default now()
);

-- 2. RLS — aligned with the convention used by the other dim_* tables (see 0002_rls.sql):
--    select: all roles / insert & update: owner+admin+member / delete: owner+admin
alter table dim_invoice_statuses enable row level security;

drop policy if exists dim_invoice_statuses_select on dim_invoice_statuses;
drop policy if exists dim_invoice_statuses_insert on dim_invoice_statuses;
drop policy if exists dim_invoice_statuses_update on dim_invoice_statuses;
drop policy if exists dim_invoice_statuses_delete on dim_invoice_statuses;

create policy dim_invoice_statuses_select on dim_invoice_statuses
  for select using (has_org_role(org_id, array['owner','admin','member','viewer']));

create policy dim_invoice_statuses_insert on dim_invoice_statuses
  for insert with check (has_org_role(org_id, array['owner','admin','member']));

create policy dim_invoice_statuses_update on dim_invoice_statuses
  for update using (has_org_role(org_id, array['owner','admin','member']))
  with check (has_org_role(org_id, array['owner','admin','member']));

create policy dim_invoice_statuses_delete on dim_invoice_statuses
  for delete using (has_org_role(org_id, array['owner','admin']));

-- 3. Remove the legacy hardcoded CHECK constraint so status can be any text value.
--    (Named constraint from 0001_init.sql; also drop dynamically in case the
--     auto-generated name ever differed.)
alter table fact_invoices drop constraint if exists fact_invoices_status_check;

do $$
declare
  c text;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.fact_invoices'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table fact_invoices drop constraint %I', c);
  end loop;
end $$;

-- 4. Seed the default statuses for any org that has none, so the status
--    dropdowns are populated immediately (matches seedDefaults() in the app).
insert into dim_invoice_statuses (org_id, name, color, position)
select o.id, v.name, v.color, v.position
from organizations o
cross join (values
  ('Pending',     '#f59e0b', 0),
  ('Completed',   '#10b981', 1),
  ('Written Off', '#ef4444', 2),
  ('Hold',        '#6366f1', 3)
) as v(name, color, position)
where not exists (
  select 1 from dim_invoice_statuses d where d.org_id = o.id
);
