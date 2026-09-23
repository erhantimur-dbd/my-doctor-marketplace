import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBookPageAccess } from "@/lib/booking/book-page-access";
import type { LicenseLike } from "@/lib/license/tier-lifecycle";

const foundingFree: LicenseLike[] = [
  { id: "lic-free", tier: "free", status: "active", created_at: "2026-01-01" },
];

function doctor(
  overrides: Partial<Parameters<typeof resolveBookPageAccess>[0]> = {}
) {
  return {
    isActive: true,
    verificationStatus: "verified" as string | null,
    stripeAccountId: "acct_123" as string | null,
    stripeOnboardingComplete: true as boolean | null,
    licenses: foundingFree,
    ...overrides,
  };
}

describe("resolveBookPageAccess Founding Free", () => {
  it("lets an active Founding Free licence reach the wizard when Connect is ready", () => {
    expect(resolveBookPageAccess(doctor())).toBe("wizard");
  });

  it("keeps Connect-incomplete Founding Free on the existing payment-pending gate", () => {
    // Softsmoke is this case: Founding Free, Connect not finished.
    // No identity bypass — Jim has not chosen a Connect skip or another doctor.
    expect(
      resolveBookPageAccess(
        doctor({
          stripeAccountId: null,
          stripeOnboardingComplete: false,
        })
      )
    ).toBe("payment_pending");
    expect(
      resolveBookPageAccess(
        doctor({
          stripeAccountId: "acct_incomplete",
          stripeOnboardingComplete: false,
        })
      )
    ).toBe("payment_pending");
  });

  it("prefers a paid licence over a leftover free row", () => {
    expect(
      resolveBookPageAccess(
        doctor({
          licenses: [
            { tier: "free", status: "active", created_at: "2026-01-01" },
            {
              tier: "professional",
              status: "active",
              created_at: "2026-06-01",
            },
          ],
        })
      )
    ).toBe("wizard");
  });

  it("keeps unverified and inactive Founding Free doctors unavailable", () => {
    expect(
      resolveBookPageAccess(doctor({ verificationStatus: "pending" }))
    ).toBe("unavailable");
    expect(resolveBookPageAccess(doctor({ isActive: false }))).toBe(
      "unavailable"
    );
  });
});

describe("null / unknown licence is not Founding Free", () => {
  it("blocks a missing licence (hasFeature null stays false)", () => {
    expect(resolveBookPageAccess(doctor({ licenses: [] }))).toBe(
      "plan_blocked"
    );
    expect(resolveBookPageAccess(doctor({ licenses: null }))).toBe(
      "plan_blocked"
    );
  });

  it("blocks an unknown tier and a cancelled free row", () => {
    expect(
      resolveBookPageAccess(
        doctor({ licenses: [{ tier: "legacy", status: "active" }] })
      )
    ).toBe("plan_blocked");
    expect(
      resolveBookPageAccess(
        doctor({ licenses: [{ tier: "free", status: "cancelled" }] })
      )
    ).toBe("plan_blocked");
  });
});

describe("book page source", () => {
  const page = readFileSync(
    join(
      process.cwd(),
      "src/app/[locale]/(public)/doctors/[slug]/book/page.tsx"
    ),
    "utf8"
  );
  const booking = readFileSync(
    join(process.cwd(), "src/actions/booking.ts"),
    "utf8"
  );

  it("uses the entitlement gate and does not hard-block tier=free", () => {
    expect(page).toContain("resolveBookPageAccess");
    expect(page).toContain("payment_pending");
    expect(page).not.toContain("Online booking coming soon");
    expect(page).not.toContain("free founding plan");
    expect(page).not.toMatch(/\.eq\(\s*["']tier["']\s*,\s*["']free["']\s*\)/);
    expect(page).toContain("BookingWizard");
    expect(page).not.toContain("redirectPatientMarketplaceIfSoftLaunch");
    expect(page).not.toContain("softsmoke");
    expect(booking).not.toContain("softsmoke");
    expect(booking).toContain("stripe_onboarding_complete");
    expect(booking).toContain(
      "This doctor has not completed their payment setup. Please try again later."
    );
  });
});
