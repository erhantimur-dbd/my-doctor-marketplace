"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  MapPin,
  Users,
  CheckCircle2,
  Plus,
  Trash2,
  Mail,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Stethoscope,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { createClinicLocation } from "@/actions/clinic-locations";
import { sendClinicInvitation } from "@/actions/clinic-invitations";
import { createAdminClient } from "@/lib/supabase/admin";

interface Props {
  org: any;
  license: any;
  locations: any[];
  invitations: any[];
  currentStep: number;
  locale: string;
}

const STEPS = [
  { id: 0, title: "Clinic Profile", icon: Building2, description: "Set up your clinic's public identity" },
  { id: 1, title: "Locations", icon: MapPin, description: "Add your clinic branches" },
  { id: 2, title: "Invite Team", icon: Users, description: "Invite doctors and staff" },
  { id: 3, title: "All Done!", icon: CheckCircle2, description: "Your clinic is ready" },
];

export function ClinicOnboardingWizard({
  org,
  license,
  locations: initialLocations,
  invitations: initialInvitations,
  currentStep: initialStep,
  locale,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 0 — clinic profile
  const [clinicName, setClinicName] = useState(org?.name ?? "");
  const [description, setDescription] = useState(org?.description ?? "");
  const [phone, setPhone] = useState(org?.phone ?? "");
  const [email, setEmail] = useState(org?.email ?? "");
  const [website, setWebsite] = useState(org?.website ?? "");

  // Step 1 — locations
  const [locations, setLocations] = useState<any[]>(initialLocations);
  const [showAddLocation, setShowAddLocation] = useState(initialLocations.length === 0);
  const [locName, setLocName] = useState("");
  const [locAddress, setLocAddress] = useState("");
  const [locCity, setLocCity] = useState("");
  const [locPostcode, setLocPostcode] = useState("");
  const [locPhone, setLocPhone] = useState("");
  const [locPrimary, setLocPrimary] = useState(initialLocations.length === 0);

  // Step 2 — invite
  const [invitations, setInvitations] = useState(initialInvitations);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"doctor" | "admin" | "staff">("doctor");
  const [inviteSending, setInviteSending] = useState(false);

  const maxSeats = license?.max_seats ?? 5;
  const doctorInvitesSent = invitations.filter(
    (i) => i.role === "doctor" && i.status === "pending"
  ).length;
  const seatsRemaining = maxSeats - doctorInvitesSent;

  async function saveProfile() {
    setError(null);
    // Update org profile via server action
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from("organizations")
      .update({
        name: clinicName,
        description,
        phone: phone || null,
        email: email || null,
        website: website || null,
        onboarding_step: 1,
      })
      .eq("id", org.id);
    if (updateError) { setError(updateError.message); return false; }
    return true;
  }

  async function addLocation() {
    setError(null);
    if (!locName) { setError("Location name is required"); return; }
    const fd = new FormData();
    fd.set("name", locName);
    fd.set("address_line1", locAddress);
    fd.set("city", locCity);
    fd.set("postal_code", locPostcode);
    fd.set("phone", locPhone);
    fd.set("is_primary", String(locPrimary || locations.length === 0));
    const result = await createClinicLocation(fd);
    if (result.error) { setError(result.error); return; }
    setLocations((prev) => [
      ...prev,
      { id: result.locationId, name: locName, city: locCity, is_primary: locPrimary || prev.length === 0 },
    ]);
    setLocName(""); setLocAddress(""); setLocCity(""); setLocPostcode(""); setLocPhone("");
    setLocPrimary(false); setShowAddLocation(false);
  }

  async function sendInvite() {
    setError(null);
    if (!inviteEmail) { setError("Email is required"); return; }
    if (inviteRole === "doctor" && seatsRemaining <= 0) {
      setError("No doctor seats remaining. You can add extra seats from the billing page.");
      return;
    }
    setInviteSending(true);
    const fd = new FormData();
    fd.set("email", inviteEmail);
    fd.set("role", inviteRole);
    fd.set("location_ids", JSON.stringify(locations.map((l) => l.id)));
    const result = await sendClinicInvitation(fd);
    setInviteSending(false);
    if (result.error) { setError(result.error); return; }
    setInvitations((prev) => [
      { id: result.token, email: inviteEmail, role: inviteRole, status: "pending", created_at: new Date().toISOString() },
      ...prev,
    ]);
    setInviteEmail("");
  }

  async function completeOnboarding() {
    const admin = createAdminClient();
    await admin
      .from("organizations")
      .update({ onboarding_completed_at: new Date().toISOString(), onboarding_step: 4 })
      .eq("id", org.id);
    router.push(`/${locale}/doctor-dashboard/organization`);
    router.refresh();
  }

  function handleNext() {
    setError(null);
    startTransition(async () => {
      if (step === 0) {
        const ok = await saveProfile();
        if (ok) setStep(1);
      } else if (step === 1) {
        if (locations.length === 0) { setError("Please add at least one location"); return; }
        const admin = createAdminClient();
        await admin.from("organizations").update({ onboarding_step: 2 }).eq("id", org.id);
        setStep(2);
      } else if (step === 2) {
        const admin = createAdminClient();
        await admin.from("organizations").update({ onboarding_step: 3 }).eq("id", org.id);
        setStep(3);
      }
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white px-4 py-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 shadow-md">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set Up Your Clinic</h1>
          <p className="mt-1 text-gray-500">Let&apos;s get {org?.name || "your clinic"} up and running in a few steps</p>
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    i < step
                      ? "bg-sky-600 text-white"
                      : i === step
                      ? "border-2 border-sky-600 bg-white text-sky-600"
                      : "border-2 border-gray-200 bg-white text-gray-400"
                  }`}
                >
                  {i < step ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                </div>
                <span className={`mt-1 hidden text-xs sm:block ${i === step ? "font-semibold text-sky-700" : "text-gray-400"}`}>
                  {s.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-2 h-0.5 flex-1 transition-colors ${i < step ? "bg-sky-600" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <Card>
          {/* ── Step 0: Clinic Profile ── */}
          {step === 0 && (
            <>
              <CardHeader>
                <CardTitle>Clinic Profile</CardTitle>
                <CardDescription>This information will appear on your public clinic page</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Clinic Name *</Label>
                  <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="e.g. City Health Clinic" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Briefly describe your clinic, specialties, and what makes you unique…"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 20 1234 5678" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@yourclinic.com" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourclinic.com" />
                </div>
              </CardContent>
            </>
          )}

          {/* ── Step 1: Locations ── */}
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Clinic Locations</CardTitle>
                <CardDescription>Add all branches where your team works. Doctors can be assigned to specific locations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {locations.length > 0 && (
                  <div className="space-y-2">
                    {locations.map((loc) => (
                      <div key={loc.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-sky-500 shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{loc.name}</p>
                            {loc.city && <p className="text-xs text-muted-foreground">{loc.city}</p>}
                          </div>
                        </div>
                        {loc.is_primary && (
                          <Badge variant="secondary" className="text-xs">Primary</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {showAddLocation ? (
                  <div className="rounded-lg border bg-sky-50/40 p-4 space-y-3">
                    <p className="text-sm font-semibold text-sky-800">New Location</p>
                    <div className="space-y-1.5">
                      <Label>Branch Name *</Label>
                      <Input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="e.g. City Centre Branch" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Address</Label>
                      <Input value={locAddress} onChange={(e) => setLocAddress(e.target.value)} placeholder="123 High Street" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>City</Label>
                        <Input value={locCity} onChange={(e) => setLocCity(e.target.value)} placeholder="London" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Postcode</Label>
                        <Input value={locPostcode} onChange={(e) => setLocPostcode(e.target.value)} placeholder="EC1A 1BB" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Phone</Label>
                      <Input value={locPhone} onChange={(e) => setLocPhone(e.target.value)} placeholder="+44 20 1234 5678" />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="isPrimary"
                        checked={locPrimary || locations.length === 0}
                        onChange={(e) => setLocPrimary(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="isPrimary" className="text-sm cursor-pointer">Set as primary location</Label>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={addLocation} disabled={isPending}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />Add Location
                      </Button>
                      {locations.length > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => setShowAddLocation(false)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => setShowAddLocation(true)}>
                    <Plus className="mr-2 h-4 w-4" />Add Another Location
                  </Button>
                )}
              </CardContent>
            </>
          )}

          {/* ── Step 2: Invite Team ── */}
          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Invite Your Team</CardTitle>
                <CardDescription>
                  You have <strong>{maxSeats} doctor seats</strong> included. Admin and staff seats are free.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Seat summary */}
                <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Doctor seats remaining</span>
                  <span className="font-semibold">{seatsRemaining} / {maxSeats}</span>
                </div>

                {/* Sent invitations */}
                {invitations.length > 0 && (
                  <div className="space-y-2">
                    {invitations.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                        <div className="flex items-center gap-3">
                          {inv.role === "doctor"
                            ? <Stethoscope className="h-4 w-4 text-blue-500" />
                            : <ShieldCheck className="h-4 w-4 text-purple-500" />}
                          <div>
                            <p className="text-sm font-medium">{inv.email}</p>
                            <p className="text-xs text-muted-foreground capitalize">{inv.role}</p>
                          </div>
                        </div>
                        <Badge
                          variant={inv.status === "accepted" ? "default" : "secondary"}
                          className="text-xs capitalize"
                        >
                          {inv.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Invite form */}
                <div className="rounded-lg border bg-sky-50/40 p-4 space-y-3">
                  <p className="text-sm font-semibold text-sky-800">Send Invitation</p>
                  <div className="space-y-1.5">
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="doctor@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="doctor">Doctor (uses a seat)</SelectItem>
                        <SelectItem value="admin">Admin (free)</SelectItem>
                        <SelectItem value="staff">Staff (free)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    onClick={sendInvite}
                    disabled={inviteSending || !inviteEmail}
                  >
                    {inviteSending ? (
                      <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Sending…</>
                    ) : (
                      <><Mail className="mr-1.5 h-3.5 w-3.5" />Send Invitation</>
                    )}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Invitations expire after 7 days. You can send more from the Members page at any time.
                </p>
              </CardContent>
            </>
          )}

          {/* ── Step 3: Done ── */}
          {step === 3 && (
            <>
              <CardHeader>
                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-center text-2xl">Your Clinic is Ready!</CardTitle>
                <CardDescription className="text-center">
                  {org?.name} is now set up on MyDoctors360.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border divide-y">
                  <SummaryRow icon={<Building2 className="h-4 w-4" />} label="Clinic" value={clinicName || org?.name} />
                  <SummaryRow icon={<MapPin className="h-4 w-4" />} label="Locations" value={`${locations.length} location${locations.length !== 1 ? "s" : ""}`} />
                  <SummaryRow icon={<Users className="h-4 w-4" />} label="Invitations sent" value={`${invitations.length} team member${invitations.length !== 1 ? "s" : ""}`} />
                </div>
                <Alert className="border-sky-200 bg-sky-50">
                  <AlertDescription className="text-sm text-sky-800">
                    <strong>3 hours of dedicated onboarding</strong> is included in your Clinic Starter Pack. Your account manager will be in touch within 1 business day.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="mx-6 mb-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          <CardFooter className="flex justify-between">
            {step > 0 && step < 3 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={isPending}>
                <ArrowLeft className="mr-2 h-4 w-4" />Back
              </Button>
            ) : (
              <div />
            )}
            {step < 3 ? (
              <Button onClick={handleNext} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {step === 2 ? "Continue" : "Next"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={completeOnboarding}>
                Go to Dashboard<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}{label}
      </div>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
