import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { VideoWaitingRoom } from "@/components/booking/video-waiting-room";
import { formatSpecialtyName } from "@/lib/utils";

interface VideoRoomPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default async function VideoRoomPage({ params }: VideoRoomPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  const { data: booking } = await supabase
    .from("bookings")
    .select(`
      id,
      appointment_date,
      start_time,
      end_time,
      consultation_type,
      video_room_url,
      status,
      doctor:doctors!bookings_doctor_id_fkey(
        title,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
        specialties:doctor_specialties(
          specialty:specialties(name_key),
          is_primary
        )
      )
    `)
    .eq("id", id)
    .eq("patient_id", user.id)
    .single();

  if (!booking) notFound();

  // Must be a video appointment with a room URL
  if (
    booking.consultation_type !== "video" ||
    !booking.video_room_url ||
    !["confirmed", "approved"].includes(booking.status)
  ) {
    redirect(`/dashboard/bookings/${id}`);
  }

  const doctor: any = Array.isArray(booking.doctor)
    ? booking.doctor[0]
    : booking.doctor;
  const doctorProfile: any = doctor
    ? Array.isArray(doctor.profile)
      ? doctor.profile[0]
      : doctor.profile
    : null;

  const primarySpecialty = doctor?.specialties?.find(
    (s: { is_primary: boolean }) => s.is_primary
  )?.specialty || doctor?.specialties?.[0]?.specialty;

  const doctorName = `${doctor?.title || "Dr."} ${doctorProfile?.first_name || ""} ${doctorProfile?.last_name || ""}`.trim();
  const specialty = primarySpecialty
    ? formatSpecialtyName(primarySpecialty.name_key)
    : "";

  // Extract time from timestamps
  const startTime =
    typeof booking.start_time === "string" && booking.start_time.includes("T")
      ? booking.start_time.split("T")[1]?.slice(0, 8) || booking.start_time
      : booking.start_time;

  const endTime =
    typeof booking.end_time === "string" && booking.end_time.includes("T")
      ? booking.end_time.split("T")[1]?.slice(0, 8) || booking.end_time
      : booking.end_time;

  return (
    <div className="py-6">
      <VideoWaitingRoom
        videoRoomUrl={booking.video_room_url}
        appointmentDate={booking.appointment_date}
        startTime={startTime}
        endTime={endTime}
        doctorName={doctorName}
        doctorAvatarUrl={doctorProfile?.avatar_url || null}
        specialty={specialty}
      />
    </div>
  );
}
