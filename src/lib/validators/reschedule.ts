import { z } from "zod/v4";

const uuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const requestRescheduleSchema = z.object({
  booking_id: z.string().regex(uuidFormat, "Invalid booking ID"),
  new_date: z.string(), // YYYY-MM-DD
  new_start_time: z.string(), // HH:MM
  new_end_time: z.string(), // HH:MM
});

export const respondRescheduleSchema = z.object({
  reschedule_id: z.string().regex(uuidFormat, "Invalid reschedule ID"),
  action: z.enum(["approve", "reject"]),
  rejection_reason: z.string().max(500).nullish(),
});

export type RequestRescheduleInput = z.infer<typeof requestRescheduleSchema>;
export type RespondRescheduleInput = z.infer<typeof respondRescheduleSchema>;
