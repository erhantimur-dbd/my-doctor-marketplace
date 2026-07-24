/**
 * Structural contracts for the doctor sign-up flow.
 * These tests lock the shipped entry points and bookable gates so the audit
 * stays honest as the flow evolves.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("doctor signup flow contracts", () => {
  it("soft-launch gate allows register-doctor and doctor-dashboard on prod hosts", () => {
    const middleware = read("middleware.ts");
    const vercel = read("vercel.json");
    expect(middleware).toContain('"/register-doctor"');
    expect(middleware).toContain('"/doctor-dashboard"');
    expect(vercel).toMatch(/register-doctor/);
    expect(vercel).toMatch(/doctor-dashboard/);
    // Patient home still gated (no bare "/" allow in COMING_SOON list after soft-launch restore)
    const allowBlock = middleware.slice(
      middleware.indexOf("COMING_SOON_ALLOWED_PREFIXES"),
      middleware.indexOf("COMING_SOON_ROOT_ALLOWED")
    );
    expect(allowBlock).not.toMatch(/"\/",\s*\/\//); // no homepage comment alone
    expect(allowBlock).not.toContain('"/doctors"');
  });

  it("exposes free and paid registration actions sharing account creation", () => {
    const auth = read("src/actions/auth.ts");
    expect(auth).toMatch(/async function createDoctorAccount/);
    expect(auth).toMatch(/export async function registerDoctor\b/);
    expect(auth).toMatch(/export async function registerDoctorWithCheckout\b/);
    expect(auth).toMatch(/supabase\.auth\.signUp/);
    // Free license insert
    expect(auth).toMatch(/tier:\s*"free"/);
    // Paid path creates Stripe Checkout subscription with tier metadata
    expect(auth).toMatch(/mode:\s*"subscription"/);
    expect(auth).toMatch(/checkoutUrl/);
    expect(auth).toMatch(/getOrCreateLicensePriceId/);
    expect(auth).toMatch(/billing_period/);
    // Selected tier lands in Checkout subscription metadata
    expect(auth).toMatch(/tier,/);
  });

  it("register-doctor page wires free vs checkout branches and referral URL", () => {
    const page = read("src/app/[locale]/(public)/register-doctor/page.tsx");
    expect(page).toContain("registerDoctor");
    expect(page).toContain("registerDoctorWithCheckout");
    expect(page).toContain('searchParams.get("ref")');
    expect(page).toContain('searchParams.get("tier")');
    expect(page).toContain("DoctorWaitlistForm");
    // Pricing fields collected in UI but not all submitted — fee state exists
    expect(page).toContain("consultationFee");
    // Submit must set tier for plan branch
    expect(page).toMatch(/formData\.set\("tier"/);
  });

  it("booking path requires verified + Connect + active org license", () => {
    const booking = read("src/actions/booking.ts");
    expect(booking).toContain('verification_status !== "verified"');
    expect(booking).toContain("stripe_onboarding_complete");
    expect(booking).toContain("stripe_account_id");
    expect(booking).toMatch(/status.*active.*trialing.*past_due|in\("status"/);
    // Prefer paid licence when free + paid coexist
    expect(booking).toMatch(/pickEffectiveLicense|licenseAllowsOnlineBookings/);
  });

  it("free→starter checkout is not blocked by active free licence", () => {
    const license = read("src/actions/license.ts");
    expect(license).toMatch(/resolvePaidCheckoutMode/);
    expect(license).toMatch(/upgrade_from_free|upgradeLicenseTier/);
    expect(license).toMatch(/export async function upgradeLicenseTier/);
    // Must not only hard-block all active licences
    expect(license).toMatch(/upgrade_from_free/);
  });

  it("webhook supersedes free licence when paid subscription activates", () => {
    const webhook = read("src/app/api/webhooks/stripe/route.ts");
    expect(webhook).toMatch(/tier.*free/);
    expect(webhook).toMatch(/status:\s*"cancelled"|cancelled_at/);
    expect(webhook).toMatch(/stripe_subscription_id/);
    expect(webhook).toMatch(/metadata\?\.tier|metadata\.tier/);
  });

  it("billing page wires free→paid checkout and paid→paid upgrade", () => {
    const billing = read(
      "src/app/[locale]/(doctor)/doctor-dashboard/organization/billing/page.tsx"
    );
    expect(billing).toContain("createLicenseCheckout");
    expect(billing).toContain("upgradeLicenseTier");
    expect(billing).toContain("resumeDoctorLicenseCheckout");
    expect(billing).toContain("schedulePlanChange");
    expect(billing).toContain("cancelScheduledPlanChange");
    expect(billing).toMatch(/period end|Keep current plan/i);
  });

  it("exposes schedulePlanChange and restores free on subscription delete", () => {
    const license = read("src/actions/license.ts");
    expect(license).toMatch(/export async function schedulePlanChange/);
    expect(license).toMatch(/export async function cancelScheduledPlanChange/);
    expect(license).toMatch(/cancel_at_period_end:\s*true/);

    const webhook = read("src/app/api/webhooks/stripe/route.ts");
    expect(webhook).toMatch(/buildFreeGatewayLicenseInsert|tier.*free/);
    expect(webhook).toMatch(/customer\.subscription\.deleted/);
    expect(webhook).toMatch(/pending_tier|proration_behavior:\s*["']none["']/);
  });

  it("search only lists verified doctors", () => {
    const search = read("src/actions/search.ts");
    expect(search).toMatch(/verification_status["']?\s*,\s*["']?verified|eq\("verification_status", "verified"\)/);
  });

  it("Connect onboarding exists for post-signup payouts", () => {
    const doctor = read("src/actions/doctor.ts");
    expect(doctor).toMatch(/export async function connectStripeAccount/);
    expect(doctor).toMatch(/account_onboarding|accountLinks\.create/);
  });
});
