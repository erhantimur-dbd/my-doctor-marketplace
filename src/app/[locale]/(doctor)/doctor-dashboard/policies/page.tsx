"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Clock,
  Save,
  Loader2,
  CheckCircle2,
  Shield,
  AlertTriangle,
  Zap,
} from "lucide-react";

const POLICIES = [
  {
    value: "flexible",
    label: "Flexible",
    icon: Zap,
    description:
      "Patients can cancel free of charge up to 2 hours before the appointment. This is recommended for new doctors to attract more bookings.",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  {
    value: "moderate",
    label: "Moderate",
    icon: Shield,
    description:
      "Patients can cancel free of charge up to 24 hours before the appointment. A 50% fee applies for cancellations within 24 hours.",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  {
    value: "strict",
    label: "Strict",
    icon: AlertTriangle,
    description:
      "Patients can cancel free of charge up to 48 hours before the appointment. A 100% fee applies for cancellations within 48 hours. No refund for no-shows.",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
];

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function PoliciesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [cancellationPolicy, setCancellationPolicy] = useState("flexible");
  const [cancellationHours, setCancellationHours] = useState(24);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: doctor } = await supabase
      .from("doctors")
      .select("id, cancellation_policy, cancellation_hours")
      .eq("profile_id", user.id)
      .single();
    if (!doctor) return;

    setDoctorId(doctor.id);
    setCancellationPolicy(doctor.cancellation_policy || "flexible");
    setCancellationHours(doctor.cancellation_hours || 24);
    setLoading(false);
  }

  async function handleSave() {
    if (!doctorId) return;
    setSaving(true);
    setSaved(false);

    const supabase = createSupabase();
    await supabase
      .from("doctors")
      .update({
        cancellation_policy: cancellationPolicy,
        cancellation_hours: cancellationHours,
      })
      .eq("id", doctorId);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cancellation Policy</h1>
        <p className="text-muted-foreground">
          Set your cancellation policy to manage patient expectations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Select Your Policy
          </CardTitle>
          <CardDescription>
            Choose the cancellation policy that best fits your practice. This will
            be displayed on your public profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={cancellationPolicy}
            onValueChange={setCancellationPolicy}
            className="space-y-4"
          >
            {POLICIES.map((policy) => {
              const Icon = policy.icon;
              const isSelected = cancellationPolicy === policy.value;
              return (
                <label
                  key={policy.value}
                  className={`flex cursor-pointer items-start gap-4 rounded-lg border-2 p-4 transition-colors ${
                    isSelected
                      ? `${policy.borderColor} ${policy.bgColor}`
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem
                    value={policy.value}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${policy.color}`} />
                      <span className="font-semibold">{policy.label}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {policy.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Cancellation Window
          </CardTitle>
          <CardDescription>
            Set the minimum number of hours before an appointment that a patient
            can cancel without penalty.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="cancellation-hours">
              Minimum hours before appointment
            </Label>
            <Input
              id="cancellation-hours"
              type="number"
              min={1}
              max={168}
              value={cancellationHours}
              onChange={(e) =>
                setCancellationHours(parseInt(e.target.value) || 24)
              }
            />
            <p className="text-xs text-muted-foreground">
              Patients will be able to cancel for free up to {cancellationHours}{" "}
              hour{cancellationHours !== 1 ? "s" : ""} before the appointment.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saved ? "Policy Saved" : "Save Policy"}
        </Button>
      </div>
    </div>
  );
}
