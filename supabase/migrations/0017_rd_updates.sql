create table if not exists rd_project_updates (
  id          bigserial primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  project_id  bigint not null references rd_projects(id) on delete cascade,
  content     text not null,
  author_id   uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);

alter table rd_project_updates enable row level security;

drop policy if exists org_insert     on rd_project_updates;
drop policy if exists org_isolation  on rd_project_updates;

create policy "read_rd_updates" on rd_project_updates
  for select using (has_org_role(org_id, array['owner','admin','member','viewer','operator']));

create policy "write_rd_updates" on rd_project_updates
  for insert with check (has_org_role(org_id, array['owner','admin','member']));

create policy "delete_rd_updates" on rd_project_updates
  for delete using (
    author_id = auth.uid()
    or has_org_role(org_id, array['owner','admin'])
  );

create trigger rd_project_updates_audit
  after insert or update or delete on rd_project_updates
  for each row execute function audit_trigger();
