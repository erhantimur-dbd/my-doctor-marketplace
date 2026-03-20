-- ============================================================
-- CLINIC LOCATIONS
-- Multi-branch support for Clinic tier organizations.
-- Each org (clinic) can have multiple physical locations/branches.
-- ============================================================

CREATE TABLE public.clinic_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- e.g. "City Centre Branch", "West End Clinic"
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  country_code TEXT DEFAULT 'GB',
  postal_code TEXT,
  phone TEXT,
  email TEXT,
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinic_locations_org ON public.clinic_locations(organization_id);
CREATE INDEX idx_clinic_locations_org_active ON public.clinic_locations(organization_id, is_active)
  WHERE is_active = TRUE;

CREATE TRIGGER trg_clinic_locations_updated_at
BEFORE UPDATE ON public.clinic_locations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Ensure at most one primary location per org
CREATE UNIQUE INDEX idx_clinic_locations_primary
  ON public.clinic_locations(organization_id)
  WHERE is_primary = TRUE;

-- ============================================================
-- DOCTOR LOCATION ASSIGNMENTS
-- Many-to-many: a doctor can work at multiple clinic locations.
-- ============================================================

CREATE TABLE public.doctor_location_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  clinic_location_id UUID NOT NULL REFERENCES public.clinic_locations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(doctor_id, clinic_location_id)
);

CREATE INDEX idx_doctor_loc_assignments_doctor ON public.doctor_location_assignments(doctor_id);
CREATE INDEX idx_doctor_loc_assignments_location ON public.doctor_location_assignments(clinic_location_id);
CREATE INDEX idx_doctor_loc_assignments_org ON public.doctor_location_assignments(organization_id);

-- ============================================================
-- ADD clinic_location_id TO availability_schedules
-- Allows per-location weekly schedules:
--   e.g. Dr. Smith Mon/Tue at City Centre, Thu/Fri at West End
-- ============================================================

ALTER TABLE public.availability_schedules
  ADD COLUMN IF NOT EXISTS clinic_location_id UUID
    REFERENCES public.clinic_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_avail_schedules_clinic_location
  ON public.availability_schedules(clinic_location_id)
  WHERE clinic_location_id IS NOT NULL;

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE public.clinic_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_location_assignments ENABLE ROW LEVEL SECURITY;

-- Public can read active clinic locations (for public clinic page)
CREATE POLICY "Public can read active clinic locations"
  ON public.clinic_locations FOR SELECT
  USING (is_active = TRUE);

-- Org members can read all locations (including inactive) for their org
CREATE POLICY "Org members can read own clinic locations"
  ON public.clinic_locations FOR SELECT
  USING (
    organization_id IN (SELECT public.get_user_org_ids())
  );

-- Owners and admins can manage locations
CREATE POLICY "Owners and admins can insert clinic locations"
  ON public.clinic_locations FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can update clinic locations"
  ON public.clinic_locations FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Platform admins have full access
CREATE POLICY "Platform admins manage all clinic locations"
  ON public.clinic_locations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Doctor location assignments: org members can read
CREATE POLICY "Org members can read doctor location assignments"
  ON public.doctor_location_assignments FOR SELECT
  USING (
    organization_id IN (SELECT public.get_user_org_ids())
  );

-- Public can read active assignments (for clinic page doctor-location display)
CREATE POLICY "Public can read active doctor location assignments"
  ON public.doctor_location_assignments FOR SELECT
  USING (is_active = TRUE);

-- Owners and admins can manage assignments
CREATE POLICY "Owners and admins can manage doctor location assignments"
  ON public.doctor_location_assignments FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Platform admins
CREATE POLICY "Platform admins manage all doctor location assignments"
  ON public.doctor_location_assignments FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- RPC: Get doctors for a clinic location (for public page)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_clinic_location_doctors(p_clinic_location_id UUID)
RETURNS TABLE(
  doctor_id UUID,
  profile_id UUID,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  slug TEXT,
  specialty_name TEXT,
  consultation_fee INT,
  next_available_at TIMESTAMPTZ
) AS $$
  SELECT
    d.id                  AS doctor_id,
    d.profile_id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    d.slug,
    s.name                AS specialty_name,
    d.consultation_fee,
    NULL::TIMESTAMPTZ     AS next_available_at   -- populated by app layer
  FROM public.doctor_location_assignments dla
  JOIN public.doctors d ON d.id = dla.doctor_id
  JOIN public.profiles p ON p.id = d.profile_id
  LEFT JOIN public.specialties s ON s.id = d.specialty_id
  WHERE dla.clinic_location_id = p_clinic_location_id
    AND dla.is_active = TRUE
    AND d.is_active = TRUE
$$ LANGUAGE sql STABLE SECURITY DEFINER;
