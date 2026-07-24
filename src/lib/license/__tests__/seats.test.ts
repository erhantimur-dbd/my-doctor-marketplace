import { describe, expect, it } from "vitest";
import {
  canInviteDoctor,
  countDoctorSeatsUsed,
  countPendingDoctorInvites,
  getTierSeatLimits,
  professionalQuantityFromSeats,
  roleConsumesDoctorSeat,
} from "@/lib/license/seats";

describe("seat counting", () => {
  it("counts active doctor and owner; ignores admin/staff and removed", () => {
    expect(
      countDoctorSeatsUsed([
        { role: "owner", status: "active" },
        { role: "doctor", status: "active" },
        { role: "admin", status: "active" },
        { role: "staff", status: "active" },
        { role: "doctor", status: "removed" },
      ])
    ).toBe(2);
  });

  it("counts pending doctor invites only", () => {
    expect(
      countPendingDoctorInvites([
        { role: "doctor", status: "pending" },
        { role: "doctor", status: "accepted" },
        { role: "admin", status: "pending" },
      ])
    ).toBe(1);
  });
});

describe("tier seat limits (D-simple packaging)", () => {
  it("free/starter/professional are single-seat solo plans", () => {
    expect(getTierSeatLimits("free").multiDoctor).toBe(false);
    expect(getTierSeatLimits("starter").max).toBe(1);
    expect(getTierSeatLimits("professional").max).toBe(1);
    expect(getTierSeatLimits("professional").multiDoctor).toBe(false);
    expect(getTierSeatLimits("professional").perUser).toBe(false);
  });

  it("clinic is 3 included max 15 multi-doctor", () => {
    const c = getTierSeatLimits("clinic");
    expect(c.included).toBe(3);
    expect(c.max).toBe(15);
    expect(c.perUser).toBe(false);
    expect(c.multiDoctor).toBe(true);
  });
});

describe("canInviteDoctor", () => {
  it("blocks free/starter/professional doctor invites with Clinic/referral guidance", () => {
    for (const tier of ["free", "starter", "professional"] as const) {
      const r = canInviteDoctor({
        members: [{ role: "owner", status: "active" }],
        pendingInvites: [],
        license: { tier, status: "active", max_seats: 1 },
        role: "doctor",
      });
      expect(r.allowed, tier).toBe(false);
      expect(r.reason, tier).toMatch(/Clinic|Referrals|one doctor|Professional/i);
    }
  });

  it("allows admin invite without seat", () => {
    const r = canInviteDoctor({
      members: [{ role: "owner", status: "active" }],
      pendingInvites: [],
      license: { tier: "clinic", status: "active", max_seats: 3 },
      role: "admin",
    });
    expect(r.allowed).toBe(true);
  });

  it("soft-caps clinic seats with used + pending invites", () => {
    const full = canInviteDoctor({
      members: [
        { role: "owner", status: "active" },
        { role: "doctor", status: "active" },
        { role: "doctor", status: "active" },
      ],
      pendingInvites: [],
      license: { tier: "clinic", status: "active", max_seats: 3 },
      role: "doctor",
    });
    expect(full.allowed).toBe(false);

    const open = canInviteDoctor({
      members: [{ role: "owner", status: "active" }],
      pendingInvites: [],
      license: { tier: "clinic", status: "active", max_seats: 3 },
      role: "doctor",
    });
    expect(open.allowed).toBe(true);
    expect(open.remaining).toBe(2);
  });
});

describe("professionalQuantityFromSeats", () => {
  it("always returns 1 (Pro is not multi-seat)", () => {
    expect(professionalQuantityFromSeats(0)).toBe(1);
    expect(professionalQuantityFromSeats(3)).toBe(1);
    expect(professionalQuantityFromSeats(9)).toBe(1);
  });
});

describe("roleConsumesDoctorSeat", () => {
  it("doctor and owner consume; admin/staff do not", () => {
    expect(roleConsumesDoctorSeat("doctor")).toBe(true);
    expect(roleConsumesDoctorSeat("owner")).toBe(true);
    expect(roleConsumesDoctorSeat("admin")).toBe(false);
    expect(roleConsumesDoctorSeat("staff")).toBe(false);
  });
});
