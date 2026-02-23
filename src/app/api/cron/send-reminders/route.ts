import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  // 24h reminders
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);

  const { data: bookings24h } = await supabase
    .from("bookings")
    .select("id, patient_id, doctor_id, start_time")
    .in("status", ["confirmed", "approved"])
    .eq("reminder_24h_sent", false)
    .gte("start_time", in23h.toISOString())
    .lte("start_time", in24h.toISOString());

  if (bookings24h) {
    for (const booking of bookings24h) {
      // Create in-app notification
      await supabase.from("notifications").insert({
        user_id: booking.patient_id,
        type: "booking_reminder_24h",
        title: "Appointment Tomorrow",
        body: "Your appointment is scheduled for tomorrow. Don't forget!",
        data: { booking_id: booking.id },
        channel: "in_app",
      });

      await supabase
        .from("bookings")
        .update({ reminder_24h_sent: true })
        .eq("id", booking.id);
    }
  }

  // 1h reminders
  const in1h = new Date(now.getTime() + 60 * 60 * 1000);
  const in30min = new Date(now.getTime() + 30 * 60 * 1000);

  const { data: bookings1h } = await supabase
    .from("bookings")
    .select("id, patient_id, doctor_id, start_time")
    .in("status", ["confirmed", "approved"])
    .eq("reminder_1h_sent", false)
    .gte("start_time", in30min.toISOString())
    .lte("start_time", in1h.toISOString());

  if (bookings1h) {
    for (const booking of bookings1h) {
      await supabase.from("notifications").insert({
        user_id: booking.patient_id,
        type: "booking_reminder_1h",
        title: "Appointment in 1 Hour",
        body: "Your appointment starts in about 1 hour.",
        data: { booking_id: booking.id },
        channel: "in_app",
      });

      await supabase
        .from("bookings")
        .update({ reminder_1h_sent: true })
        .eq("id", booking.id);
    }
  }

  return NextResponse.json({
    reminders_24h: bookings24h?.length || 0,
    reminders_1h: bookings1h?.length || 0,
  });
}
