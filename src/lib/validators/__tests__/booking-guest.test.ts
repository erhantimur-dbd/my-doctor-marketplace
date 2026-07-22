import { describe, it, expect } from "vitest";
import { createBookingSchema, guestContactSchema } from "../booking";

describe("guest checkout validators", () => {
  it("accepts valid guest contact", () => {
    const r = guestContactSchema.safeParse({
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      phone: "+441234",
      terms_accepted: true,
    });
    expect(r.success).toBe(true);
  });

  it("rejects missing terms", () => {
    const r = guestContactSchema.safeParse({
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      terms_accepted: false,
    });
    expect(r.success).toBe(false);
  });

  it("accepts booking payload with guest", () => {
    const r = createBookingSchema.safeParse({
      doctor_id: "a0000000-0000-4000-8000-000000000001",
      appointment_date: "2026-08-01",
      start_time: "10:00:00",
      end_time: "10:30:00",
      consultation_type: "video",
      guest: {
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@example.com",
        terms_accepted: true,
      },
    });
    expect(r.success).toBe(true);
  });

  it("still accepts authed booking without guest", () => {
    const r = createBookingSchema.safeParse({
      doctor_id: "a0000000-0000-4000-8000-000000000001",
      appointment_date: "2026-08-01",
      start_time: "10:00:00",
      end_time: "10:30:00",
      consultation_type: "in_person",
    });
    expect(r.success).toBe(true);
  });
});
