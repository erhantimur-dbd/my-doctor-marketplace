import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WaitlistDashboard } from "./waitlist-dashboard";
import {
  getAdminWaitlistDoctors,
  getAdminLaunchNotifications,
  getWaitlistAnalytics,
} from "@/actions/waitlist";

export default async function AdminWaitlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/en");

  const [doctorsRes, patientsRes, analyticsRes] = await Promise.all([
    getAdminWaitlistDoctors(),
    getAdminLaunchNotifications(),
    getWaitlistAnalytics(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Waitlist Management</h1>
        <p className="text-sm text-muted-foreground">
          Track doctors and patients waiting for launch in new regions
        </p>
      </div>
      <WaitlistDashboard
        doctors={doctorsRes.data || []}
        patients={patientsRes.data || []}
        analytics={analyticsRes.data}
      />
    </div>
  );
}
