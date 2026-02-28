import { z } from "zod/v4";

// Use format-only UUID regex (no version/variant bit check) so seed-data
// UUIDs like e0000000-... pass validation.  The database enforces real UUID
// typing on insert regardless.
const uuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createBookingSchema = z.object({
  doctor_id: z.string().regex(uuidFormat, "Invalid doctor ID format"),
  appointment_date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  consultation_type: z.enum(["in_person", "video"]),
  patient_notes: z.string().max(1000).nullish(),
});

export const cancelBookingSchema = z.object({
  booking_id: z.string().regex(uuidFormat, "Invalid booking ID format"),
  reason: z.string().max(500).nullish(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
