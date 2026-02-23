import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SettingsForm } from "./settings-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      `
      id,
      first_name,
      last_name,
      phone,
      preferred_locale,
      preferred_currency,
      notification_email,
      notification_sms,
      notification_whatsapp
    `
    )
    .eq("id", user.id)
    .single();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsForm
        profile={
          profile || {
            id: user.id,
            first_name: "",
            last_name: "",
            phone: "",
            preferred_locale: "en",
            preferred_currency: "EUR",
            notification_email: true,
            notification_sms: false,
            notification_whatsapp: false,
          }
        }
        userEmail={user.email || ""}
      />
    </div>
  );
}
