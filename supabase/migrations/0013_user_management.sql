-- ─────────────────────────────────────────────────────────────────────────────
-- 0013_user_management.sql
-- Adds: operator role, assigned_to on fact_leads, invite_tokens table
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend memberships.role to include 'operator'
ALTER TABLE memberships
  DROP CONSTRAINT IF EXISTS memberships_role_check;

ALTER TABLE memberships
  ADD CONSTRAINT memberships_role_check
  CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'operator'));

-- 2. Add assigned_to column to fact_leads for operator scoping
ALTER TABLE fact_leads
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_fact_leads_assigned_to ON fact_leads(assigned_to);

-- 3. Invite tokens table (for user invite flow)
CREATE TABLE IF NOT EXISTS invite_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email      text NOT NULL,
  role       text NOT NULL CHECK (role IN ('admin', 'member', 'viewer', 'operator')),
  token      text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

-- org admins/owners can create and view their own org's invites
CREATE POLICY "invite_tokens_select" ON invite_tokens
  FOR SELECT USING (has_org_role(org_id, ARRAY['owner','admin']));

CREATE POLICY "invite_tokens_insert" ON invite_tokens
  FOR INSERT WITH CHECK (has_org_role(org_id, ARRAY['owner','admin']));

CREATE POLICY "invite_tokens_delete" ON invite_tokens
  FOR DELETE USING (has_org_role(org_id, ARRAY['owner','admin']));
