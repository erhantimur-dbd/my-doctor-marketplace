import { describe, expect, it } from "vitest";
import {
  classifyPatientBookingHistory,
  partitionPatientBookings,
} from "@/lib/patient/booking-history";

const NOW = new Date("2026-09-29T12:00:00.000Z");

describe("classifyPatientBookingHistory", () => {
  it("keeps future confirmed bookings in upcoming", () => {
    expect(
      classifyPatientBookingHistory(
        {
          status: "confirmed",
          appointment_date: "2026-10-01",
          start_time: "2026-10-01T10:00:00.000Z",
        },
        NOW
      )
    ).toBe("upcoming");
  });

  it("moves past-dated confirmed/approved bookings into past", () => {
    expect(
      classifyPatientBookingHistory(
        {
          status: "confirmed",
          appointment_date: "2026-09-20",
          start_time: "2026-09-20T10:00:00.000Z",
        },
        NOW
      )
    ).toBe("past");
    expect(
      classifyPatientBookingHistory(
        {
          status: "approved",
          appointment_date: "2026-09-28",
          start_time: "09:00:00",
        },
        NOW
      )
    ).toBe("past");
  });

  it("always treats terminal statuses as past", () => {
    for (const status of [
      "completed",
      "cancelled_patient",
      "cancelled_doctor",
      "no_show",
      "refunded",
      "rejected",
      "expired",
    ]) {
      expect(
        classifyPatientBookingHistory(
          {
            status,
            appointment_date: "2026-10-05",
            start_time: "2026-10-05T10:00:00.000Z",
          },
          NOW
        )
      ).toBe("past");
    }
  });

  it("includes pending_reschedule_payment in upcoming when still ahead", () => {
    expect(
      classifyPatientBookingHistory(
        {
          status: "pending_reschedule_payment",
          appointment_date: "2026-10-02",
          start_time: "11:00:00",
        },
        NOW
      )
    ).toBe("upcoming");
  });
});

describe("partitionPatientBookings", () => {
  it("splits mixed history and does not drop orphan statuses", () => {
    const { upcoming, past } = partitionPatientBookings(
      [
        {
          id: "1",
          status: "confirmed",
          appointment_date: "2026-10-01",
          start_time: "2026-10-01T10:00:00.000Z",
        },
        {
          id: "2",
          status: "confirmed",
          appointment_date: "2026-09-01",
          start_time: "2026-09-01T10:00:00.000Z",
        },
        {
          id: "3",
          status: "rejected",
          appointment_date: "2026-10-01",
          start_time: "2026-10-01T10:00:00.000Z",
        },
        {
          id: "4",
          status: "mystery_status",
          appointment_date: "2026-10-01",
          start_time: "2026-10-01T10:00:00.000Z",
        },
      ],
      NOW
    );

    expect(upcoming.map((b) => b.id)).toEqual(["1"]);
    expect(past.map((b) => b.id)).toEqual(["2", "3", "4"]);
  });
});
