-- 0012_cost_categorisation.sql
-- Adds cost_type and include_in_pnl to fact_costs, plus two reporting views.

-- ── 1. New columns ────────────────────────────────────────────────────────────
ALTER TABLE fact_costs
  ADD COLUMN IF NOT EXISTS cost_type    text    NOT NULL DEFAULT 'operational',
  ADD COLUMN IF NOT EXISTS include_in_pnl boolean NOT NULL DEFAULT true;

-- ── 2. Backfill existing rows ─────────────────────────────────────────────────
UPDATE fact_costs
SET cost_type = 'operational', include_in_pnl = true;

-- ── 3. CHECK constraint on allowed cost_type values ───────────────────────────
ALTER TABLE fact_costs
  DROP CONSTRAINT IF EXISTS fact_costs_cost_type_check;

ALTER TABLE fact_costs
  ADD CONSTRAINT fact_costs_cost_type_check
  CHECK (cost_type IN ('operational', 'sadaqah', 'zakat', 'owner_draw', 'capex', 'personal'));

-- ── 4. View: operational_pnl ─────────────────────────────────────────────────
-- Returns paid revenue, include_in_pnl costs, and profit grouped by month.
-- security_invoker = true means RLS from the base tables is respected.
DROP VIEW IF EXISTS operational_pnl;

CREATE VIEW operational_pnl
WITH (security_invoker = true)
AS
WITH monthly_revenue AS (
  SELECT
    org_id,
    date_trunc('month', transaction_date)::date AS month,
    COALESCE(SUM(amount) FILTER (WHERE status = 'Completed'), 0) AS revenue
  FROM fact_invoices
  WHERE deleted_at IS NULL
  GROUP BY org_id, date_trunc('month', transaction_date)::date
),
monthly_op_costs AS (
  SELECT
    org_id,
    date_trunc('month', transaction_date)::date AS month,
    COALESCE(SUM(amount), 0) AS operational_costs
  FROM fact_costs
  WHERE deleted_at IS NULL
    AND include_in_pnl = true
  GROUP BY org_id, date_trunc('month', transaction_date)::date
)
SELECT
  COALESCE(r.org_id, c.org_id)  AS org_id,
  COALESCE(r.month, c.month)    AS month,
  COALESCE(r.revenue, 0)        AS revenue,
  COALESCE(c.operational_costs, 0) AS operational_costs,
  COALESCE(r.revenue, 0) - COALESCE(c.operational_costs, 0) AS profit
FROM monthly_revenue r
FULL OUTER JOIN monthly_op_costs c
  ON r.org_id = c.org_id AND r.month = c.month;

-- ── 5. View: costs_by_type ────────────────────────────────────────────────────
-- Aggregates all (non-deleted) costs by cost_type and month.
DROP VIEW IF EXISTS costs_by_type;

CREATE VIEW costs_by_type
WITH (security_invoker = true)
AS
SELECT
  org_id,
  date_trunc('month', transaction_date)::date AS month,
  cost_type,
  COALESCE(SUM(amount), 0) AS total_amount
FROM fact_costs
WHERE deleted_at IS NULL
GROUP BY org_id, date_trunc('month', transaction_date)::date, cost_type;
