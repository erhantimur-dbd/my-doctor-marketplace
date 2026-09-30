import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "")
    .trim();
}

const migrationPath = "supabase/migrations/00134_drop_public_org_basics_policy.sql";
const migration = read(migrationPath);

/**
 * Files that still name the organizations table. Each one is a member,
 * platform-admin, or service-role path. A new hit outside this list fails
 * the scan below: public and non-member reads belong on public_organizations
 * or on the service-role client.
 */
const organizationsTableReaders = [
  "src/actions/admin.ts",
  "src/actions/auth.ts",
  "src/actions/doctor.ts",
  "src/actions/license.ts",
  "src/actions/organization.ts",
  "src/actions/payment-corrections.ts",
  "src/app/[locale]/(admin)/admin/licenses/[id]/page.tsx",
  "src/app/[locale]/(admin)/admin/licenses/page.tsx",
  "src/app/[locale]/(admin)/admin/organizations/[id]/page.tsx",
  "src/app/[locale]/(admin)/admin/organizations/page.tsx",
  "src/app/[locale]/(doctor)/doctor-dashboard/clinic-onboarding/clinic-onboarding-wizard.tsx",
  "src/app/[locale]/(doctor)/doctor-dashboard/clinic-onboarding/page.tsx",
  "src/app/[locale]/(doctor)/doctor-dashboard/organization/locations/page.tsx",
  "src/app/[locale]/(doctor)/doctor-dashboard/page.tsx",
  "src/hooks/use-user.ts",
  "src/lib/auth/bootstrap-doctor.ts",
] as const;

const ORG_READ =
  /from\(["']organizations["']\)|organization:organizations\(/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__") continue;
    const full = join(dir, entry);
    const rel = full.slice(process.cwd().length + 1);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) out.push(rel);
  }
  return out;
}

describe("00134 drop public org basics", () => {
  it("drops only that policy and is safe to run twice", () => {
    const sql = stripComments(migration);
    expect(sql).toBe(
      'DROP POLICY IF EXISTS "Public can read org basics" ON public.organizations;'
    );
    expect(migration).toMatch(/DROP POLICY IF EXISTS/);
    expect(migration).not.toMatch(/\bREVOKE\b/);
    expect(migration).not.toMatch(/\bGRANT\b/);
    expect(migration).not.toMatch(/\bCREATE\b/);
    expect(migration).not.toMatch(/\bALTER\b/);
    expect(migration).not.toMatch(/\bUPDATE\b/);
    expect(migration).not.toMatch(/\bINSERT\b/);
    expect(migration).not.toMatch(/\bDELETE\b/);
    expect(migration).not.toMatch(/organization_members/);
    expect(migration).toContain('"Members can read own organization"');
    expect(migration).toContain('"Owners can update own organization"');
    expect(migration).toContain('"Admins can manage all organizations"');
  });

  it("does not take 00130, 00131, 00132, or 00133", () => {
    expect(migrationPath).toContain("00134_drop_public_org_basics_policy.sql");
  });
});

describe("organizations reads outside PR #91", () => {
  it("keeps every remaining organizations query on the member, admin, or service-role list", () => {
    const hits = walk(join(process.cwd(), "src")).filter((file) =>
      ORG_READ.test(read(file))
    );
    expect(hits.sort()).toEqual([...organizationsTableReaders].sort());
  });

  it("does not let anon or non-member surfaces select the organizations table", () => {
    const publicSurfaces = [
      "src/app/[locale]/(public)/clinics/[slug]/page.tsx",
      "src/app/[locale]/(public)/doctors/[slug]/page.tsx",
      "src/app/[locale]/(public)/doctors/[slug]/book/page.tsx",
      "src/app/[locale]/(public)/invitation/[token]/page.tsx",
      "src/app/[locale]/(public)/invitation/[token]/confirmed/page.tsx",
      "src/app/[locale]/(public)/invite/[token]/page.tsx",
      "src/app/[locale]/(public)/invite/[token]/invite-accept-client.tsx",
      "src/app/sitemap.ts",
      "src/actions/search.ts",
      "src/actions/booking.ts",
      "src/actions/clinic-invitations.ts",
      "src/components/shared/invitation-banner.tsx",
      "src/lib/invitations/load-public-invitation.ts",
    ];

    for (const file of publicSurfaces) {
      expect(read(file), file).not.toMatch(ORG_READ);
    }

    const apiHits = walk(join(process.cwd(), "src/app/api")).filter((file) =>
      ORG_READ.test(read(file))
    );
    expect(apiHits).toEqual([]);
  });

  it("reads the public clinic, invite name, and banner from public_organizations", () => {
    const clinic = read("src/app/[locale]/(public)/clinics/[slug]/page.tsx");
    expect(clinic).toContain('.from("public_organizations")');
    expect(clinic.match(/\.from\("public_organizations"\)/g)).toHaveLength(2);

    const banner = read("src/components/shared/invitation-banner.tsx");
    expect(banner).toContain('.from("public_organizations")');

    const invites = read("src/actions/clinic-invitations.ts");
    const resolver = invites.slice(
      invites.indexOf("export async function resolveInviteToken"),
      invites.indexOf("export async function checkEmailRegistered")
    );
    expect(resolver).toContain('.from("public_organizations")');
    expect(resolver).not.toMatch(ORG_READ);
  });

  it("loads the doctor profile and booking doctor row with the service role and no org embed", () => {
    const profile = read("src/app/[locale]/(public)/doctors/[slug]/page.tsx");
    expect(profile).toContain("createAdminClient()");
    expect(profile).not.toMatch(/organization:organizations/);
    expect(profile).toContain("doctor.clinic_name");

    const book = read("src/app/[locale]/(public)/doctors/[slug]/book/page.tsx");
    expect(book).toContain("createAdminClient()");
    expect(book).toContain("organization_id");
    expect(book).not.toMatch(ORG_READ);

    const search = read("src/actions/search.ts");
    expect(search).toContain("createAdminClient()");
    expect(search).not.toMatch(ORG_READ);

    const sitemap = read("src/app/sitemap.ts");
    expect(sitemap).toContain("createAdminClient()");
    expect(sitemap).not.toMatch(/organizations/);
  });

  it("keeps follow-up token lookup and licensed-doctor search off organization columns", () => {
    const additive = read("supabase/migrations/00128_security_additive.sql");
    const fnStart = additive.indexOf(
      "CREATE OR REPLACE FUNCTION public.get_follow_up_invitation_by_token"
    );
    const fnEnd = additive.indexOf(
      "REVOKE ALL ON FUNCTION public.get_follow_up_invitation_by_token"
    );
    const fn = additive.slice(fnStart, fnEnd);
    expect(fn).not.toMatch(/public\.organizations/);
    expect(fn).toContain("public.doctors");
    expect(fn).toContain("clinic_name");

    const licensed = read(
      "supabase/migrations/00066_remove_legacy_subscription_from_rpc.sql"
    );
    expect(licensed).toContain("get_licensed_doctor_ids");
    expect(licensed).not.toMatch(/organizations/);
    expect(licensed).toContain("JOIN licenses l ON d.organization_id = l.organization_id");
  });

  it("leaves own-org dashboard reads and service-role writes on organizations", () => {
    const ownOrg = read("src/actions/organization.ts");
    expect(ownOrg).toContain('.eq("status", "active")');
    expect(ownOrg).toContain("organization:organizations(*)");
    expect(ownOrg).toContain("createAdminClient()");

    const doctor = read("src/actions/doctor.ts");
    const orgRead = doctor.slice(
      doctor.indexOf("from(\"organizations\")") - 80,
      doctor.indexOf("from(\"organizations\")") + 40
    );
    expect(orgRead).toContain("supabase");
    expect(doctor).toContain("doctor.organization_id");
    expect(doctor).toContain('.eq("status", "active")');

    const boot = read("src/lib/auth/bootstrap-doctor.ts");
    expect(boot).toContain("createAdminClient");
    expect(boot).toContain('.from("organizations")');

    const auth = read("src/actions/auth.ts");
    expect(auth).toContain("adminSupabase");
    expect(auth).toContain('.from("organizations")');

    const hook = read("src/hooks/use-user.ts");
    expect(hook).toContain("organization:organizations(id, name)");
    expect(hook).toContain('.eq("status", "active")');
  });
});
