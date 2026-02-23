"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { updatePlatformSetting } from "@/actions/admin";

export function AdminSettingsForm({
  settings,
}: {
  settings: Record<string, string>;
}) {
  const [values, setValues] = useState(settings);
  const [saving, setSaving] = useState("");

  async function handleSave(key: string) {
    setSaving(key);
    const result = await updatePlatformSetting(key, values[key] || "");
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Setting updated");
    }
    setSaving("");
  }

  function updateValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const settingsConfig = [
    {
      key: "platform_commission_rate",
      label: "Platform Commission Rate (%)",
      description: "Percentage of each booking taken as platform fee",
      type: "number",
      defaultValue: "15",
    },
    {
      key: "min_booking_amount_cents",
      label: "Minimum Booking Amount (cents)",
      description: "Minimum amount for a booking in cents",
      type: "number",
      defaultValue: "1000",
    },
    {
      key: "max_booking_advance_days",
      label: "Max Booking Advance (days)",
      description: "How far in advance patients can book",
      type: "number",
      defaultValue: "90",
    },
    {
      key: "pending_payment_timeout_minutes",
      label: "Payment Timeout (minutes)",
      description: "Minutes before pending_payment bookings expire",
      type: "number",
      defaultValue: "15",
    },
    {
      key: "support_email",
      label: "Support Email",
      description: "Email displayed to users for support",
      type: "email",
      defaultValue: "support@mydoctor.com",
    },
  ];

  return (
    <div className="space-y-6">
      {settingsConfig.map((setting) => (
        <Card key={setting.key}>
          <CardHeader>
            <CardTitle className="text-base">{setting.label}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {setting.description}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Input
                  type={setting.type === "number" ? "number" : "text"}
                  value={values[setting.key] || setting.defaultValue}
                  onChange={(e) => updateValue(setting.key, e.target.value)}
                />
              </div>
              <Button
                onClick={() => handleSave(setting.key)}
                disabled={saving === setting.key}
              >
                {saving === setting.key ? "Saving..." : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
