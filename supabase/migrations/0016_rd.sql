-- 0016_rd.sql — R&D / product-development board

create table if not exists rd_statuses (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  color text not null default '#10b981',
  position integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists rd_projects (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  status_id bigint references rd_statuses(id) on delete set null,
  target_date date,
  assigned_to uuid,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  budget_estimate numeric(14, 2),
  notes text,
  product_id bigint references dim_products(id) on delete set null,
  finalized_at timestamptz,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- RLS: rd_statuses
alter table rd_statuses enable row level security;
drop policy if exists rd_statuses_select on rd_statuses;
drop policy if exists rd_statuses_insert on rd_statuses;
drop policy if exists rd_statuses_update on rd_statuses;
drop policy if exists rd_statuses_delete on rd_statuses;
create policy rd_statuses_select on rd_statuses for select using (has_org_role(org_id, array['owner','admin','member','viewer']));
create policy rd_statuses_insert on rd_statuses for insert with check (has_org_role(org_id, array['owner','admin','member']));
create policy rd_statuses_update on rd_statuses for update using (has_org_role(org_id, array['owner','admin','member'])) with check (has_org_role(org_id, array['owner','admin','member']));
create policy rd_statuses_delete on rd_statuses for delete using (has_org_role(org_id, array['owner','admin']));

-- RLS: rd_projects
alter table rd_projects enable row level security;
drop policy if exists rd_projects_select on rd_projects;
drop policy if exists rd_projects_insert on rd_projects;
drop policy if exists rd_projects_update on rd_projects;
drop policy if exists rd_projects_delete on rd_projects;
create policy rd_projects_select on rd_projects for select using (has_org_role(org_id, array['owner','admin','member','viewer']));
create policy rd_projects_insert on rd_projects for insert with check (has_org_role(org_id, array['owner','admin','member']));
create policy rd_projects_update on rd_projects for update using (has_org_role(org_id, array['owner','admin','member'])) with check (has_org_role(org_id, array['owner','admin','member']));
create policy rd_projects_delete on rd_projects for delete using (has_org_role(org_id, array['owner','admin']));

-- Drop auto-generated Supabase policies that query auth.users (causes 403)
drop policy if exists org_insert on rd_statuses;
drop policy if exists org_isolation on rd_statuses;
drop policy if exists org_insert on rd_projects;
drop policy if exists org_isolation on rd_projects;

-- Audit triggers
create trigger rd_statuses_audit after insert or update or delete on rd_statuses for each row execute function audit_trigger();
create trigger rd_projects_audit after insert or update or delete on rd_projects for each row execute function audit_trigger();
