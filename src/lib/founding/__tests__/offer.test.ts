import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getLicenseTier } from "@/lib/constants/license-tiers";
import { getFeaturesForTier, isFreeLicenseTier } from "@/lib/utils/feature-flags";
import { FOUNDING_OFFER_VALUE_LINE } from "@/lib/constants/company";
import {
  FOUNDING_OFFER_MAX_SPOTS,
  FOUNDING_OFFER_PRICE_PENCE,
  canResubscribeFoundingOffer,
  foundingOfferLicenseMetadata,
  lockedFoundingPricePence,
  mayGrantFoundingLicence,
} from "@/lib/founding/offer";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("founding offer cap", () => {
  it("grants only spots 1 through 100", () => {
    expect(FOUNDING_OFFER_MAX_SPOTS).toBe(100);
    expect(mayGrantFoundingLicence({ claimed: true, foundingNumber: 1 })).toBe(
      true
    );
    expect(
      mayGrantFoundingLicence({ claimed: true, foundingNumber: 100 })
    ).toBe(true);
    expect(
      mayGrantFoundingLicence({ claimed: false, foundingNumber: null })
    ).toBe(false);
    expect(
      mayGrantFoundingLicence({ claimed: true, foundingNumber: 101 })
    ).toBe(false);
    expect(mayGrantFoundingLicence({ claimed: true, foundingNumber: 0 })).toBe(
      false
    );
  });

  it("requires a successful claim in signup before checkout", () => {
    const auth = read("src/actions/auth.ts");
    const checkout = auth.slice(
      auth.indexOf("export async function registerDoctorWithCheckout"),
      auth.indexOf("export async function resumeDoctorLicenseCheckout")
    );
    const claimAt = checkout.indexOf("claimFoundingOfferForCheckout");
    const stripeAt = checkout.indexOf("stripe.customers.create");
    expect(claimAt).toBeGreaterThan(-1);
    expect(stripeAt).toBeGreaterThan(claimAt);
    expect(auth).not.toMatch(/tier:\s*"free"/);
    expect(checkout).toContain("if (!gate.ok) return { error: gate.error }");
  });

  it("webhook refuses a founding licence without a claimed spot", () => {
    const webhook = read("src/app/api/webhooks/stripe/route.ts");
    expect(webhook).toContain("mayGrantFoundingLicence");
    expect(webhook).toContain("subscriptions.cancel");
    expect(webhook).toContain("founding_offer_forfeited_at");
    expect(webhook).toContain("founding_offer_redeemed_at");
  });
});

describe("founding offer price", () => {
  it("is £99 and does not change Starter, Professional, or Clinic list prices", () => {
    expect(FOUNDING_OFFER_PRICE_PENCE).toBe(9900);
    expect(getLicenseTier("founding")?.priceMonthlyPence).toBe(9900);
    expect(getLicenseTier("founding")?.monthlyOnly).toBe(true);
    expect(getLicenseTier("starter")?.priceMonthlyPence).toBe(19900);
    expect(getLicenseTier("professional")?.priceMonthlyPence).toBe(29900);
    expect(getLicenseTier("clinic")?.priceMonthlyPence).toBe(89700);
    expect(isFreeLicenseTier("founding")).toBe(false);
    expect(getFeaturesForTier("founding")).toEqual(
      getFeaturesForTier("professional")
    );
  });

  it("uses STRIPE_PRICE_FOUNDING and does not hardcode a live price id", () => {
    const tiers = read("src/lib/constants/license-tiers.ts");
    const example = read(".env.example");
    expect(tiers).toContain("STRIPE_PRICE_FOUNDING");
    expect(example).toContain("STRIPE_PRICE_FOUNDING");
    expect(tiers).not.toMatch(/price_1[A-Za-z0-9]+/);
    expect(example).not.toMatch(/price_1[A-Za-z0-9]+/);
    expect(getLicenseTier("founding")?.legacyGrantOnly).not.toBe(true);
    expect(getLicenseTier("free")?.legacyGrantOnly).toBe(true);
  });
});

describe("price lock versus cancel forfeit", () => {
  it("keeps £99 while the subscription is active even if the public price changes", () => {
    expect(
      lockedFoundingPricePence({
        subscriptionActive: true,
        publicPricePence: 29900,
      })
    ).toBe(9900);
    expect(
      lockedFoundingPricePence({
        subscriptionActive: false,
        publicPricePence: 9900,
      })
    ).toBeNull();
    expect(foundingOfferLicenseMetadata().price_locked_pence).toBe(9900);
    expect(foundingOfferLicenseMetadata().price_lock).toBe("while_subscribed");
    expect(foundingOfferLicenseMetadata().cancel_forfeits_offer).toBe(true);
  });

  it("blocks another £99 subscription after cancel", () => {
    expect(canResubscribeFoundingOffer({ forfeitedAt: null })).toBe(true);
    expect(canResubscribeFoundingOffer({ forfeitedAt: undefined })).toBe(true);
    expect(
      canResubscribeFoundingOffer({ forfeitedAt: "2026-10-01T00:00:00.000Z" })
    ).toBe(false);
    const grant = read("src/lib/founding/grant.ts");
    expect(grant).toContain("canResubscribeFoundingOffer");
    expect(grant).toContain("mayGrantFoundingLicence");
  });

  it("does not rewrite licences already granted", () => {
    const migration = read("supabase/migrations/00117_founding_offer_99.sql");
    expect(migration).toContain("founding_offer_forfeited_at");
    expect(migration).toContain("founding_offer_redeemed_at");
    expect(migration).toContain("'founding'");
    expect(migration).not.toMatch(/UPDATE\s+public\.licenses/i);
  });
});

describe("founding offer visible copy", () => {
  const surfaces = [
    "public/coming-soon/index.html",
    "src/app/[locale]/(public)/pricing/page.tsx",
    "src/components/marketing/pricing-billing-toggle.tsx",
    "src/app/[locale]/(public)/register-doctor/page.tsx",
    "src/app/[locale]/(public)/register-doctor/layout.tsx",
    "src/lib/seo/json-ld.ts",
  ];

  it("replaces Founding Free, £0, no card, and lifetime free on the public offer", () => {
    for (const rel of surfaces) {
      const text = read(rel);
      expect(text, rel).toMatch(/£99/);
      expect(text, rel).toMatch(/first 100/i);
      expect(text, rel).not.toMatch(/Founding Free/i);
      expect(text, rel).not.toMatch(/£0/);
      expect(text, rel).not.toMatch(/no card/i);
      expect(text, rel).not.toMatch(/lifetime free/i);
      expect(text, rel).not.toMatch(/free forever/i);
    }
    expect(FOUNDING_OFFER_VALUE_LINE).toMatch(/£99 per month/);
    expect(FOUNDING_OFFER_VALUE_LINE).toMatch(/first 100/i);
    expect(FOUNDING_OFFER_VALUE_LINE).not.toMatch(/£0|no card|lifetime free|Founding Free/i);
    expect(read("src/components/marketing/founding-soft-cta-heading.tsx")).toContain(
      "FOUNDING_OFFER_VALUE_LINE"
    );
  });
});
