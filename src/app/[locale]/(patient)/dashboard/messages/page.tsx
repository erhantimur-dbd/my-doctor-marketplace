import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NotificationInbox } from "@/components/shared/notification-inbox";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

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
        dashboardPath="/dashboard"
      />
    </div>
  );
}
