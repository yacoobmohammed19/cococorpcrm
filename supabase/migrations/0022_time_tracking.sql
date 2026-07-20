-- 0022_time_tracking.sql
-- Reusable, entity-agnostic tracking primitives.
--   * time_entries    — time invested against any tracked entity (leads, R&D projects, …)
--   * entity_comments — a lightweight comment / history thread for entities that
--                       don't already have one (leads). R&D keeps its existing
--                       rd_project_updates thread.
--
-- Both tables are keyed by (entity_type, entity_id) so a single code path serves
-- every module while the data stays cleanly partitioned per entity type.

-- ── time_entries ────────────────────────────────────────────────────────────
create table if not exists time_entries (
  id          bigserial primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('lead', 'rd_project')),
  entity_id   bigint not null,
  minutes     integer not null check (minutes > 0),
  note        text,
  spent_on    date not null default current_date,
  author_id   uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);

create index if not exists time_entries_entity_idx on time_entries (org_id, entity_type, entity_id);
create index if not exists time_entries_org_idx    on time_entries (org_id);

alter table time_entries enable row level security;

-- Drop any auto-generated Supabase policies that query auth.users (they cause 403s)
drop policy if exists org_insert          on time_entries;
drop policy if exists org_isolation       on time_entries;
drop policy if exists read_time_entries   on time_entries;
drop policy if exists write_time_entries  on time_entries;
drop policy if exists delete_time_entries on time_entries;

create policy read_time_entries on time_entries
  for select using (has_org_role(org_id, array['owner','admin','member','viewer','operator']));

create policy write_time_entries on time_entries
  for insert with check (has_org_role(org_id, array['owner','admin','member','operator']));

create policy delete_time_entries on time_entries
  for delete using (
    author_id = auth.uid()
    or has_org_role(org_id, array['owner','admin'])
  );

create trigger time_entries_audit
  after insert or update or delete on time_entries
  for each row execute function audit_trigger();

-- ── entity_comments ─────────────────────────────────────────────────────────
create table if not exists entity_comments (
  id          bigserial primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('lead', 'rd_project')),
  entity_id   bigint not null,
  content     text not null,
  author_id   uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);

create index if not exists entity_comments_entity_idx on entity_comments (org_id, entity_type, entity_id);

alter table entity_comments enable row level security;

drop policy if exists org_insert             on entity_comments;
drop policy if exists org_isolation          on entity_comments;
drop policy if exists read_entity_comments   on entity_comments;
drop policy if exists write_entity_comments  on entity_comments;
drop policy if exists delete_entity_comments on entity_comments;

create policy read_entity_comments on entity_comments
  for select using (has_org_role(org_id, array['owner','admin','member','viewer','operator']));

create policy write_entity_comments on entity_comments
  for insert with check (has_org_role(org_id, array['owner','admin','member','operator']));

create policy delete_entity_comments on entity_comments
  for delete using (
    author_id = auth.uid()
    or has_org_role(org_id, array['owner','admin'])
  );

create trigger entity_comments_audit
  after insert or update or delete on entity_comments
  for each row execute function audit_trigger();
