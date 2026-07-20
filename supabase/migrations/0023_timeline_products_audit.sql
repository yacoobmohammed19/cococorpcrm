-- 0023_timeline_products_audit.sql
-- Supports the unified Timeline view (timestamped progress across leads & products).
--
--  1. Audit dim_products so product create/update/delete lands in activity_log.
--     dim_products was added in 0004, AFTER the audit-trigger list in 0003, so it
--     was never wired up — product changes left no history until now.
--  2. Let the `operator` role READ activity_log. The generic policy from 0002
--     granted owner/admin/member/viewer only, so operators saw an empty History
--     tab on leads (and would see an empty Timeline). Read-only; writes still
--     happen via the SECURITY DEFINER audit trigger.

-- 1. Audit trigger on dim_products (mirrors the wiring in 0003_triggers.sql)
drop trigger if exists trg_audit_dim_products on dim_products;
create trigger trg_audit_dim_products
  after insert or update or delete on dim_products
  for each row execute function audit_trigger();

-- 2. Allow operators to read the audit log
drop policy if exists activity_log_select on activity_log;
create policy activity_log_select on activity_log
  for select using (
    has_org_role(org_id, array['owner','admin','member','viewer','operator'])
  );
