-- Non-invoice "Other Income" (asset sales, interest, refunds, …)
-- Sibling of fact_costs: positive money-in that raises the system/bank balance
-- and surfaces as its own line in the accounting statements.
create table if not exists fact_income (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  transaction_date date not null,
  amount numeric(14,2) not null,                 -- positive money-in
  description text,
  income_type text not null default 'other',     -- asset_sale | interest | refund | other
  account_id bigint references dim_accounts(id),
  reference text,
  created_at timestamptz default now(),
  deleted_at timestamptz,
  constraint fact_income_type_chk
    check (income_type in ('asset_sale','interest','refund','other'))
);

create index if not exists idx_fact_income_org_date on fact_income (org_id, transaction_date);

-- RLS — mirrors fact_bank_transactions (0005_bank_recon.sql)
alter table fact_income enable row level security;
drop policy if exists fact_income_select on fact_income;
drop policy if exists fact_income_insert on fact_income;
drop policy if exists fact_income_update on fact_income;
drop policy if exists fact_income_delete on fact_income;
create policy fact_income_select on fact_income for select using (has_org_role(org_id, array['owner','admin','member','viewer']));
create policy fact_income_insert on fact_income for insert with check (has_org_role(org_id, array['owner','admin','member']));
create policy fact_income_update on fact_income for update using (has_org_role(org_id, array['owner','admin','member'])) with check (has_org_role(org_id, array['owner','admin','member']));
create policy fact_income_delete on fact_income for delete using (has_org_role(org_id, array['owner','admin']));

-- Attach the shared audit trigger (audit_trigger() defined in 0003_triggers.sql)
drop trigger if exists trg_audit_fact_income on fact_income;
create trigger trg_audit_fact_income after insert or update or delete on fact_income for each row execute function audit_trigger();
