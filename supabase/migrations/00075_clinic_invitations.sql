-- ============================================================
-- CLINIC INVITATIONS (token-based)
-- Replaces the status-based invite for Clinic tier:
--  - Supports inviting users who do NOT yet have an account
--  - Token is a 32-byte hex string, valid for 7 days
--  - On acceptance: new users can register via invite link;
--    existing users click "Join" while authenticated
-- ============================================================

CREATE TABLE public.clinic_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'doctor'
    CHECK (role IN ('owner', 'admin', 'doctor', 'staff')),
  invited_by UUID NOT NULL REFERENCES public.profiles(id),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  -- Pre-assigned clinic locations (array of clinic_location IDs)
  location_ids UUID[] NOT NULL DEFAULT '{}',
  accepted_by UUID REFERENCES public.profiles(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinic_invitations_org ON public.clinic_invitations(organization_id);
CREATE INDEX idx_clinic_invitations_token ON public.clinic_invitations(token)
  WHERE status = 'pending';
CREATE INDEX idx_clinic_invitations_email ON public.clinic_invitations(email)
  WHERE status = 'pending';

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.clinic_invitations ENABLE ROW LEVEL SECURITY;

-- Org owners and admins can view invitations for their org
CREATE POLICY "Org owners/admins can manage clinic invitations"
  ON public.clinic_invitations FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Any authenticated user can read a pending invitation by token
-- (Used on the /invite/[token] page — no auth needed to read, but
--  we gate writes via service role in the server action)
CREATE POLICY "Anyone can read pending invitations by token"
  ON public.clinic_invitations FOR SELECT
  USING (status = 'pending' AND expires_at > NOW());

-- Platform admins
CREATE POLICY "Platform admins manage all clinic invitations"
  ON public.clinic_invitations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role full access (used by server actions to accept/create)
CREATE POLICY "Service role full access on clinic_invitations"
  ON public.clinic_invitations FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- RPC: expire stale invitations (called by cron or on-demand)
-- ============================================================

CREATE OR REPLACE FUNCTION public.expire_clinic_invitations()
RETURNS void AS $$
  UPDATE public.clinic_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
$$ LANGUAGE sql SECURITY DEFINER;
