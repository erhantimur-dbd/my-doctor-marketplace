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

describe("tier seat limits", () => {
  it("free/starter are single-seat", () => {
    expect(getTierSeatLimits("free").multiDoctor).toBe(false);
    expect(getTierSeatLimits("starter").max).toBe(1);
  });

  it("professional is 1–4 per-user", () => {
    const p = getTierSeatLimits("professional");
    expect(p.max).toBe(4);
    expect(p.perUser).toBe(true);
    expect(p.multiDoctor).toBe(true);
  });

  it("clinic is 5 included max 15", () => {
    const c = getTierSeatLimits("clinic");
    expect(c.included).toBe(5);
    expect(c.max).toBe(15);
    expect(c.perUser).toBe(false);
  });
});

describe("canInviteDoctor", () => {
  const proLicense = {
    tier: "professional",
    status: "active",
    max_seats: 2,
  } as const;

  it("blocks free/starter doctor invites with referral guidance", () => {
    const r = canInviteDoctor({
      members: [{ role: "owner", status: "active" }],
      pendingInvites: [],
      license: { tier: "free", status: "active" },
      role: "doctor",
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Referrals|Professional|Clinic/i);
  });

  it("allows admin invite without seat on any paid org", () => {
    const r = canInviteDoctor({
      members: [{ role: "owner", status: "active" }],
      pendingInvites: [],
      license: { tier: "starter", status: "active", max_seats: 1 } as never,
      role: "admin",
    });
    // starter is paid but multiDoctor false — admin still allowed
    expect(r.allowed).toBe(true);
  });

  it("soft-caps professional seats with used + pending invites", () => {
    // 2 seats full with owner + one active doctor
    const full = canInviteDoctor({
      members: [
        { role: "owner", status: "active" },
        { role: "doctor", status: "active" },
      ],
      pendingInvites: [],
      license: { ...proLicense, max_seats: 2 },
      role: "doctor",
    });
    expect(full.allowed).toBe(false);

    // owner + one pending invite fills soft-cap of 2
    const softFull = canInviteDoctor({
      members: [{ role: "owner", status: "active" }],
      pendingInvites: [{ role: "doctor", status: "pending" }],
      license: { ...proLicense, max_seats: 2 },
      role: "doctor",
    });
    expect(softFull.allowed).toBe(false);
    expect(softFull.used + softFull.pending).toBe(2);

    // room for one more invite when only owner
    const open = canInviteDoctor({
      members: [{ role: "owner", status: "active" }],
      pendingInvites: [],
      license: { ...proLicense, max_seats: 2 },
      role: "doctor",
    });
    expect(open.allowed).toBe(true);
    expect(open.remaining).toBe(1);
  });

  it("blocks 5th professional seat at hard max", () => {
    const members = [
      { role: "owner", status: "active" },
      { role: "doctor", status: "active" },
      { role: "doctor", status: "active" },
      { role: "doctor", status: "active" },
    ];
    const r = canInviteDoctor({
      members,
      pendingInvites: [],
      license: { tier: "professional", status: "active", max_seats: 4 },
      role: "doctor",
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Clinic|seats/i);
  });
});

describe("professionalQuantityFromSeats", () => {
  it("clamps 1–4", () => {
    expect(professionalQuantityFromSeats(0)).toBe(1);
    expect(professionalQuantityFromSeats(3)).toBe(3);
    expect(professionalQuantityFromSeats(9)).toBe(4);
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
