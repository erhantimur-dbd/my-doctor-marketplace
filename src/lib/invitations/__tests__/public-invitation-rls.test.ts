import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  loadPublicFollowUpInvitation,
  toPublicFollowUpInvitation,
  type PublicInvitationRpcClient,
} from "@/lib/invitations/load-public-invitation";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const publicRow = {
  id: "inv-1",
  status: "pending",
  expires_at: "2026-10-14T00:00:00.000Z",
  consultation_type: "video",
  discount_type: "percentage",
  discount_value: 10,
  unit_price_cents: 8000,
  total_sessions: 3,
  discounted_total_cents: 21600,
  service_name: "Follow-up",
  duration_minutes: 30,
  platform_fee_cents: 0,
  currency: "gbp",
  doctor_note: "Please book the morning.",
  sessions_booked: 0,
  patient_id: "patient-secret",
  token: "raw-token",
  stripe_checkout_session_id: "cs_secret",
  stripe_payment_intent_id: "pi_secret",
  doctor: {
    id: "doc-1",
    title: "Dr.",
    clinic_name: "Harbour Clinic",
    stripe_account_id: "acct_secret",
    address: "1 Secret Street",
    profile: {
      first_name: "Ada",
      last_name: "Lovelace",
      avatar_url: "https://example.com/ada.png",
    },
    location: { city: "London" },
  },
};

describe("createFollowUpInvitation writes fees with the service role", () => {
  const action = read("src/actions/follow-up.ts");
  const body = action.slice(
    action.indexOf("export async function createFollowUpInvitation"),
    action.indexOf("export async function getFollowUpInvitationByToken")
  );

  it("authorises the doctor and the patient, then inserts the computed fees", () => {
    expect(body).toContain("requireDoctor()");
    expect(body).toContain('.eq("doctor_id", doctor.id)');
    expect(body).toContain('.eq("patient_id", parsed.data.patient_id)');
    expect(body).toContain("const platformFeeCents = 0");
    expect(body).toContain("const discountedTotalCents = Math.max(0, subtotalCents - discountCents)");

    const feesAt = body.indexOf("const platformFeeCents = 0");
    const adminAt = body.indexOf("const admin = createAdminClient()");
    const insertAt = body.indexOf('admin\n      .from("follow_up_invitations")\n      .insert(');
    expect(feesAt).toBeGreaterThan(0);
    expect(adminAt).toBeGreaterThan(feesAt);
    expect(insertAt).toBeGreaterThan(adminAt);
    expect(body).toContain("platform_fee_cents: platformFeeCents");
    expect(body).toContain("discounted_total_cents: discountedTotalCents");
    expect(body).toContain("doctor_id: doctor.id");
    expect(body).not.toMatch(
      /supabase\s*\.from\("follow_up_invitations"\)\s*\.insert\(/
    );
  });

  it("still cancels through the doctor session so the UPDATE policy can allow it", () => {
    const cancel = action.slice(
      action.indexOf("export async function cancelFollowUpInvitation"),
      action.indexOf("export async function getPatientTreatmentPlans")
    );
    expect(cancel).toContain("requireDoctor()");
    expect(cancel).toContain('.update({ status: "cancelled" })');
    expect(cancel).toContain('.eq("doctor_id", doctor.id)');
    expect(cancel).not.toContain("createAdminClient()");
  });
});

describe("public invitation loader", () => {
  it("calls the token RPC and drops columns the page does not render", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: publicRow, error: null });
    const from = vi.fn();
    const supabase: PublicInvitationRpcClient & { from: typeof from } = {
      rpc,
      from,
    };

    const invitation = await loadPublicFollowUpInvitation(supabase, "tok_123");

    expect(rpc).toHaveBeenCalledWith("get_follow_up_invitation_by_token", {
      p_token: "tok_123",
    });
    expect(from).not.toHaveBeenCalled();
    expect(invitation).toMatchObject({
      id: "inv-1",
      service_name: "Follow-up",
      doctor_note: "Please book the morning.",
      unit_price_cents: 8000,
      sessions_booked: 0,
      doctor: {
        id: "doc-1",
        clinic_name: "Harbour Clinic",
        profile: { first_name: "Ada", last_name: "Lovelace" },
        location: { city: "London" },
      },
    });
    expect(invitation).not.toHaveProperty("patient_id");
    expect(invitation).not.toHaveProperty("token");
    expect(invitation).not.toHaveProperty("stripe_checkout_session_id");
    expect(invitation).not.toHaveProperty("stripe_payment_intent_id");
    expect(invitation?.doctor).not.toHaveProperty("stripe_account_id");
    expect(invitation?.doctor).not.toHaveProperty("address");
  });

  it("returns null when the token misses or the RPC errors", async () => {
    const missing = vi.fn().mockResolvedValue({ data: null, error: null });
    expect(await loadPublicFollowUpInvitation({ rpc: missing }, "nope")).toBeNull();

    const failed = vi
      .fn()
      .mockResolvedValue({ data: publicRow, error: { message: "denied" } });
    expect(await loadPublicFollowUpInvitation({ rpc: failed }, "tok")).toBeNull();
    expect(toPublicFollowUpInvitation({ id: "only" })).toBeNull();
  });
});

describe("public invitation pages use the RPC loader", () => {
  const page = read("src/app/[locale]/(public)/invitation/[token]/page.tsx");
  const confirmed = read(
    "src/app/[locale]/(public)/invitation/[token]/confirmed/page.tsx"
  );
  const action = read("src/actions/follow-up.ts");

  it("loads the invitation page and confirmed page through the RPC", () => {
    for (const source of [page, confirmed]) {
      expect(source).toContain("loadPublicFollowUpInvitation");
      expect(source).not.toMatch(/from\("follow_up_invitations"\)\s*\.select/);
    }
    expect(page).toContain("inv.doctor_note");
    expect(page).toContain("inv.unit_price_cents");
    expect(page).toContain("doctorProfile?.avatar_url");
    expect(confirmed).toContain("inv.sessions_booked");
    expect(confirmed).toContain("inv.service_name");
  });

  it("token action reads through the RPC and still expires via the service role", () => {
    const body = action.slice(
      action.indexOf("export async function getFollowUpInvitationByToken"),
      action.indexOf("export async function createInvitationCheckout")
    );
    expect(body).toContain("loadPublicFollowUpInvitation");
    expect(body).not.toMatch(/\.select\(/);
    expect(body).toContain("createAdminClient()");
    expect(body).toContain('.from("follow_up_invitations")');
    expect(body).toContain('update({ status: "expired" })');
  });
});

describe("organization readers", () => {
  const readers: { file: string; publicSurface: boolean }[] = [
    {
      file: "src/app/[locale]/(public)/clinics/[slug]/page.tsx",
      publicSurface: true,
    },
    {
      file: "src/components/shared/invitation-banner.tsx",
      publicSurface: true,
    },
    {
      file: "src/actions/clinic-invitations.ts",
      publicSurface: true,
    },
    { file: "src/actions/license.ts", publicSurface: false },
    { file: "src/actions/admin.ts", publicSurface: false },
    { file: "src/actions/organization.ts", publicSurface: false },
    { file: "src/actions/auth.ts", publicSurface: false },
    { file: "src/actions/payment-corrections.ts", publicSurface: false },
    { file: "src/actions/doctor.ts", publicSurface: false },
    { file: "src/lib/auth/bootstrap-doctor.ts", publicSurface: false },
    { file: "src/hooks/use-user.ts", publicSurface: false },
    {
      file: "src/app/[locale]/(doctor)/doctor-dashboard/clinic-onboarding/page.tsx",
      publicSurface: false,
    },
    {
      file: "src/app/[locale]/(doctor)/doctor-dashboard/clinic-onboarding/clinic-onboarding-wizard.tsx",
      publicSurface: false,
    },
    {
      file: "src/app/[locale]/(doctor)/doctor-dashboard/organization/locations/page.tsx",
      publicSurface: false,
    },
    {
      file: "src/app/[locale]/(doctor)/doctor-dashboard/page.tsx",
      publicSurface: false,
    },
    {
      file: "src/app/[locale]/(admin)/admin/organizations/page.tsx",
      publicSurface: false,
    },
    {
      file: "src/app/[locale]/(admin)/admin/organizations/[id]/page.tsx",
      publicSurface: false,
    },
    {
      file: "src/app/[locale]/(admin)/admin/licenses/page.tsx",
      publicSurface: false,
    },
    {
      file: "src/app/[locale]/(admin)/admin/licenses/[id]/page.tsx",
      publicSurface: false,
    },
  ];

  it("sends anon and public pages to public_organizations", () => {
    for (const reader of readers.filter((row) => row.publicSurface)) {
      const source = read(reader.file);
      expect(source, reader.file).toContain("public_organizations");
      expect(source, reader.file).not.toMatch(/from\(["']organizations["']\)/);
      expect(source, reader.file).not.toMatch(/organization:organizations\(/);
    }

    const clinic = read("src/app/[locale]/(public)/clinics/[slug]/page.tsx");
    expect(clinic).toContain("logo_url");
    expect(clinic).toContain("cover_image_url");
    expect(clinic).not.toMatch(/org\.(email|phone|stripe_customer_id)/);
    expect(clinic).not.toMatch(/from\(["']organizations["']\)/);

    const invite = read("src/actions/clinic-invitations.ts");
    const resolver = invite.slice(
      invite.indexOf("export async function resolveInviteToken"),
      invite.indexOf("export async function checkEmailRegistered")
    );
    expect(resolver).toContain("public_organizations");
    expect(resolver).toContain('.select("id, name, slug, logo_url")');
    expect(resolver).not.toMatch(/description/);
  });

  it("leaves member, admin, and service-role readers on the organizations table", () => {
    for (const reader of readers.filter((row) => !row.publicSurface)) {
      const source = read(reader.file);
      expect(source, reader.file).toMatch(
        /from\(["']organizations["']\)|organization:organizations\(/
      );
      expect(source, reader.file).not.toContain("public_organizations");
    }
  });
});
