import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminBookingWizard } from "./admin-booking-wizard";

export default async function AdminCreateBookingPage() {
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Create Booking on Behalf of Patient</h1>
      <AdminBookingWizard />
    </div>
  );
}
