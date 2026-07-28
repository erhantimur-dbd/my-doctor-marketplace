import { describe, it, expect } from "vitest";
import {
  normalizeConsultationType,
  mapGetAvailableSlotsResult,
  buildGetAvailableSlotsRpcArgs,
  isAmbiguousFunctionError,
} from "@/lib/booking/available-slots";

describe("normalizeConsultationType", () => {
  it("keeps video and in_person", () => {
    expect(normalizeConsultationType("video")).toBe("video");
    expect(normalizeConsultationType("in_person")).toBe("in_person");
  });

  it("maps empty/unknown to in_person (avoids RPC schedule miss)", () => {
    expect(normalizeConsultationType("")).toBe("in_person");
    expect(normalizeConsultationType(undefined)).toBe("in_person");
    expect(normalizeConsultationType("hybrid")).toBe("in_person");
  });
});

describe("mapGetAvailableSlotsResult", () => {
  it("RPC error → user-facing error, empty slots", () => {
    const r = mapGetAvailableSlotsResult({
      data: null,
      error: { message: "permission denied" },
    });
    expect(r.error).toBe("Failed to fetch available slots.");
    expect(r.slots).toEqual([]);
  });

  it("success with zero rows → no error (empty day, not fetch failure)", () => {
    const r = mapGetAvailableSlotsResult({ data: [], error: null });
    expect(r.error).toBeUndefined();
    expect(r.slots).toEqual([]);
  });

  it("success with slots filters unavailable", () => {
    const r = mapGetAvailableSlotsResult({
      data: [
        {
          slot_start: "2026-08-01T09:00:00Z",
          slot_end: "2026-08-01T09:30:00Z",
          is_available: true,
        },
        {
          slot_start: "2026-08-01T10:00:00Z",
          slot_end: "2026-08-01T10:30:00Z",
          is_available: false,
        },
        {
          slot_start: "2026-08-01T11:00:00Z",
          slot_end: "2026-08-01T11:30:00Z",
          // missing is_available → treat as bookable
        },
      ],
      error: null,
    });
    expect(r.error).toBeUndefined();
    expect(r.slots).toHaveLength(2);
    expect(r.slots[0].slot_start).toContain("09:00");
  });
});

describe("buildGetAvailableSlotsRpcArgs", () => {
  it("always includes 5 named params for the unique overload", () => {
    const args = buildGetAvailableSlotsRpcArgs({
      doctorId: "e0000000-0000-0000-0000-000000000002",
      date: "2026-08-03",
      consultationType: "",
    });
    expect(Object.keys(args).sort()).toEqual(
      [
        "p_clinic_location_id",
        "p_consultation_type",
        "p_date",
        "p_doctor_id",
        "p_slot_duration_override",
      ].sort()
    );
    expect(args.p_consultation_type).toBe("in_person");
    expect(args.p_slot_duration_override).toBeNull();
    expect(args.p_clinic_location_id).toBeNull();
  });

  it("passes positive duration override", () => {
    const args = buildGetAvailableSlotsRpcArgs({
      doctorId: "x",
      date: "2026-08-03",
      consultationType: "video",
      slotDurationOverride: 45,
    });
    expect(args.p_consultation_type).toBe("video");
    expect(args.p_slot_duration_override).toBe(45);
  });
});

describe("isAmbiguousFunctionError", () => {
  it("detects Postgres 42725 not unique", () => {
    expect(
      isAmbiguousFunctionError(
        "function get_available_slots(uuid, date, text) is not unique"
      )
    ).toBe(true);
    expect(isAmbiguousFunctionError("permission denied")).toBe(false);
  });
});
