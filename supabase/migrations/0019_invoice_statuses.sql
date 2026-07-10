-- Dynamic invoice statuses table
create table if not exists dim_invoice_statuses (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  color text not null default '#6b7280',
  position integer not null default 0,
  created_at timestamptz default now()
);

-- RLS
alter table dim_invoice_statuses enable row level security;

create policy dim_invoice_statuses_select on dim_invoice_statuses
  for select using (has_org_role(org_id, array['owner','admin','member','viewer']));

create policy dim_invoice_statuses_insert on dim_invoice_statuses
  for insert with check (has_org_role(org_id, array['owner','admin','member']));

create policy dim_invoice_statuses_update on dim_invoice_statuses
  for update using (has_org_role(org_id, array['owner','admin']));

create policy dim_invoice_statuses_delete on dim_invoice_statuses
  for delete using (has_org_role(org_id, array['owner','admin']));

-- Remove the hardcoded CHECK constraint so status can be any text value
alter table fact_invoices drop constraint if exists fact_invoices_status_check;
