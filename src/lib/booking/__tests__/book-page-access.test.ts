import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBookPageAccess } from "@/lib/booking/book-page-access";
import { SOFT_LAUNCH_SOFTSMOKE_DOCTOR } from "@/lib/soft-launch/softsmoke-connect-bypass";
import type { LicenseLike } from "@/lib/license/tier-lifecycle";

const ENV_KEY = "SOFT_LAUNCH_SOFTSMOKE_CONNECT_BYPASS";
const originalFlag = process.env[ENV_KEY];

afterEach(() => {
  if (originalFlag === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = originalFlag;
});

const foundingFree: LicenseLike[] = [
  { id: "lic-free", tier: "free", status: "active", created_at: "2026-01-01" },
];

function doctor(
  overrides: Partial<Parameters<typeof resolveBookPageAccess>[0]> = {}
) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "dr-other",
    email: "other@example.com",
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

  it("does not hard-block Founding Free as coming-soon when Connect is missing", () => {
    expect(
      resolveBookPageAccess(
        doctor({
          stripeAccountId: null,
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

describe("Softsmoke Connect bypass", () => {
  const softsmoke = (
    overrides: Partial<Parameters<typeof resolveBookPageAccess>[0]> = {}
  ) =>
    doctor({
      id: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id,
      slug: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.slug,
      email: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.email,
      stripeAccountId: null,
      stripeOnboardingComplete: false,
      ...overrides,
    });

  it("lets the allowlisted smoke doctor reach the wizard without Connect", () => {
    expect(resolveBookPageAccess(softsmoke())).toBe("wizard");
  });

  it("does not bypass Connect for a partial identity match", () => {
    expect(
      resolveBookPageAccess(
        softsmoke({
          id: "22222222-2222-2222-2222-222222222222",
        })
      )
    ).toBe("payment_pending");
    expect(
      resolveBookPageAccess(softsmoke({ slug: "dr-vera-softsmoke" }))
    ).toBe("payment_pending");
    expect(
      resolveBookPageAccess(softsmoke({ email: "someone-else@gmail.com" }))
    ).toBe("payment_pending");
  });

  it("respects the env kill switch", () => {
    process.env[ENV_KEY] = "0";
    expect(resolveBookPageAccess(softsmoke())).toBe("payment_pending");
  });

  it("still blocks an unverified smoke doctor", () => {
    expect(
      resolveBookPageAccess(softsmoke({ verificationStatus: "pending" }))
    ).toBe("unavailable");
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

  it("uses the entitlement gate and does not hard-block tier=free", () => {
    expect(page).toContain("resolveBookPageAccess");
    expect(page).not.toContain("Online booking coming soon");
    expect(page).not.toContain("free founding plan");
    expect(page).not.toMatch(/\.eq\(\s*["']tier["']\s*,\s*["']free["']\s*\)/);
    expect(page).toContain("BookingWizard");
    expect(page).not.toContain("redirectPatientMarketplaceIfSoftLaunch");
  });
});
