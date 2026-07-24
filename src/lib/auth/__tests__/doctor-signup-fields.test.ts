import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getEnvLicensePriceId,
  getLicenseTier,
} from "@/lib/constants/license-tiers";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("doctor signup field fidelity (H1)", () => {
  it("wizard submits title, years, types, languages, and fees", () => {
    const page = read("src/app/[locale]/(public)/register-doctor/page.tsx");
    for (const key of [
      "title",
      "years_of_experience",
      "consultation_types",
      "languages",
      "consultation_fee",
      "video_fee",
      "currency",
    ]) {
      expect(page).toContain(`formData.set("${key}"`);
    }
  });

  it("createDoctorAccount persists those doctor columns", () => {
    const auth = read("src/actions/auth.ts");
    expect(auth).toMatch(/title,/);
    expect(auth).toContain("years_of_experience");
    expect(auth).toContain("consultation_types");
    expect(auth).toContain("languages");
    expect(auth).toContain("consultation_fee_cents");
    expect(auth).toContain("video_consultation_fee_cents");
    expect(auth).toContain("base_currency");
    // no longer hard-code only zero fee without reading form
    expect(auth).toContain('formData.get("consultation_fee")');
  });
});

describe("license price env helper (H4)", () => {
  it("returns null when env unset", () => {
    const prev = process.env.STRIPE_PRICE_STARTER;
    delete process.env.STRIPE_PRICE_STARTER;
    expect(getEnvLicensePriceId("starter")).toBeNull();
    if (prev !== undefined) process.env.STRIPE_PRICE_STARTER = prev;
  });

  it("reads STRIPE_PRICE_* for known tiers", () => {
    process.env.STRIPE_PRICE_STARTER = "price_test_starter";
    expect(getEnvLicensePriceId("starter")).toBe("price_test_starter");
    delete process.env.STRIPE_PRICE_STARTER;
    expect(getLicenseTier("starter")?.priceMonthlyPence).toBe(19900);
  });
});

describe("referral cold-code + free booking gate", () => {
  it("processReferralSignup accepts referralCode argument", () => {
    const ref = read("src/actions/referral.ts");
    expect(ref).toMatch(/referralCode\?/);
    expect(ref).toContain("referral_code");
  });

  it("webhook invokes processReferralReward", () => {
    const wh = read("src/app/api/webhooks/stripe/route.ts");
    expect(wh).toContain("processReferralReward");
    expect(wh).toContain("max_seats");
  });

  it("booking rejects free tier for online bookings", () => {
    const booking = read("src/actions/booking.ts");
    // Effective licence helper (not raw tier === "free" — free can coexist until webhook)
    expect(booking).toMatch(/licenseAllowsOnlineBookings|pickEffectiveLicense/);
    expect(booking.toLowerCase()).toMatch(/free listing|does not accept online/);
  });

  it("resumeDoctorLicenseCheckout is exported", () => {
    const auth = read("src/actions/auth.ts");
    expect(auth).toMatch(/export async function resumeDoctorLicenseCheckout/);
  });
});
