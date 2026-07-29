"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { updatePlatformSetting, updateAdminProfile } from "@/actions/admin";
import { User, ShieldAlert } from "lucide-react";
import { DEFAULT_BLOCKED_KEYWORDS } from "@/lib/reviews/blocked-keywords";

interface AdminSettingsFormProps {
  settings: Record<string, string>;
  adminProfile: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

function parseKeywords(value: string | undefined): string {
  if (!value) return DEFAULT_BLOCKED_KEYWORDS.join("\n");
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.join("\n");
  } catch {
    // plain newline / comma list
    return value;
  }
  return value;
}

export function AdminSettingsForm({
  settings,
  adminProfile,
}: AdminSettingsFormProps) {
  const [values, setValues] = useState(settings);
  const [saving, setSaving] = useState("");
  const [keywordsText, setKeywordsText] = useState(
    parseKeywords(settings.review_blocked_keywords)
  );

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

  async function handleSaveKeywords() {
    setSaving("review_blocked_keywords");
    const list = keywordsText
      .split(/[\n,]+/)
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    // de-dupe
    const unique = [...new Set(list)];
    const result = await updatePlatformSetting(
      "review_blocked_keywords",
      JSON.stringify(unique)
    );
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(`Saved ${unique.length} blocked keywords`);
      setValues((prev) => ({
        ...prev,
        review_blocked_keywords: JSON.stringify(unique),
      }));
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
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" />
            Review Keyword Blocklist
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Reviews containing these words are flagged for manual moderation
            instead of auto-approval. One keyword or phrase per line.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            rows={12}
            className="font-mono text-sm"
            placeholder="scam&#10;fraud&#10;..."
          />
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Stored as JSON in platform_settings. Empty save falls back to
              built-in defaults at runtime.
            </p>
            <Button
              onClick={handleSaveKeywords}
              disabled={saving === "review_blocked_keywords"}
            >
              {saving === "review_blocked_keywords"
                ? "Saving..."
                : "Save Keywords"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

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
