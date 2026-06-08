-- Add ON DELETE CASCADE to all FK constraints referencing organizations.id
-- so that deleting an org cleans up all its data automatically.
do $$
declare
  r record;
begin
  for r in
    select
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
      and tc.table_schema = kcu.table_schema
      and kcu.ordinal_position = 1
    join information_schema.referential_constraints rc
      on tc.constraint_name = rc.constraint_name
      and tc.table_schema = rc.constraint_schema
    join information_schema.key_column_usage ccu
      on rc.unique_constraint_name = ccu.constraint_name
      and rc.unique_constraint_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_name = 'organizations'
      and ccu.column_name = 'id'
      and tc.table_schema = 'public'
      and rc.delete_rule != 'CASCADE'
  loop
    execute format(
      'alter table %I.%I drop constraint %I',
      r.table_schema, r.table_name, r.constraint_name
    );
    execute format(
      'alter table %I.%I add constraint %I foreign key (%I) references public.organizations(id) on delete cascade',
      r.table_schema, r.table_name, r.constraint_name, r.column_name
    );
  end loop;
end $$;
