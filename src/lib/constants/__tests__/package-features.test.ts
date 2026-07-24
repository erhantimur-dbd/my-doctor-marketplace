import { describe, expect, it } from "vitest";
import {
  PACKAGE_MARKETING,
  getPackageMarketing,
  validatePackageMarketingConsistency,
} from "@/lib/constants/package-features";
import { LICENSE_TIERS } from "@/lib/constants/license-tiers";
import {
  hasFeature,
  getFeaturesForTier,
  type LicenseTier,
} from "@/lib/utils/feature-flags";

const TIERS: LicenseTier[] = [
  "free",
  "starter",
  "professional",
  "clinic",
  "enterprise",
];

describe("hasFeature matrix (enforcement)", () => {
  it("free denies bookings, video, AI, WhatsApp, analytics, waitlist", () => {
    expect(hasFeature("online_bookings", "free")).toBe(false);
    expect(hasFeature("video_consultations", "free")).toBe(false);
    expect(hasFeature("ai_review_summaries", "free")).toBe(false);
    expect(hasFeature("whatsapp_notifications", "free")).toBe(false);
    expect(hasFeature("analytics_dashboard", "free")).toBe(false);
    expect(hasFeature("waitlist_auto_notify", "free")).toBe(false);
    expect(getFeaturesForTier("free")).toEqual([]);
  });

  it("starter allows bookings, video, AI, email; denies WhatsApp, waitlist, analytics, care plans", () => {
    expect(hasFeature("online_bookings", "starter")).toBe(true);
    expect(hasFeature("video_consultations", "starter")).toBe(true);
    expect(hasFeature("ai_review_summaries", "starter")).toBe(true);
    expect(hasFeature("email_reminders", "starter")).toBe(true);
    expect(hasFeature("whatsapp_notifications", "starter")).toBe(false);
    expect(hasFeature("waitlist_auto_notify", "starter")).toBe(false);
    expect(hasFeature("analytics_dashboard", "starter")).toBe(false);
    expect(hasFeature("treatment_plans", "starter")).toBe(false);
  });

  it("professional allows waitlist, analytics, WhatsApp, care plans", () => {
    expect(hasFeature("waitlist_auto_notify", "professional")).toBe(true);
    expect(hasFeature("analytics_dashboard", "professional")).toBe(true);
    expect(hasFeature("whatsapp_notifications", "professional")).toBe(true);
    expect(hasFeature("treatment_plans", "professional")).toBe(true);
    expect(hasFeature("multi_location", "professional")).toBe(false);
  });

  it("clinic allows multi-location and team; enterprise allows branding/API", () => {
    expect(hasFeature("multi_location", "clinic")).toBe(true);
    expect(hasFeature("team_management", "clinic")).toBe(true);
    expect(hasFeature("custom_branding", "clinic")).toBe(false);
    expect(hasFeature("custom_branding", "enterprise")).toBe(true);
    expect(hasFeature("api_access", "enterprise")).toBe(true);
  });
});

describe("public packaging copy does not contradict matrix", () => {
  it("package-recommender does not put WhatsApp on Starter; multi → Clinic", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const logic = readFileSync(
      join(process.cwd(), "src/lib/marketing/package-recommender.ts"),
      "utf8"
    );
    // Multi-doctor always Clinic
    expect(logic).toMatch(/practiceSize === "multi"[\s\S]{0,40}return "clinic"/);
    // Extract starter-reason strings only
    const starterBlock = logic.slice(
      logic.indexOf('if (tierId === "starter")'),
      logic.indexOf('return "Founding Free')
    );
    // Must not claim SMS/WhatsApp as included benefits for Starter
    expect(starterBlock).not.toMatch(
      /Starter gives you[^\n]*SMS\/WhatsApp|unlimited bookings[^\n]*SMS\/WhatsApp reminders to (manage|keep)/i
    );
    // If WhatsApp is mentioned, it must be as a later-tier unlock
    if (/whatsapp/i.test(starterBlock)) {
      expect(starterBlock).toMatch(/Professional|later for SMS|come with Professional/i);
    }
  });

  it("coming-soon FAQ lists Free → Starter → Pro solo → Clinic 3–15", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const html = readFileSync(
      join(process.cwd(), "public/coming-soon/index.html"),
      "utf8"
    );
    expect(html).toMatch(/Founding Free \(£0\)/i);
    expect(html).toMatch(/Starter \(£199\/mo\)/i);
    expect(html).toMatch(/Professional \(£299\/mo, 1 doctor\)/i);
    expect(html).toMatch(/Clinic \(£1,495\/mo\)/i);
    expect(html).toMatch(/3 seats included \(expand to 15\)/i);
    expect(html).toMatch(/Solo practice or multi-doctor clinic/i);
    expect(html).not.toMatch(/1–4 doctor|up to 4 seats|per-user multi/i);
  });

  it("EN FAQ doctor-subscription matches package matrix (no Starter WhatsApp, no Clinic branding)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const en = JSON.parse(
      readFileSync(join(process.cwd(), "messages/en.json"), "utf8")
    ) as {
      helpArticles: { "doctor-subscription": { answer: string } };
    };
    const answer = en.helpArticles["doctor-subscription"].answer;
    // Starter section must not claim SMS & WhatsApp as included
    const starterSection = answer.match(
      /<strong>Starter[\s\S]*?(?=<strong>Professional|$)/i
    )?.[0];
    expect(starterSection).toBeTruthy();
    expect(starterSection!).toMatch(/email reminders/i);
    expect(starterSection!).toMatch(/SMS &amp; WhatsApp/i);
    expect(starterSection!).toMatch(/not included/i);
    // Must not say Starter "includes" SMS & WhatsApp without negation nearby
    expect(starterSection!).not.toMatch(
      /and SMS &amp; WhatsApp reminders\./i
    );
    // Clinic must not claim custom branding as included
    const clinicSection = answer.match(
      /<strong>Clinic[\s\S]*?(?=<strong>Enterprise|$)/i
    )?.[0];
    expect(clinicSection).toBeTruthy();
    expect(clinicSection!.toLowerCase()).toMatch(/custom branding[\s\S]{0,40}enterprise|enterprise[\s\S]{0,20}custom branding/);
  });
});

describe("package marketing lists", () => {
  it("every sellable tier has marketing include/exclude lists", () => {
    for (const tier of TIERS) {
      const m = getPackageMarketing(tier);
      expect(m, tier).toBeDefined();
      expect(m!.features.length).toBeGreaterThan(0);
      if (tier === "enterprise") {
        expect(m!.excludedFeatures.length).toBe(0);
      } else {
        expect(m!.excludedFeatures.length).toBeGreaterThan(0);
      }
    }
  });

  it("LICENSE_TIERS features match PACKAGE_MARKETING (pricing source of truth)", () => {
    for (const tier of LICENSE_TIERS) {
      const m = PACKAGE_MARKETING[tier.id as keyof typeof PACKAGE_MARKETING];
      if (!m) continue;
      expect(tier.features).toEqual(m.features);
      expect(tier.excludedFeatures ?? []).toEqual(m.excludedFeatures);
    }
  });

  it("marketing is consistent with hasFeature for every tier", () => {
    for (const tier of TIERS) {
      const errors = validatePackageMarketingConsistency(tier);
      expect(errors, `${tier}: ${errors.join("; ")}`).toEqual([]);
    }
  });
});
