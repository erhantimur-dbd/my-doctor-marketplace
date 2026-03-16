import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmailTestPanel } from "./email-test-panel";

export default async function AdminEmailTestsPage() {
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Email Template Testing</h1>
        <p className="text-muted-foreground">
          Send test emails for all 24 templates to verify formatting and delivery.
        </p>
      </div>
      <EmailTestPanel userEmail={user.email || ""} />
    </div>
  );
}
