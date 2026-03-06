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
  service_id: z.string().regex(uuidFormat).nullish(),
  duration_minutes: z.number().int().min(15).max(60).nullish(),
});

export const cancelBookingSchema = z.object({
  booking_id: z.string().regex(uuidFormat, "Invalid booking ID format"),
  reason: z.string().max(500).nullish(),
});

export const doctorServiceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).nullish(),
  price_cents: z.number().int().min(0),
  duration_minutes: z.number().int().refine((v) => [15, 30, 45, 60].includes(v), {
    message: "Duration must be 15, 30, 45, or 60 minutes",
  }),
  consultation_type: z.enum(["in_person", "video", "both"]),
  is_active: z.boolean().optional().default(true),
  display_order: z.number().int().optional().default(0),
});

export const createFollowUpInvitationSchema = z
  .object({
    patient_id: z.string().regex(uuidFormat, "Invalid patient ID"),
    service_id: z.string().regex(uuidFormat).nullish(),
    custom_service_name: z.string().min(1).max(200).nullish(),
    custom_price_cents: z.number().int().min(100).nullish(),
    consultation_type: z.enum(["in_person", "video"]),
    duration_minutes: z.number().int().refine((v) => [15, 30, 45, 60].includes(v), {
      message: "Duration must be 15, 30, 45, or 60 minutes",
    }),
    total_sessions: z.number().int().min(1).max(10),
    discount_type: z.enum(["percentage", "fixed_amount"]).nullish(),
    discount_value: z.number().int().min(0).nullish(),
    doctor_note: z.string().max(1000).nullish(),
  })
  .refine(
    (d) => d.service_id || (d.custom_service_name && d.custom_price_cents),
    { message: "Either a service or custom service name + price is required" }
  );

export const bookFollowUpSessionSchema = z.object({
  invitation_id: z.string().regex(uuidFormat, "Invalid invitation ID"),
  appointment_date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type DoctorServiceInput = z.infer<typeof doctorServiceSchema>;
export type CreateFollowUpInvitationInput = z.infer<typeof createFollowUpInvitationSchema>;
export type BookFollowUpSessionInput = z.infer<typeof bookFollowUpSessionSchema>;
