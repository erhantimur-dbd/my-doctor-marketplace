import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Settings } from "lucide-react";
import { AdminSettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  const { supabase, profile, user } = await requireAdminPage();

  const { data: settings } = await supabase
    .from("platform_settings")
    .select("*");

  const settingsMap: Record<string, string> = {};
  settings?.forEach((s: { key: string; value: string }) => {
    settingsMap[s.key] = s.value;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Platform Settings</h1>
      </div>

      <AdminSettingsForm
        settings={settingsMap}
        adminProfile={{
          firstName: profile?.first_name || "",
          lastName: profile?.last_name || "",
          email: profile?.email || user.email || "",
        }}
      />
    </div>
  );
}
