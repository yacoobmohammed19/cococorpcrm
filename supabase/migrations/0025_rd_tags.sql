-- 0025_rd_tags.sql - project tags
--
-- A classification axis for R&D projects that is SEPARATE from status (the Kanban
-- swimlane / workflow state). Tags describe *what kind* of project it is
-- (e.g. Consulting, Product, Internal) and are many-to-many: a project can carry
-- several. Managed org-wide like rd_statuses.

create table if not exists rd_tags (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz default now()
);

-- NB: needs a surrogate `id` — the shared audit_trigger() reads NEW.id / OLD.id,
-- so a composite-PK-only table breaks on insert. Uniqueness is kept via a
-- separate unique constraint on (project_id, tag_id).
create table if not exists rd_project_tags (
  id bigserial primary key,
  project_id bigint not null references rd_projects(id) on delete cascade,
  tag_id bigint not null references rd_tags(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz default now(),
  unique (project_id, tag_id)
);

create index if not exists rd_project_tags_tag_idx on rd_project_tags (tag_id);
create index if not exists rd_project_tags_org_idx on rd_project_tags (org_id, project_id);

-- RLS: rd_tags
alter table rd_tags enable row level security;
drop policy if exists rd_tags_select on rd_tags;
drop policy if exists rd_tags_insert on rd_tags;
drop policy if exists rd_tags_update on rd_tags;
drop policy if exists rd_tags_delete on rd_tags;
create policy rd_tags_select on rd_tags for select using (has_org_role(org_id, array['owner','admin','member','viewer']));
create policy rd_tags_insert on rd_tags for insert with check (has_org_role(org_id, array['owner','admin','member']));
create policy rd_tags_update on rd_tags for update using (has_org_role(org_id, array['owner','admin','member'])) with check (has_org_role(org_id, array['owner','admin','member']));
create policy rd_tags_delete on rd_tags for delete using (has_org_role(org_id, array['owner','admin']));

-- RLS: rd_project_tags (assignments - member+ can attach/detach)
alter table rd_project_tags enable row level security;
drop policy if exists rd_project_tags_select on rd_project_tags;
drop policy if exists rd_project_tags_insert on rd_project_tags;
drop policy if exists rd_project_tags_delete on rd_project_tags;
create policy rd_project_tags_select on rd_project_tags for select using (has_org_role(org_id, array['owner','admin','member','viewer']));
create policy rd_project_tags_insert on rd_project_tags for insert with check (has_org_role(org_id, array['owner','admin','member']));
create policy rd_project_tags_delete on rd_project_tags for delete using (has_org_role(org_id, array['owner','admin','member']));

-- Drop auto-generated Supabase policies that query auth.users (cause 403s)
drop policy if exists org_insert on rd_tags;
drop policy if exists org_isolation on rd_tags;
drop policy if exists org_insert on rd_project_tags;
drop policy if exists org_isolation on rd_project_tags;

-- Audit triggers
create trigger rd_tags_audit after insert or update or delete on rd_tags for each row execute function audit_trigger();
create trigger rd_project_tags_audit after insert or update or delete on rd_project_tags for each row execute function audit_trigger();
