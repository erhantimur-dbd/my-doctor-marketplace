"use server";

import {
  DOCTOR_BOOKINGS_SELECT,
  presentDoctorBookingsForClient,
} from "@/lib/doctor/doctor-bookings-query";
import { createClient } from "@/lib/supabase/server";

/**
 * Refetch the signed-in doctor's bookings without sending Daily room URLs
 * to the browser. The client receives has_video_room instead.
 */
export async function reloadDoctorBookings(doctorId: string): Promise<{
  data: ReturnType<typeof presentDoctorBookingsForClient> | null;
  error: string | null;
}> {
  if (!doctorId) return { data: null, error: "unauthorised" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "unauthorised" };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .eq("id", doctorId)
    .maybeSingle();
  if (!doctor) return { data: null, error: "unauthorised" };

  const { data, error } = await supabase
    .from("bookings")
    .select(DOCTOR_BOOKINGS_SELECT)
    .eq("doctor_id", doctor.id)
    .order("appointment_date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: presentDoctorBookingsForClient(data ?? []), error: null };
}
