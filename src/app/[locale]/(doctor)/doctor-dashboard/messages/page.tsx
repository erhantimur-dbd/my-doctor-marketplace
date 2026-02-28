import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NotificationInbox } from "@/components/shared/notification-inbox";
import { UpgradePrompt } from "@/components/shared/upgrade-prompt";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Messages" };

export default async function DoctorMessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  // Check subscription
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (doctor) {
    const { data: subscription } = await supabase
      .from("doctor_subscriptions")
      .select("id")
      .eq("doctor_id", doctor.id)
      .in("status", ["active", "trialing", "past_due"])
      .limit(1)
      .maybeSingle();

    if (!subscription) {
      return <UpgradePrompt feature="Messages" />;
    }
  }

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Messages</h1>
      <NotificationInbox
        initialNotifications={notifications || []}
        dashboardPath="/doctor-dashboard"
      />
    </div>
  );
}
