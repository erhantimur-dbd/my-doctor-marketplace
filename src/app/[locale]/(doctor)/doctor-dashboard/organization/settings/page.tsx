"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { getMyOrganization, updateOrganization } from "@/actions/organization";

const TIMEZONES = [
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Istanbul",
  "Europe/Rome",
  "Europe/Madrid",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Dubai",
  "Australia/Sydney",
];

const CURRENCIES = [
  { value: "EUR", label: "Euro (EUR)" },
  { value: "GBP", label: "British Pound (GBP)" },
  { value: "TRY", label: "Turkish Lira (TRY)" },
  { value: "USD", label: "US Dollar (USD)" },
];

export default function OrganizationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const result = await getMyOrganization();
    setOrg(result.org);
    setMembership(result.membership);
    setLoading(false);
  }

  async function handleSubmit(formData: FormData) {
    setErrorMsg("");
    setSuccessMsg("");
    startTransition(async () => {
      const result = await updateOrganization(formData);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        await loadData();
        setSuccessMsg("Settings saved");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        No organization found. Please set up your practice first.
      </div>
    );
  }

  const isOwnerOrAdmin =
    membership?.role === "owner" || membership?.role === "admin";

  if (!isOwnerOrAdmin) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Only organization owners and admins can manage settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Practice Settings</h1>
        <p className="text-muted-foreground">
          Configure your practice address, timezone, and currency
        </p>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {errorMsg}
        </div>
      )}

      <form action={handleSubmit}>
        {/* Address */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Address</CardTitle>
            <CardDescription>
              Your practice&apos;s physical address
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="address_line1">Address Line 1</Label>
              <Input
                id="address_line1"
                name="address_line1"
                defaultValue={org.address_line1 || ""}
                placeholder="123 Medical Ave"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input
                id="address_line2"
                name="address_line2"
                defaultValue={org.address_line2 || ""}
                placeholder="Suite 100"
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                defaultValue={org.city || ""}
              />
            </div>
            <div>
              <Label htmlFor="state">State / Province</Label>
              <Input
                id="state"
                name="state"
                defaultValue={org.state || ""}
              />
            </div>
            <div>
              <Label htmlFor="postal_code">Postal Code</Label>
              <Input
                id="postal_code"
                name="postal_code"
                defaultValue={org.postal_code || ""}
              />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                name="country"
                defaultValue={org.country || ""}
              />
            </div>
          </CardContent>
        </Card>

        {/* Locale Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Regional Settings</CardTitle>
            <CardDescription>
              Timezone and currency for your practice
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select name="timezone" defaultValue={org.timezone || "Europe/London"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="base_currency">Base Currency</Label>
              <Select
                name="base_currency"
                defaultValue={org.base_currency || "EUR"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Settings
        </Button>
      </form>
    </div>
  );
}
