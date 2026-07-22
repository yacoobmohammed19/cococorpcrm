-- Annual Financial Statements (AFS) line items.
-- A "prepopulate + override + custom" store: the app computes what it can as at
-- each financial year-end; rows here override a standard line or add a custom one.
-- Keyed by (org, fin_year, statement). No double-entry ledger — statutory layout only.
create table if not exists fact_afs_lines (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  fin_year int not null,                 -- year the financial year ENDS (e.g. 2026)
  statement text not null,               -- balance_sheet | income_statement | changes_in_equity | cash_flow | notes
  section text not null,                 -- non_current_assets, current_assets, equity,
                                         --   non_current_liabilities, current_liabilities (BS);
                                         --   expenses, tax (IS); operating, investing, financing (CF)
  line_key text,                         -- stable key for a STANDARD line (ppe, share_capital, tax_expense…);
                                         --   null = free-form custom line
  label text not null,                   -- editable display label
  amount numeric(14,2) not null default 0,
  is_custom boolean not null default false,
  sort int not null default 0,
  note text,
  created_at timestamptz default now(),
  deleted_at timestamptz,
  constraint fact_afs_line_key_uniq unique (org_id, fin_year, statement, line_key)
);

create index if not exists idx_fact_afs_org_year on fact_afs_lines (org_id, fin_year, statement);

-- RLS — mirrors fact_bank_transactions (0005_bank_recon.sql)
alter table fact_afs_lines enable row level security;
drop policy if exists fact_afs_select on fact_afs_lines;
drop policy if exists fact_afs_insert on fact_afs_lines;
drop policy if exists fact_afs_update on fact_afs_lines;
drop policy if exists fact_afs_delete on fact_afs_lines;
create policy fact_afs_select on fact_afs_lines for select using (has_org_role(org_id, array['owner','admin','member','viewer']));
create policy fact_afs_insert on fact_afs_lines for insert with check (has_org_role(org_id, array['owner','admin','member']));
create policy fact_afs_update on fact_afs_lines for update using (has_org_role(org_id, array['owner','admin','member'])) with check (has_org_role(org_id, array['owner','admin','member']));
create policy fact_afs_delete on fact_afs_lines for delete using (has_org_role(org_id, array['owner','admin']));

-- Attach the shared audit trigger (audit_trigger() defined in 0003_triggers.sql)
drop trigger if exists trg_audit_fact_afs_lines on fact_afs_lines;
create trigger trg_audit_fact_afs_lines after insert or update or delete on fact_afs_lines for each row execute function audit_trigger();
