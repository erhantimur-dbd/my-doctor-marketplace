import { describe, expect, it } from "vitest";
import { isClinicInviteToken } from "../clinic-invite-token";

describe("isClinicInviteToken", () => {
  it("accepts 64-char hex only", () => {
    expect(isClinicInviteToken("a".repeat(64))).toBe(true);
    expect(isClinicInviteToken("A".repeat(64))).toBe(true);
    expect(isClinicInviteToken("0123456789abcdef".repeat(4))).toBe(true);
    expect(isClinicInviteToken("dentistry")).toBe(false);
    expect(isClinicInviteToken("not-a-specialty")).toBe(false);
    expect(isClinicInviteToken("g".repeat(64))).toBe(false);
    expect(isClinicInviteToken("a".repeat(63))).toBe(false);
    expect(isClinicInviteToken("a".repeat(65))).toBe(false);
  });
});
