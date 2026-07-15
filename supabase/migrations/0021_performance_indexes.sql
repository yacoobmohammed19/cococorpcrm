-- 0021_performance_indexes.sql
-- Performance: index the hot query paths.
--
-- Every list/dashboard query filters by org_id (and deleted_at IS NULL) and orders
-- by a date column; detail pages filter by foreign keys. Before this migration the
-- schema had only 5 indexes, so these queries were sequential scans across every
-- org's rows. Postgres does NOT auto-index foreign-key columns, hence the FK indexes.
--
-- Partial indexes (WHERE deleted_at IS NULL) match the exact filter used by the app
-- and stay small (archived rows are excluded). All are additive and idempotent.

-- ── fact_invoices ── list, dashboard, billing/accounting aggregation ──────────
create index if not exists idx_fact_invoices_org_txn
  on fact_invoices (org_id, transaction_date desc) where deleted_at is null;
create index if not exists idx_fact_invoices_customer
  on fact_invoices (customer_id);
create index if not exists idx_fact_invoices_payment_type
  on fact_invoices (payment_type_id);

-- ── fact_invoice_lines ── fetched via .in(invoice_id) on customer detail ──────
create index if not exists idx_fact_invoice_lines_invoice
  on fact_invoice_lines (invoice_id);

-- ── fact_costs ── list, P&L aggregation, category/account/customer filters ────
create index if not exists idx_fact_costs_org_txn
  on fact_costs (org_id, transaction_date desc) where deleted_at is null;
create index if not exists idx_fact_costs_category
  on fact_costs (cost_category_id);
create index if not exists idx_fact_costs_account
  on fact_costs (account_id);
create index if not exists idx_fact_costs_customer
  on fact_costs (customer_id);

-- ── fact_leads ── table/kanban/cards views + convert/assign lookups ───────────
create index if not exists idx_fact_leads_org_created
  on fact_leads (org_id, created_at desc) where deleted_at is null;
create index if not exists idx_fact_leads_status
  on fact_leads (status_id);
create index if not exists idx_fact_leads_customer
  on fact_leads (customer_id);

-- ── fact_cashflow ── "latest balance per account" scans (no deleted_at col) ───
create index if not exists idx_fact_cashflow_org_acct_date
  on fact_cashflow (org_id, account_id, record_date desc);

-- ── dim_customers ── largest dimension; org-scoped active list + name order ───
create index if not exists idx_dim_customers_org
  on dim_customers (org_id) where deleted_at is null;
