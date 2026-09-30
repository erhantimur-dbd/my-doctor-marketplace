import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const additive = read("supabase/migrations/00128_security_additive.sql");
const bucket = read("supabase/migrations/00129_doctor_media_bucket.sql");

function sliceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("00128 security additive", () => {
  it("does not drop policies, indexes, or grants on existing tables", () => {
    expect(additive).not.toMatch(/^\s*DROP\b/m);
    const revokes = additive.split("\n").filter((line) => /^\s*REVOKE\b/.test(line));
    expect(revokes.length).toBe(3);
    for (const line of revokes) {
      expect(line).toMatch(
        /get_follow_up_invitation_by_token|patient_transition_follow_up_invitation|public_organizations/
      );
      expect(line).not.toMatch(/follow_up_invitations|public\.organizations\b/);
    }
  });

  it("defines a security-definer token lookup with an empty search_path", () => {
    const fn = sliceBetween(
      additive,
      "CREATE OR REPLACE FUNCTION public.get_follow_up_invitation_by_token",
      "REVOKE ALL ON FUNCTION public.get_follow_up_invitation_by_token"
    );
    expect(fn).toMatch(/SECURITY DEFINER/);
    expect(fn).toMatch(/SET search_path = ''/);
    expect(fn).toContain("public.follow_up_invitations");
    expect(fn).toContain("public.doctors");
    expect(fn).toContain("public.profiles");
    expect(fn).toContain("public.locations");
    expect(fn).toContain("pg_catalog.jsonb_build_object");
    expect(fn).not.toMatch(/patient_id/);
    expect(fn).not.toMatch(/stripe_/);
    expect(fn).toContain("'doctor_note'");
    expect(fn).toContain("'unit_price_cents'");
    expect(fn).toContain("'sessions_booked'");
    expect(additive).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_follow_up_invitation_by_token(text) TO anon, authenticated"
    );
  });

  it("limits the patient write to a pending status transition", () => {
    const patientRpc = sliceBetween(
      additive,
      "CREATE OR REPLACE FUNCTION public.patient_transition_follow_up_invitation",
      "REVOKE ALL ON FUNCTION public.patient_transition_follow_up_invitation"
    );
    expect(patientRpc).toMatch(/SECURITY DEFINER/);
    expect(patientRpc).toMatch(/SET search_path = ''/);
    expect(patientRpc).toContain("patient_id = auth.uid()");
    expect(patientRpc).toContain("status = 'pending'");
    expect(patientRpc).toMatch(/p_status NOT IN \('accepted', 'cancelled'\)/);
    expect(patientRpc).not.toMatch(
      /platform_fee_cents|discounted_total_cents|stripe_|sessions_booked|paid_at/
    );
    expect(additive).toContain(
      "GRANT EXECUTE ON FUNCTION public.patient_transition_follow_up_invitation(uuid, text) TO authenticated"
    );
    expect(additive).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.patient_transition_follow_up_invitation\(uuid, text\) TO anon/
    );
  });

  it("freezes both fee columns on update and does not recompute on insert", () => {
    expect(additive).toContain(
      "CREATE OR REPLACE FUNCTION public.enforce_follow_up_invitation_fee_lock()"
    );
    expect(additive).toContain("trg_follow_up_invitation_fee_lock");
    expect(additive).toContain("BEFORE UPDATE ON public.follow_up_invitations");
    expect(additive).not.toMatch(/BEFORE INSERT ON public\.follow_up_invitations/);
    const feeFn = sliceBetween(
      additive,
      "CREATE OR REPLACE FUNCTION public.enforce_follow_up_invitation_fee_lock()",
      "DO $create_fee_trigger$"
    );
    expect(feeFn).toMatch(/SET search_path = ''/);
    expect(feeFn).not.toMatch(/SECURITY DEFINER/);
    expect(feeFn).toContain("platform_fee_cents");
    expect(feeFn).toContain("discounted_total_cents");
    expect(feeFn).toContain("service_role");
    expect(feeFn).toContain("current_user IN ('postgres', 'supabase_admin')");
  });

  it("stops owners changing billing identity columns without blocking other updates", () => {
    const lock = sliceBetween(
      additive,
      "CREATE OR REPLACE FUNCTION public.enforce_organization_protected_columns()",
      "DO $create_org_trigger$"
    );
    expect(lock).toMatch(/SET search_path = ''/);
    expect(lock).not.toMatch(/SECURITY DEFINER/);
    expect(lock).toContain("stripe_customer_id");
    expect(lock).toContain("base_currency");
    expect(lock).toContain("NEW.slug");
    expect(lock).toContain("NEW.metadata");
    expect(lock).toContain("service_role");
    expect(lock).toContain("public.rls_is_admin()");
    expect(lock).toContain("IS NOT DISTINCT FROM");
    expect(additive).toContain("trg_organization_protected_columns");
    expect(additive).toContain("BEFORE UPDATE ON public.organizations");
  });

  it("exposes public branding through a non-invoker view and hides secrets", () => {
    const view = sliceBetween(
      additive,
      "CREATE OR REPLACE VIEW public.public_organizations",
      "ALTER VIEW public.public_organizations OWNER TO postgres"
    );
    expect(view).toContain("security_invoker = false");
    for (const column of [
      "id",
      "name",
      "slug",
      "logo_url",
      "cover_image_url",
      "description",
      "website",
      "specialties",
      "seo_title",
      "seo_description",
      "brand_display_name",
      "brand_primary_color",
      "brand_secondary_color",
      "brand_accent_color",
      "brand_favicon_url",
      "brand_hide_platform_badge",
    ]) {
      expect(view).toContain(column);
    }
    expect(view).not.toMatch(/brand_custom_css/);
    expect(view).not.toMatch(/brand_support_email|brand_support_phone/);
    expect(view).not.toMatch(/stripe_customer_id|address_line1|\bemail\b|\bphone\b/);
    expect(additive).toContain("ALTER VIEW public.public_organizations OWNER TO postgres");
    expect(additive).toContain(
      "ALTER VIEW public.public_organizations SET (security_invoker = false)"
    );
    expect(additive).toContain(
      "REVOKE ALL ON TABLE public.public_organizations FROM PUBLIC"
    );
    expect(additive).toContain(
      "GRANT SELECT ON TABLE public.public_organizations TO anon, authenticated"
    );
    expect(additive).toContain("ADD COLUMN IF NOT EXISTS brand_custom_css");
    expect(additive).not.toContain("idx_organizations_slug");
  });
});

describe("00129 doctor media bucket", () => {
  it("creates the public-read bucket and owner-only write policies without dropping access", () => {
    expect(bucket).not.toMatch(/^\s*DROP\b/m);
    expect(bucket).toContain("'public-read'");
    expect(bucket).toContain("52428800");
    expect(bucket).toContain("'image/jpeg'");
    expect(bucket).toContain("'image/png'");
    expect(bucket).toContain("'image/webp'");
    expect(bucket).toContain("'video/mp4'");
    expect(bucket).toContain("'video/webm'");
    expect(bucket).toContain("'video/quicktime'");
    expect(bucket).toContain("ON CONFLICT (id) DO NOTHING");
    expect(bucket).toContain("auth.uid()::text = (storage.foldername(name))[1]");
    expect(bucket).toContain("FOR INSERT");
    expect(bucket).toContain("WITH CHECK");
    expect(bucket).toContain("FOR UPDATE");
    expect(bucket).toContain("FOR DELETE");
    expect(bucket).toContain("FOR SELECT");
    expect(bucket).toContain("bucket_id = 'public-read'");
    expect(bucket).not.toMatch(/bucket_id = 'public'/);
  });
});
