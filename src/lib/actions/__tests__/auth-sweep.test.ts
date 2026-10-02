import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function sliceFunction(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe("server action auth sweep", () => {
  it("redeems a gift card for the signed-in user", () => {
    const fn = sliceFunction(read("src/actions/wallet.ts"), "redeemGiftCard");
    expect(fn).toContain("auth.getUser()");
    expect(fn).toContain("p_patient_id: user.id");
    expect(fn).not.toMatch(/p_patient_id:\s*(input|patientId|patient_id)/);
  });

  it("records a coupon redemption only for the signed-in doctor", () => {
    const action = read("src/actions/coupon.ts");
    expect(action).not.toContain("function recordCouponRedemption");
    const fn = sliceFunction(
      read("src/lib/coupons/record-redemption.ts"),
      "recordCouponRedemption"
    );
    expect(fn).toContain("auth.getUser()");
    expect(fn).toContain('.eq("id", doctorId)');
    expect(fn).toContain("doctor_id: doctor.id");
    expect(fn).not.toContain("doctor_id: doctorId");
    expect(read("src/actions/doctor.ts")).toContain(
      "@/lib/coupons/record-redemption"
    );
  });

  it("checks and marks referral discounts for the signed-in doctor", () => {
    const referral = read("src/actions/referral.ts");
    const check = sliceFunction(referral, "checkReferralDiscount");
    expect(referral).not.toContain("function markReferredRewarded");
    const mark = sliceFunction(
      read("src/lib/referrals/internal.ts"),
      "markReferredRewarded"
    );
    expect(check).toContain("auth.getUser()");
    expect(check).toContain('.eq("id", doctorId)');
    expect(check).toContain('.eq("referred_doctor_id", doctor.id)');
    expect(mark).toContain("auth.getUser()");
    expect(mark).toContain('.eq("referred_doctor_id", doctor.id)');
    expect(read("src/actions/doctor.ts")).toContain("@/lib/referrals/internal");
  });

  it("returns push subscription secrets only to their owner", () => {
    const fn = sliceFunction(
      read("src/actions/push-subscriptions.ts"),
      "getUserPushSubscriptions",
    );
    expect(fn).toContain("auth.getUser()");
    expect(fn).toContain("user.id !== userId");
    expect(fn).toContain('.eq("user_id", user.id)');
    expect(fn).not.toContain('.eq("user_id", userId)');
  });

  it("saves attachment rows as the signed-in participant", () => {
    const fn = sliceFunction(read("src/actions/attachments.ts"), "saveAttachmentRecord");
    expect(fn).toContain("auth.getUser()");
    expect(fn).toContain('.eq("id", data.conversationId)');
    expect(fn).toContain("data.storagePath.startsWith(`${data.conversationId}/`)");
    expect(fn).toContain('.eq("conversation_id", data.conversationId)');
    expect(fn).toContain("uploaded_by: user.id");
    expect(fn).not.toContain("uploaded_by: data.uploadedBy");
  });

  it("validates blog updates before the service-role write", () => {
    const fn = sliceFunction(read("src/actions/blog.ts"), "updateBlogPost");
    expect(fn.indexOf("blogPostSchema.safeParse")).toBeGreaterThan(-1);
    expect(fn.indexOf("blogPostSchema.safeParse")).toBeLessThan(
      fn.indexOf("...parsed.data")
    );
    expect(fn).not.toContain("...input");
    expect(fn.indexOf("requirePlatformAdmin")).toBeLessThan(
      fn.indexOf("createAdminClient")
    );
  });

  it("does not export coupon or referral service-role writes as actions", () => {
    expect(read("src/actions/coupon.ts")).not.toContain(
      "export async function recordCouponRedemption"
    );
    expect(read("src/actions/referral.ts")).not.toContain(
      "export async function markReferredRewarded"
    );
  });

  it("does not let an anonymous caller probe whether an email is registered", () => {
    const fn = sliceFunction(
      read("src/actions/clinic-invitations.ts"),
      "checkEmailRegistered",
    );
    expect(fn).toContain('requireOrgMember(["owner", "admin"])');
    expect(fn.indexOf("requireOrgMember")).toBeLessThan(fn.indexOf("createAdminClient"));
  });

  it("keeps referral rewards and waitlist fan-out off the server-action surface", () => {
    const referralAction = read("src/actions/referral.ts");
    const alertsAction = read("src/actions/availability-alerts.ts");
    const referralLib = read("src/lib/referrals/internal.ts");
    const notifyLib = read("src/lib/availability/notify-subscribers.ts");

    expect(referralAction).not.toContain("function processReferralReward");
    expect(referralAction).not.toContain("function processReferralSignup");
    expect(referralAction).not.toContain("function sendReferralInvitationAtRegistration");
    expect(alertsAction).not.toContain("function notifyAvailabilitySubscribers");
    expect(alertsAction).not.toContain("function notifySpecialtyWaitlist");

    expect(referralLib).not.toContain('"use server"');
    expect(notifyLib).not.toContain('"use server"');
    expect(referralLib).toContain("function processReferralReward");
    expect(notifyLib).toContain("function notifyAvailabilitySubscribers");

    expect(read("src/app/api/webhooks/stripe/route.ts")).toContain(
      "@/lib/referrals/internal",
    );
    expect(read("src/actions/booking.ts")).toContain(
      "@/lib/availability/notify-subscribers",
    );
    expect(read("src/actions/auth.ts")).toContain("@/lib/referrals/internal");
  });
});
