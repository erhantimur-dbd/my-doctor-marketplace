/**
 * Structural contracts for Medical Testing Services signup / add-on path.
 * Asserts fixed behaviour: paid opt-in Checkout, post-signup toggle + flag,
 * clinic include via webhook, no durable free unlock at account create.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasTestingAddonAtAccountCreate,
  shouldChargeTestingAddonAtCheckout,
  shouldGrantTestingAfterLicenseActive,
} from "@/lib/license/medical-testing";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("Medical Testing signup / add-on flow contracts", () => {
  it("register UI: Starter/Pro paid add-on; Clinic included note; not free", () => {
    const page = read("src/app/[locale]/(public)/register-doctor/page.tsx");
    expect(page).toContain("has_testing_addon");
    expect(page).toMatch(/formData\.set\("has_testing_addon"/);
    expect(page).toMatch(/selectedTier === "starter"/);
    expect(page).toMatch(/selectedTier === "professional"/);
    expect(page).toMatch(/Add Medical Testing Services/);
    expect(page).toMatch(/Medical Testing included/);
    expect(page).toMatch(/selectedTier === "clinic"/);
  });

  it("account create never grants durable testing flag (helper + wiring)", () => {
    expect(hasTestingAddonAtAccountCreate()).toBe(false);
    const auth = read("src/actions/auth.ts");
    expect(auth).toContain("hasTestingAddonAtAccountCreate");
    expect(auth).toMatch(/has_testing_addon:\s*hasTestingAddon/);
  });

  it("paid checkout charges testing only via shouldChargeTestingAddonAtCheckout", () => {
    expect(
      shouldChargeTestingAddonAtCheckout({
        tier: "starter",
        formWantsAddon: true,
      })
    ).toBe(true);
    expect(
      shouldChargeTestingAddonAtCheckout({
        tier: "free",
        formWantsAddon: true,
      })
    ).toBe(false);
    expect(
      shouldChargeTestingAddonAtCheckout({
        tier: "clinic",
        formWantsAddon: true,
      })
    ).toBe(false);

    const auth = read("src/actions/auth.ts");
    expect(auth).toContain("shouldChargeTestingAddonAtCheckout");
    expect(auth).toContain("getOrCreateTestingAddonPriceId");
    expect(auth).toMatch(/lineItems\.push\(\{\s*price:\s*testingPriceId/);
    expect(auth).toMatch(/has_testing_addon:\s*hasTestingAddon \? "1" : "0"/);
  });

  it("webhook grants testing via shouldGrantTestingAfterLicenseActive (addon + clinic)", () => {
    expect(
      shouldGrantTestingAfterLicenseActive({
        tier: "clinic",
        metadataHasTestingAddon: false,
      })
    ).toBe(true);
    expect(
      shouldGrantTestingAfterLicenseActive({
        tier: "starter",
        metadataHasTestingAddon: true,
      })
    ).toBe(true);

    const webhook = read("src/app/api/webhooks/stripe/route.ts");
    expect(webhook).toContain("shouldGrantTestingAfterLicenseActive");
    expect(webhook).toMatch(/has_testing_addon:\s*true/);
    expect(webhook).toMatch(/module_key:\s*"medical_testing"/);
  });

  it("runtime gates on doctors.has_testing_addon", () => {
    const locations = read("src/actions/testing-locations.ts");
    expect(locations).toContain("has_testing_addon");
    expect(locations).toMatch(/Medical testing add-on not active/);

    const dash = read(
      "src/app/[locale]/(doctor)/doctor-dashboard/medical-testing/page.tsx"
    );
    expect(dash).toMatch(/doctor\.has_testing_addon/);
    expect(dash).toMatch(/Go to Billing/);
  });

  it("toggleModule medical_testing sets has_testing_addon and Stripe for paid_addon", () => {
    const license = read("src/actions/license.ts");
    const toggleStart = license.indexOf("export async function toggleModule");
    expect(toggleStart).toBeGreaterThan(-1);
    const toggleEnd = license.indexOf(
      "export async function upgradeLicenseTier",
      toggleStart
    );
    const toggleBlock = license.slice(
      toggleStart,
      toggleEnd > toggleStart ? toggleEnd : toggleStart + 8000
    );
    expect(toggleBlock).toContain("medical_testing");
    expect(toggleBlock).toContain("has_testing_addon");
    expect(toggleBlock).toContain("canToggleMedicalTestingModule");
    expect(toggleBlock).toContain("getOrCreateTestingAddonPriceId");
    expect(toggleBlock).toContain("subscriptionItems.create");
    expect(toggleBlock).toMatch(/subscriptionItems\.del/);
  });

  it("AVAILABLE_MODULES price is £49 and price helper exists", () => {
    const tiers = read("src/lib/constants/license-tiers.ts");
    expect(tiers).toMatch(/key:\s*"medical_testing"/);
    expect(tiers).toMatch(/priceMonthlyPence:\s*4900/);
    expect(tiers).toContain("export async function getOrCreateTestingAddonPriceId");
    expect(tiers).toMatch(/STRIPE_PRICE_TESTING_ADDON/);
  });
});
