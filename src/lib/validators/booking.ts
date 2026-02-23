import { z } from "zod/v4";

export const createBookingSchema = z.object({
  doctor_id: z.string().uuid(),
  appointment_date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  consultation_type: z.enum(["in_person", "video"]),
  patient_notes: z.string().max(1000).optional(),
});

export const cancelBookingSchema = z.object({
  booking_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
