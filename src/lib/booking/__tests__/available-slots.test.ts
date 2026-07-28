import { describe, it, expect } from "vitest";
import {
  normalizeConsultationType,
  mapGetAvailableSlotsResult,
  shouldRetryWithoutDurationOverride,
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

describe("shouldRetryWithoutDurationOverride", () => {
  it("detects missing overload / unknown function errors", () => {
    expect(
      shouldRetryWithoutDurationOverride(
        "Could not find the function public.get_available_slots(p_doctor_id, p_date, p_consultation_type, p_slot_duration_override)"
      )
    ).toBe(true);
    expect(shouldRetryWithoutDurationOverride("permission denied")).toBe(false);
  });
});
