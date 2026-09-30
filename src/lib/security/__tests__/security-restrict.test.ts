import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const invitations = read("supabase/migrations/00130_security_restrict.sql");
const clinic = read("supabase/migrations/00131_clinic_invitations_restrict.sql");

describe("00130 follow_up_invitations and organizations", () => {
  it("drops repo and Production policies before recreating the final set", () => {
    for (const name of [
      "read_invitations",
      "Participants read invitations",
      "Service role manages invitations",
      "doctor_manage_own_invitations",
      "doctor_update_own_invitations",
      "patient_update_own_invitations",
    ]) {
      expect(invitations).toContain(
        `DROP POLICY IF EXISTS "${name}" ON public.follow_up_invitations`
      );
    }
    expect(invitations).toContain(
      'CREATE POLICY "Participants read invitations" ON public.follow_up_invitations'
    );
    expect(invitations).toMatch(/patient_id = \(SELECT auth\.uid\(\)\)/);
    expect(invitations).toContain("public.rls_is_own_doctor(doctor_id)");
    expect(invitations).toMatch(
      /CREATE POLICY "Service role manages invitations"[\s\S]*TO service_role[\s\S]*WITH CHECK \(true\)/
    );
    expect(invitations).not.toMatch(/CREATE POLICY "patient_update_own_invitations"/);
    expect(invitations).not.toMatch(/CREATE POLICY "read_invitations"/);
    expect(invitations).not.toMatch(/CREATE POLICY "doctor_manage_own_invitations"/);
  });

  it("rejects a doctor user-client INSERT and keeps doctor UPDATE", () => {
    const doctor = invitations.slice(
      invitations.indexOf('CREATE POLICY "doctor_update_own_invitations"'),
      invitations.indexOf('CREATE POLICY "Service role manages invitations"')
    );
    expect(doctor).toMatch(/FOR UPDATE/);
    expect(doctor).toMatch(/WITH CHECK \(public\.rls_is_own_doctor\(doctor_id\)\)/);
    expect(doctor).not.toMatch(/FOR ALL/);
    expect(doctor).not.toMatch(/FOR INSERT/);
    expect(invitations).not.toMatch(
      /ON public\.follow_up_invitations\s+FOR INSERT/
    );
    expect(invitations).toContain(
      "follow_up_invitations rejects a doctor user-client INSERT; only service_role may insert"
    );
    expect(invitations).toContain("pol.polcmd IN ('a', '*')");
    expect(invitations).toContain("rolname = 'service_role'");
  });

  it("limits organization SELECT to members and admins and checks owner updates", () => {
    expect(invitations).toContain(
      'DROP POLICY IF EXISTS "Public can read org basics" ON public.organizations'
    );
    expect(invitations).toContain(
      'CREATE POLICY "Members can read own organization" ON public.organizations'
    );
    expect(invitations).toContain("public.get_user_org_ids()");
    expect(invitations).toContain(
      'CREATE POLICY "Admins can manage all organizations" ON public.organizations'
    );
    expect(invitations).toContain("public.rls_is_admin()");
    expect(invitations).toMatch(
      /CREATE POLICY "Owners can update own organization"[\s\S]*WITH CHECK \(/
    );
    expect(invitations).toContain("DROP INDEX IF EXISTS public.idx_organizations_slug");
  });
});

describe("00131 clinic invitations", () => {
  it("drops the anon token policy and does not recreate it", () => {
    expect(clinic).toContain(
      'DROP POLICY IF EXISTS "Anyone can read pending invitations by token"'
    );
    expect(clinic).toContain("ON public.clinic_invitations");
    expect(clinic).not.toMatch(/CREATE POLICY/);
    expect(clinic).not.toMatch(/USING \(true\)/);
    expect(clinic).not.toMatch(/status = 'pending'/);
  });
});
