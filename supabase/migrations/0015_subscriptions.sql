create table if not exists subscriptions (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  customer_id bigint not null references dim_customers(id) on delete cascade,
  product_id bigint references dim_products(id) on delete set null,
  description text not null,
  amount numeric(14, 2) not null default 0,
  frequency text not null check (frequency in ('weekly', 'monthly', 'quarterly', 'annually')),
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  payment_type_id bigint references dim_payment_types(id) on delete set null,
  invoice_prefix text not null default 'SUB',
  created_at timestamptz default now()
);

alter table subscriptions enable row level security;

drop policy if exists subscriptions_select on subscriptions;
drop policy if exists subscriptions_insert on subscriptions;
drop policy if exists subscriptions_update on subscriptions;
drop policy if exists subscriptions_delete on subscriptions;

create policy subscriptions_select on subscriptions
  for select using (has_org_role(org_id, array['owner','admin','member','viewer']));

create policy subscriptions_insert on subscriptions
  for insert with check (has_org_role(org_id, array['owner','admin','member']));

create policy subscriptions_update on subscriptions
  for update
  using (has_org_role(org_id, array['owner','admin','member']))
  with check (has_org_role(org_id, array['owner','admin','member']));

create policy subscriptions_delete on subscriptions
  for delete using (has_org_role(org_id, array['owner','admin']));

create trigger subscriptions_audit
  after insert or update or delete on subscriptions
  for each row execute function audit_trigger();
