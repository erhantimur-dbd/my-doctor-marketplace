import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nextDoctorWelcomeSend } from "@/lib/email/doctor-welcome-once";

describe("doctor welcome email waits for payment", () => {
  it("creating checkout sends no email", () => {
    const result = nextDoctorWelcomeSend({
      trigger: "checkout_created",
      alreadySent: false,
    });
    expect(result.send).toBe(false);
    expect(result.alreadySent).toBe(false);

    const auth = readFileSync(
      join(process.cwd(), "src/actions/auth.ts"),
      "utf8"
    );
    const start = auth.indexOf("export async function registerDoctorWithCheckout");
    const end = auth.indexOf("export async function resumeDoctorLicenseCheckout");
    const checkout = auth.slice(start, end);
    expect(checkout).not.toContain("doctorWelcomeEmail");
    expect(checkout).not.toContain("sendEmail");
    expect(checkout).not.toContain("sendDoctorWelcomeOnce");
  });

  it("a success webhook sends it exactly once and a replay does not send it again", () => {
    const first = nextDoctorWelcomeSend({
      trigger: "payment_succeeded",
      alreadySent: false,
    });
    expect(first.send).toBe(true);
    expect(first.alreadySent).toBe(true);

    const replay = nextDoctorWelcomeSend({
      trigger: "payment_succeeded",
      alreadySent: first.alreadySent,
    });
    expect(replay.send).toBe(false);
    expect(replay.alreadySent).toBe(true);

    const expired = nextDoctorWelcomeSend({
      trigger: "checkout_expired",
      alreadySent: false,
    });
    expect(expired.send).toBe(false);

    const webhook = readFileSync(
      join(process.cwd(), "src/app/api/webhooks/stripe/route.ts"),
      "utf8"
    );
    expect(webhook).toContain("onLicenseCheckoutCompleted");
    expect(webhook).toContain("sendDoctorWelcomeOnce");
    const expiredCase = webhook.slice(
      webhook.indexOf('case "checkout.session.expired"'),
      webhook.indexOf('case "account.updated"')
    );
    expect(expiredCase).toContain("onLicenseCheckoutExpired");
    expect(expiredCase).not.toContain("sendDoctorWelcomeOnce");
    expect(expiredCase).not.toContain("doctorWelcomeEmail");
  });
});
