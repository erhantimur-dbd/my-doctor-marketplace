/**
 * Structural contracts for Medical Testing Services signup / add-on path.
 * Proves shipped wiring: register opt-in → checkout line item + metadata →
 * webhook doctor flag + license_modules; documents post-signup dual-gate gap.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("Medical Testing signup / add-on flow contracts", () => {
  it("register UI offers add-on only for non-free tiers and submits flag", () => {
    const page = read("src/app/[locale]/(public)/register-doctor/page.tsx");
    expect(page).toContain("has_testing_addon");
    expect(page).toMatch(/formData\.set\("has_testing_addon"/);
    expect(page).toMatch(/selectedTier !== "free"/);
    expect(page).toMatch(/Add Medical Testing Services/);
    expect(page).toMatch(/AVAILABLE_MODULES\.find\(\(m\) => m\.key === "medical_testing"\)/);
  });

  it("paid checkout adds testing Stripe line item and metadata when opted in", () => {
    const auth = read("src/actions/auth.ts");
    // createDoctorAccount persists flag on doctors row
    expect(auth).toMatch(/has_testing_addon:\s*hasTestingAddon/);
    // Checkout path
    expect(auth).toContain("getOrCreateTestingAddonPriceId");
    expect(auth).toMatch(/lineItems\.push\(\{\s*price:\s*testingPriceId/);
    expect(auth).toMatch(/has_testing_addon:\s*hasTestingAddon \? "1" : "0"/);
    expect(auth).toMatch(/subscription_data:[\s\S]*has_testing_addon/);
  });

  it("webhook activates doctors.has_testing_addon and license_modules on paid sub", () => {
    const webhook = read("src/app/api/webhooks/stripe/route.ts");
    expect(webhook).toMatch(/has_testing_addon === "1"/);
    expect(webhook).toMatch(/\.update\(\{\s*has_testing_addon:\s*true\s*\}/);
    expect(webhook).toMatch(/module_key:\s*"medical_testing"/);
    expect(webhook).toMatch(/license_modules/);
  });

  it("runtime gates on doctors.has_testing_addon (not license_modules alone)", () => {
    const locations = read("src/actions/testing-locations.ts");
    expect(locations).toContain("has_testing_addon");
    expect(locations).toMatch(/Medical testing add-on not active/);

    const dash = read(
      "src/app/[locale]/(doctor)/doctor-dashboard/medical-testing/page.tsx"
    );
    expect(dash).toMatch(/doctor\.has_testing_addon/);
    expect(dash).toMatch(/Medical Testing Add-on Required/);
  });

  it("post-signup billing toggleModule does not set has_testing_addon or Stripe", () => {
    // Current shipped behaviour: UI Add module only toggles license_modules.
    // This is a known product gap — test locks the real code, not ideal state.
    const license = read("src/actions/license.ts");
    const toggleStart = license.indexOf("export async function toggleModule");
    expect(toggleStart).toBeGreaterThan(-1);
    const toggleBlock = license.slice(toggleStart, toggleStart + 1200);
    expect(toggleBlock).toContain("license_modules");
    expect(toggleBlock).not.toMatch(/has_testing_addon/);
    expect(toggleBlock).not.toMatch(/getOrCreateTestingAddonPriceId|stripe\.|line_items/);
  });

  it("Clinic marketing claims testing included but feature flag is paid tiers only", () => {
    const marketing = read("src/lib/constants/package-features.ts");
    expect(marketing).toMatch(/Medical testing included \(no add-on fee\)/);
    const flags = read("src/lib/utils/feature-flags.ts");
    // hasFeature allows medical_testing for clinic, but product gate is has_testing_addon
    expect(flags).toMatch(
      /medical_testing:\s*\[["']starter["'],\s*["']professional["'],\s*["']clinic["'],\s*["']enterprise["']\]/
    );
    // No auto-grant of has_testing_addon for clinic in webhook when flag absent
    const webhook = read("src/app/api/webhooks/stripe/route.ts");
    const clinicAuto =
      /tier === ["']clinic["'][\s\S]{0,200}has_testing_addon:\s*true/;
    expect(webhook).not.toMatch(clinicAuto);
  });

  it("AVAILABLE_MODULES price is £49 and price helper exists", () => {
    const tiers = read("src/lib/constants/license-tiers.ts");
    expect(tiers).toMatch(/key:\s*"medical_testing"/);
    expect(tiers).toMatch(/priceMonthlyPence:\s*4900/);
    expect(tiers).toContain("export async function getOrCreateTestingAddonPriceId");
    expect(tiers).toMatch(/STRIPE_PRICE_TESTING_ADDON/);
  });
});
