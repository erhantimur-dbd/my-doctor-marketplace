import { describe, expect, it } from "vitest";
import {
  buildFreeGatewayLicenseInsert,
  freeLicensesToSupersede,
  getPendingPlanChange,
  licenseAllowsOnlineBookings,
  paidFeaturesActiveDuringCancel,
  pickEffectiveLicense,
  resolvePaidCheckoutMode,
  resolvePlanChange,
} from "@/lib/license/tier-lifecycle";
import { hasFeature } from "@/lib/utils/feature-flags";

describe("pickEffectiveLicense", () => {
  it("prefers paid over free when both active", () => {
    const effective = pickEffectiveLicense([
      {
        id: "1",
        tier: "free",
        status: "active",
        created_at: "2026-01-02T00:00:00.000Z",
      },
      {
        id: "2",
        tier: "starter",
        status: "active",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(effective?.tier).toBe("starter");
    expect(effective?.id).toBe("2");
  });

  it("prefers professional over starter", () => {
    const effective = pickEffectiveLicense([
      { tier: "starter", status: "active", created_at: "2026-06-01T00:00:00Z" },
      {
        tier: "professional",
        status: "active",
        created_at: "2026-05-01T00:00:00Z",
      },
    ]);
    expect(effective?.tier).toBe("professional");
  });

  it("ignores cancelled free when paid is active", () => {
    const effective = pickEffectiveLicense([
      { tier: "free", status: "cancelled" },
      { tier: "starter", status: "trialing" },
    ]);
    expect(effective?.tier).toBe("starter");
  });
});

describe("resolvePaidCheckoutMode (free→starter, starter→professional)", () => {
  it("allows new checkout with no licence", () => {
    expect(resolvePaidCheckoutMode([], "starter").mode).toBe("new");
  });

  it("allows free→starter as upgrade_from_free", () => {
    const r = resolvePaidCheckoutMode(
      [{ tier: "free", status: "active" }],
      "starter"
    );
    expect(r.mode).toBe("upgrade_from_free");
  });

  it("allows free→professional as upgrade_from_free", () => {
    expect(
      resolvePaidCheckoutMode([{ tier: "free", status: "active" }], "professional")
        .mode
    ).toBe("upgrade_from_free");
  });

  it("allows starter→professional as upgrade_paid", () => {
    const r = resolvePaidCheckoutMode(
      [
        {
          tier: "starter",
          status: "active",
          stripe_subscription_id: "sub_123",
        },
      ],
      "professional"
    );
    expect(r.mode).toBe("upgrade_paid");
    expect(r.current?.tier).toBe("starter");
  });

  it("blocks already-on-plan and free checkout", () => {
    expect(
      resolvePaidCheckoutMode([{ tier: "starter", status: "active" }], "starter")
        .mode
    ).toBe("blocked");
    expect(resolvePaidCheckoutMode([], "free").mode).toBe("blocked");
  });

  it("blocks immediate checkout downgrade professional→starter", () => {
    const r = resolvePaidCheckoutMode(
      [{ tier: "professional", status: "active" }],
      "starter"
    );
    expect(r.mode).toBe("blocked");
    expect(r.reason).toMatch(/period end|Switch Plan/i);
  });
});

describe("resolvePlanChange (upgrade now / schedule downgrade)", () => {
  it("starter→professional is upgrade_now", () => {
    expect(
      resolvePlanChange(
        [{ tier: "starter", status: "active" }],
        "professional"
      ).mode
    ).toBe("upgrade_now");
  });

  it("professional→starter schedules downgrade (period end)", () => {
    const r = resolvePlanChange(
      [
        {
          tier: "professional",
          status: "active",
          stripe_subscription_id: "sub_1",
        },
      ],
      "starter"
    );
    expect(r.mode).toBe("schedule_downgrade");
  });

  it("starter→free schedules downgrade", () => {
    expect(
      resolvePlanChange([{ tier: "starter", status: "active" }], "free").mode
    ).toBe("schedule_downgrade");
  });

  it("paid features stay active while cancel_at_period_end", () => {
    expect(
      paidFeaturesActiveDuringCancel({
        tier: "professional",
        status: "active",
        cancel_at_period_end: true,
      })
    ).toBe(true);
    expect(
      paidFeaturesActiveDuringCancel({
        tier: "professional",
        status: "cancelled",
        cancel_at_period_end: false,
      })
    ).toBe(false);
  });

  it("getPendingPlanChange reads cancel and pending_tier", () => {
    expect(
      getPendingPlanChange({
        tier: "starter",
        status: "active",
        cancel_at_period_end: true,
        current_period_end: "2026-12-01T00:00:00.000Z",
      })?.targetTier
    ).toBe("free");

    expect(
      getPendingPlanChange({
        tier: "professional",
        status: "active",
        cancel_at_period_end: false,
        metadata: { pending_tier: "starter", pending_change: "downgrade" },
        current_period_end: "2026-08-01T00:00:00.000Z",
      })?.targetTier
    ).toBe("starter");
  });

  it("buildFreeGatewayLicenseInsert is free active listing row", () => {
    const row = buildFreeGatewayLicenseInsert("org-1");
    expect(row.tier).toBe("free");
    expect(row.status).toBe("active");
    expect(row.organization_id).toBe("org-1");
    expect(row.stripe_subscription_id).toBeNull();
  });
});

describe("licenseAllowsOnlineBookings + hasFeature matrix", () => {
  it("free never allows bookings; starter/professional do when active", () => {
    expect(licenseAllowsOnlineBookings("free", "active")).toBe(false);
    expect(licenseAllowsOnlineBookings("starter", "active")).toBe(true);
    expect(licenseAllowsOnlineBookings("professional", "trialing")).toBe(true);
    expect(licenseAllowsOnlineBookings("starter", "cancelled")).toBe(false);
  });

  it("feature matrix free vs starter vs professional", () => {
    expect(hasFeature("online_bookings", "free")).toBe(false);
    expect(hasFeature("ai_review_summaries", "free")).toBe(false);
    expect(hasFeature("whatsapp_notifications", "free")).toBe(false);

    expect(hasFeature("online_bookings", "starter")).toBe(true);
    expect(hasFeature("video_consultations", "starter")).toBe(true);
    expect(hasFeature("ai_review_summaries", "starter")).toBe(true);
    expect(hasFeature("email_reminders", "starter")).toBe(true);
    expect(hasFeature("whatsapp_notifications", "starter")).toBe(false);
    expect(hasFeature("waitlist_auto_notify", "starter")).toBe(false);
    expect(hasFeature("analytics_dashboard", "starter")).toBe(false);

    expect(hasFeature("whatsapp_notifications", "professional")).toBe(true);
    expect(hasFeature("waitlist_auto_notify", "professional")).toBe(true);
    expect(hasFeature("analytics_dashboard", "professional")).toBe(true);
    expect(hasFeature("online_bookings", "professional")).toBe(true);
  });

  it("isPaidTier treats free as unpaid for dashboard gates", async () => {
    const { isPaidTier } = await import("@/lib/license/tier-lifecycle");
    expect(isPaidTier("free")).toBe(false);
    expect(isPaidTier("starter")).toBe(true);
    expect(isPaidTier("professional")).toBe(true);
  });
});

describe("dashboard paid-only gates (structural)", () => {
  it("hasActiveLicense source excludes free via isPaidTier", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const check = readFileSync(
      join(process.cwd(), "src/lib/license/check.ts"),
      "utf8"
    );
    expect(check).toMatch(/isPaidTier/);
    expect(check).toMatch(/hasActiveLicense/);
  });

  it("SubscriptionGate requires isPaidTier not bare license id", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const gate = readFileSync(
      join(process.cwd(), "src/components/shared/subscription-gate.tsx"),
      "utf8"
    );
    expect(gate).toMatch(/isPaidTier/);
    expect(gate).toMatch(/pickEffectiveLicense/);
  });

  it("analytics page uses hasFeature analytics_dashboard", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const page = readFileSync(
      join(
        process.cwd(),
        "src/app/[locale]/(doctor)/doctor-dashboard/analytics/page.tsx"
      ),
      "utf8"
    );
    expect(page).toMatch(/hasFeature\(\s*["']analytics_dashboard["']/);
    expect(page).not.toMatch(/hasActiveLicense/);
  });
});

describe("freeLicensesToSupersede", () => {
  it("lists free active rows to cancel after paid activation", () => {
    const rows = freeLicensesToSupersede(
      [
        { tier: "free", status: "active", id: "f1" },
        { tier: "starter", status: "active", id: "s1" },
        { tier: "free", status: "cancelled", id: "f2" },
      ],
      "org_1"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("f1");
  });
});
