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
    expect(allowsSoftLaunchSoftsmokeConnectBypass(softsmoke)).toBe(true);
    expect(
      allowsSoftLaunchSoftsmokeConnectBypass({
        ...softsmoke,
        email: "dbd.demo.email@gmail.com ",
      })
    ).toBe(true);
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

describe("booking action wires the smoke bypass without a global Connect skip", () => {
  const booking = readFileSync(
    join(process.cwd(), "src/actions/booking.ts"),
    "utf8"
  );

  it("keeps the Connect destination charge and gates the skip", () => {
    expect(booking).toContain("isSoftsmokeConnectChargeSkipped");
    expect(booking).toContain("destination: doctor.stripe_account_id");
    expect(booking).toContain("stripe_onboarding_complete");
    expect(booking).toContain(
      "This doctor has not completed their payment setup. Please try again later."
    );
    expect(booking).not.toMatch(/stripe_onboarding_complete\s*=\s*true/);
  });
});
