import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SOFT_LAUNCH_SOFTSMOKE_DOCTOR,
  allowsSoftLaunchSoftsmokeConnectBypass,
  isSoftsmokeConnectChargeSkipped,
  readJoinedProfileEmail,
} from "@/lib/soft-launch/softsmoke-connect-bypass";

const ENV_KEY = "SOFT_LAUNCH_SOFTSMOKE_CONNECT_BYPASS";
const originalFlag = process.env[ENV_KEY];

afterEach(() => {
  if (originalFlag === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = originalFlag;
});

const softsmoke = {
  id: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id,
  slug: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.slug,
  email: `  ${SOFT_LAUNCH_SOFTSMOKE_DOCTOR.email.toUpperCase()}  `,
};

describe("allowsSoftLaunchSoftsmokeConnectBypass", () => {
  it("matches id, slug, and email together", () => {
    expect(SOFT_LAUNCH_SOFTSMOKE_DOCTOR.slug).toBe("dr-vera-softsmoke-i6jv");
    expect(SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id).toBe(
      "8a9b6ac9-f6f1-4b6a-b108-837a704444dc"
    );
    expect(allowsSoftLaunchSoftsmokeConnectBypass(softsmoke)).toBe(true);
  });

  it("rejects every other doctor", () => {
    expect(
      allowsSoftLaunchSoftsmokeConnectBypass({
        id: softsmoke.id,
        slug: softsmoke.slug,
        email: "founder@example.com",
      })
    ).toBe(false);
    expect(
      allowsSoftLaunchSoftsmokeConnectBypass({
        id: "other",
        slug: "dr-other",
        email: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.email,
      })
    ).toBe(false);
  });

  it("can be forced off without widening the allowlist", () => {
    process.env[ENV_KEY] = "false";
    expect(allowsSoftLaunchSoftsmokeConnectBypass(softsmoke)).toBe(false);
    process.env[ENV_KEY] = "1";
    expect(
      allowsSoftLaunchSoftsmokeConnectBypass({
        id: "other",
        slug: "dr-other",
        email: "other@example.com",
      })
    ).toBe(false);
    expect(allowsSoftLaunchSoftsmokeConnectBypass(softsmoke)).toBe(true);
  });
});

describe("isSoftsmokeConnectChargeSkipped", () => {
  it("skips the destination charge only when Connect is incomplete", () => {
    expect(
      isSoftsmokeConnectChargeSkipped({
        ...softsmoke,
        stripeAccountId: null,
        stripeOnboardingComplete: false,
      })
    ).toBe(true);
    expect(
      isSoftsmokeConnectChargeSkipped({
        ...softsmoke,
        stripeAccountId: "acct_softsmoke",
        stripeOnboardingComplete: true,
      })
    ).toBe(false);
  });

  it("never skips Connect for another doctor", () => {
    expect(
      isSoftsmokeConnectChargeSkipped({
        id: "other",
        slug: "dr-other",
        email: "other@example.com",
        stripeAccountId: null,
        stripeOnboardingComplete: false,
      })
    ).toBe(false);
  });
});

describe("readJoinedProfileEmail", () => {
  it("reads a joined profile object or array", () => {
    expect(readJoinedProfileEmail({ email: "a@b.com" })).toBe("a@b.com");
    expect(readJoinedProfileEmail([{ email: "a@b.com" }])).toBe("a@b.com");
    expect(readJoinedProfileEmail(null)).toBeNull();
    expect(readJoinedProfileEmail({ first_name: "Vera" })).toBeNull();
  });
});

describe("checkout gate stays Connect-required except the smoke allowlist", () => {
  const booking = readFileSync(
    join(process.cwd(), "src/actions/booking.ts"),
    "utf8"
  );

  it("keeps the destination charge and the payment-setup error", () => {
    expect(booking).toContain("isSoftsmokeConnectChargeSkipped");
    expect(booking).toContain("destination: doctor.stripe_account_id");
    expect(booking).toContain(
      "This doctor has not completed their payment setup. Please try again later."
    );
    expect(booking).not.toMatch(/stripe_onboarding_complete\s*=\s*true/);
  });
});
