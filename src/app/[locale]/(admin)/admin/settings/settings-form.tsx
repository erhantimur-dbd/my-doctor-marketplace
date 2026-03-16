"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { updatePlatformSetting, updateAdminProfile } from "@/actions/admin";
import { User } from "lucide-react";

interface AdminSettingsFormProps {
  settings: Record<string, string>;
  adminProfile: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export function AdminSettingsForm({
  settings,
  adminProfile,
}: AdminSettingsFormProps) {
  const [values, setValues] = useState(settings);
  const [saving, setSaving] = useState("");

  // Admin profile state
  const [firstName, setFirstName] = useState(adminProfile.firstName);
  const [lastName, setLastName] = useState(adminProfile.lastName);
  const [savingProfile, setSavingProfile] = useState(false);

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

  async function handleSaveProfile() {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    setSavingProfile(true);
    const result = await updateAdminProfile(firstName, lastName);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Profile updated");
    }
    setSavingProfile(false);
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
      defaultValue: "support@mydoctors360.com",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Admin Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Admin Profile
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Your display name shown on blog posts and platform activity
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={adminProfile.email} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed here
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Currently displayed as:{" "}
              <span className="font-medium text-foreground">
                {firstName} {lastName}
              </span>
            </p>
            <Button
              onClick={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Platform Settings */}
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
