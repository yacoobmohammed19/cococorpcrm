-- ─────────────────────────────────────────────────────────────────────────────
-- 0014_operator_rls.sql
-- Adds created_by to fact_leads and extends RLS to scope operator access
-- to only the leads they created or were assigned to.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add created_by column to fact_leads
ALTER TABLE fact_leads
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_fact_leads_created_by ON fact_leads(created_by);

-- 2. SELECT: operators see only leads they created OR were assigned to
DROP POLICY IF EXISTS fact_leads_select ON fact_leads;

CREATE POLICY fact_leads_select ON fact_leads
  FOR SELECT USING (
    has_org_role(org_id, ARRAY['owner','admin','member','viewer'])
    OR (
      has_org_role(org_id, ARRAY['operator'])
      AND (created_by = auth.uid() OR assigned_to = auth.uid())
    )
  );

-- 3. INSERT: operators can create their own leads
DROP POLICY IF EXISTS fact_leads_insert ON fact_leads;

CREATE POLICY fact_leads_insert ON fact_leads
  FOR INSERT WITH CHECK (
    has_org_role(org_id, ARRAY['owner','admin','member','viewer','operator'])
  );

-- 4. UPDATE: operators can only update leads they own / are assigned to
DROP POLICY IF EXISTS fact_leads_update ON fact_leads;

CREATE POLICY fact_leads_update ON fact_leads
  FOR UPDATE USING (
    has_org_role(org_id, ARRAY['owner','admin','member','viewer'])
    OR (
      has_org_role(org_id, ARRAY['operator'])
      AND (created_by = auth.uid() OR assigned_to = auth.uid())
    )
  );

-- 5. DELETE (soft-delete): same scoping as UPDATE
DROP POLICY IF EXISTS fact_leads_delete ON fact_leads;

CREATE POLICY fact_leads_delete ON fact_leads
  FOR DELETE USING (
    has_org_role(org_id, ARRAY['owner','admin','member','viewer'])
    OR (
      has_org_role(org_id, ARRAY['operator'])
      AND (created_by = auth.uid() OR assigned_to = auth.uid())
    )
  );
