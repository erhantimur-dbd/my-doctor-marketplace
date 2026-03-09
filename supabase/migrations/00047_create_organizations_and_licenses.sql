-- ============================================================
-- ORGANIZATIONS (tenant entity)
-- ============================================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  timezone TEXT DEFAULT 'Europe/London',
  base_currency TEXT NOT NULL DEFAULT 'EUR',
  stripe_customer_id TEXT UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_organizations_slug ON public.organizations(slug);
CREATE INDEX idx_organizations_stripe_customer ON public.organizations(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- ORGANIZATION MEMBERS (user ↔ org with role)
-- ============================================================
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'doctor'
    CHECK (role IN ('owner', 'admin', 'doctor', 'staff')),
  invited_by UUID REFERENCES public.profiles(id),
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited', 'active', 'suspended', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_active ON public.organization_members(organization_id, status)
  WHERE status = 'active';

CREATE TRIGGER trg_org_members_updated_at
BEFORE UPDATE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- LICENSES (replaces doctor_subscriptions conceptually)
-- ============================================================
CREATE TABLE public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'professional', 'clinic', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'past_due', 'grace_period', 'suspended', 'cancelled')),
  max_seats INT NOT NULL DEFAULT 1,
  used_seats INT NOT NULL DEFAULT 0,
  extra_seat_count INT NOT NULL DEFAULT 0,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  grace_period_start TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_licenses_org ON public.licenses(organization_id);
CREATE INDEX idx_licenses_status ON public.licenses(status);
CREATE INDEX idx_licenses_org_status ON public.licenses(organization_id, status);
CREATE INDEX idx_licenses_stripe_sub ON public.licenses(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE TRIGGER trg_licenses_updated_at
BEFORE UPDATE ON public.licenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- LICENSE MODULES (add-on tracking)
-- ============================================================
CREATE TABLE public.license_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  stripe_subscription_item_id TEXT,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(license_id, module_key)
);

CREATE INDEX idx_license_modules_license ON public.license_modules(license_id);

-- ============================================================
-- MODIFY DOCTORS TABLE: Add organization_id
-- ============================================================
ALTER TABLE public.doctors
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

CREATE INDEX idx_doctors_org ON public.doctors(organization_id)
  WHERE organization_id IS NOT NULL;

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_modules ENABLE ROW LEVEL SECURITY;

-- Organizations: members can read their own org
CREATE POLICY "Members can read own organization" ON public.organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Organizations: owners can update their org
CREATE POLICY "Owners can update own organization" ON public.organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
    )
  );

-- Organizations: public can read org name/slug for doctor profiles
CREATE POLICY "Public can read org basics" ON public.organizations
  FOR SELECT USING (true);

-- Organization members: members can read co-members
CREATE POLICY "Members can read org members" ON public.organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Owners/admins can manage members
CREATE POLICY "Owners and admins can insert members" ON public.organization_members
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can update members" ON public.organization_members
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners can delete members" ON public.organization_members
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'owner'
    )
  );

-- Licenses: members can read their org license
CREATE POLICY "Members can read org license" ON public.licenses
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- License modules: members can read
CREATE POLICY "Members can read license modules" ON public.license_modules
  FOR SELECT USING (
    license_id IN (
      SELECT id FROM public.licenses WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- Admin policies for all new tables
CREATE POLICY "Admins can manage all organizations" ON public.organizations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage all org members" ON public.organization_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage all licenses" ON public.licenses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage all license modules" ON public.license_modules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- RPC: Get doctor IDs with valid licenses (for search filtering)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_licensed_doctor_ids()
RETURNS SETOF UUID AS $$
  SELECT d.id
  FROM public.doctors d
  JOIN public.organizations o ON o.id = d.organization_id
  JOIN public.licenses l ON l.organization_id = o.id
  WHERE l.status IN ('active', 'trialing', 'past_due')
  UNION
  -- Legacy fallback: doctors still on old subscription system
  SELECT d.id
  FROM public.doctors d
  JOIN public.doctor_subscriptions ds ON ds.doctor_id = d.id
  WHERE ds.status IN ('active', 'trialing', 'past_due')
    AND d.organization_id IS NULL
$$ LANGUAGE sql STABLE SECURITY DEFINER;
