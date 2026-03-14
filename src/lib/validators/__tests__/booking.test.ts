import { describe, it, expect } from "vitest";
import {
  createBookingSchema,
  cancelBookingSchema,
  doctorServiceSchema,
  createFollowUpInvitationSchema,
  bookFollowUpSessionSchema,
} from "../booking";

// Helper: valid UUID for tests
const validUuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const validUuid2 = "e0000000-0000-0000-0000-000000000001";

// ─── createBookingSchema ──────────────────────────────────────────

describe("createBookingSchema", () => {
  const validBooking = {
    doctor_id: validUuid,
    appointment_date: "2026-04-15",
    start_time: "09:00",
    end_time: "09:30",
    consultation_type: "in_person" as const,
  };

  it("accepts a valid in_person booking", () => {
    const result = createBookingSchema.safeParse(validBooking);
    expect(result.success).toBe(true);
  });

  it("accepts a valid video booking", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      consultation_type: "video",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional patient_notes", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      patient_notes: "I have a headache",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null patient_notes", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      patient_notes: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional service_id", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      service_id: validUuid2,
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional duration_minutes", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      duration_minutes: 30,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid doctor_id format", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      doctor_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid consultation_type", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      consultation_type: "phone",
    });
    expect(result.success).toBe(false);
  });

  it("rejects patient_notes over 1000 characters", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      patient_notes: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects duration_minutes below 15", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      duration_minutes: 10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects duration_minutes above 60", () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      duration_minutes: 90,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = createBookingSchema.safeParse({
      doctor_id: validUuid,
    });
    expect(result.success).toBe(false);
  });
});

// ─── cancelBookingSchema ──────────────────────────────────────────

describe("cancelBookingSchema", () => {
  it("accepts a valid cancellation", () => {
    const result = cancelBookingSchema.safeParse({
      booking_id: validUuid,
      reason: "Schedule conflict",
    });
    expect(result.success).toBe(true);
  });

  it("accepts cancellation without reason", () => {
    const result = cancelBookingSchema.safeParse({
      booking_id: validUuid,
    });
    expect(result.success).toBe(true);
  });

  it("accepts null reason", () => {
    const result = cancelBookingSchema.safeParse({
      booking_id: validUuid,
      reason: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid booking_id", () => {
    const result = cancelBookingSchema.safeParse({
      booking_id: "bad-id",
    });
    expect(result.success).toBe(false);
  });

  it("rejects reason over 500 characters", () => {
    const result = cancelBookingSchema.safeParse({
      booking_id: validUuid,
      reason: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ─── doctorServiceSchema ──────────────────────────────────────────

describe("doctorServiceSchema", () => {
  const validService = {
    name: "General Consultation",
    price_cents: 15000,
    duration_minutes: 30,
    consultation_type: "in_person" as const,
  };

  it("accepts a valid service", () => {
    const result = doctorServiceSchema.safeParse(validService);
    expect(result.success).toBe(true);
  });

  it("accepts all valid duration values (15, 30, 45, 60)", () => {
    for (const dur of [15, 30, 45, 60]) {
      const result = doctorServiceSchema.safeParse({
        ...validService,
        duration_minutes: dur,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid duration values", () => {
    for (const dur of [10, 20, 25, 35, 50, 90]) {
      const result = doctorServiceSchema.safeParse({
        ...validService,
        duration_minutes: dur,
      });
      expect(result.success).toBe(false);
    }
  });

  it("accepts 'both' consultation type", () => {
    const result = doctorServiceSchema.safeParse({
      ...validService,
      consultation_type: "both",
    });
    expect(result.success).toBe(true);
  });

  it("accepts 'video' consultation type", () => {
    const result = doctorServiceSchema.safeParse({
      ...validService,
      consultation_type: "video",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = doctorServiceSchema.safeParse({
      ...validService,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name over 200 characters", () => {
    const result = doctorServiceSchema.safeParse({
      ...validService,
      name: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative price_cents", () => {
    const result = doctorServiceSchema.safeParse({
      ...validService,
      price_cents: -100,
    });
    expect(result.success).toBe(false);
  });

  it("accepts zero price_cents (free service)", () => {
    const result = doctorServiceSchema.safeParse({
      ...validService,
      price_cents: 0,
    });
    expect(result.success).toBe(true);
  });

  it("defaults is_active to true", () => {
    const result = doctorServiceSchema.safeParse(validService);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_active).toBe(true);
    }
  });

  it("defaults display_order to 0", () => {
    const result = doctorServiceSchema.safeParse(validService);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.display_order).toBe(0);
    }
  });

  it("accepts deposit_type options", () => {
    for (const dt of ["none", "percentage", "flat"]) {
      const result = doctorServiceSchema.safeParse({
        ...validService,
        deposit_type: dt,
        deposit_value: 30,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts null deposit fields", () => {
    const result = doctorServiceSchema.safeParse({
      ...validService,
      deposit_type: null,
      deposit_value: null,
    });
    expect(result.success).toBe(true);
  });
});

// ─── createFollowUpInvitationSchema ───────────────────────────────

describe("createFollowUpInvitationSchema", () => {
  const validInvitation = {
    patient_id: validUuid,
    service_id: validUuid2,
    consultation_type: "video" as const,
    duration_minutes: 30,
    total_sessions: 3,
  };

  it("accepts a valid invitation with service_id", () => {
    const result = createFollowUpInvitationSchema.safeParse(validInvitation);
    expect(result.success).toBe(true);
  });

  it("accepts invitation with custom service name and price", () => {
    const result = createFollowUpInvitationSchema.safeParse({
      patient_id: validUuid,
      custom_service_name: "Custom Treatment",
      custom_price_cents: 5000,
      consultation_type: "in_person",
      duration_minutes: 45,
      total_sessions: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts invitation with line items", () => {
    const result = createFollowUpInvitationSchema.safeParse({
      patient_id: validUuid,
      consultation_type: "video",
      duration_minutes: 30,
      total_sessions: 1,
      items: [
        { name: "Blood Test", price_cents: 2000, quantity: 1 },
        { name: "X-Ray", price_cents: 5000, quantity: 2 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invitation without service_id, custom name/price, or items", () => {
    const result = createFollowUpInvitationSchema.safeParse({
      patient_id: validUuid,
      consultation_type: "video",
      duration_minutes: 30,
      total_sessions: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid patient_id", () => {
    const result = createFollowUpInvitationSchema.safeParse({
      ...validInvitation,
      patient_id: "not-valid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid duration_minutes", () => {
    const result = createFollowUpInvitationSchema.safeParse({
      ...validInvitation,
      duration_minutes: 20,
    });
    expect(result.success).toBe(false);
  });

  it("rejects total_sessions above 10", () => {
    const result = createFollowUpInvitationSchema.safeParse({
      ...validInvitation,
      total_sessions: 11,
    });
    expect(result.success).toBe(false);
  });

  it("rejects total_sessions below 1", () => {
    const result = createFollowUpInvitationSchema.safeParse({
      ...validInvitation,
      total_sessions: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts discount fields", () => {
    const result = createFollowUpInvitationSchema.safeParse({
      ...validInvitation,
      discount_type: "percentage",
      discount_value: 20,
    });
    expect(result.success).toBe(true);
  });

  it("accepts doctor_note up to 1000 chars", () => {
    const result = createFollowUpInvitationSchema.safeParse({
      ...validInvitation,
      doctor_note: "Please follow up in 2 weeks.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects doctor_note over 1000 chars", () => {
    const result = createFollowUpInvitationSchema.safeParse({
      ...validInvitation,
      doctor_note: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});

// ─── bookFollowUpSessionSchema ────────────────────────────────────

describe("bookFollowUpSessionSchema", () => {
  const validSession = {
    invitation_id: validUuid,
    appointment_date: "2026-05-01",
    start_time: "14:00",
    end_time: "14:30",
  };

  it("accepts a valid follow-up session booking", () => {
    const result = bookFollowUpSessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it("rejects invalid invitation_id", () => {
    const result = bookFollowUpSessionSchema.safeParse({
      ...validSession,
      invitation_id: "bad",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = bookFollowUpSessionSchema.safeParse({
      invitation_id: validUuid,
    });
    expect(result.success).toBe(false);
  });
});
