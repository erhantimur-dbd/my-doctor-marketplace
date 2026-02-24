"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { registerDoctor, signInWithGoogle, signInWithApple } from "@/actions/auth";
import { SPECIALTIES } from "@/lib/constants/specialties";
import { COUNTRIES, LANGUAGES } from "@/lib/constants/countries";
import { centsToAmount, amountToCents } from "@/lib/utils/currency";
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  User,
  Stethoscope,
  Building,
  DollarSign,
  CheckCircle2,
} from "lucide-react";

const STEPS = [
  { number: 1, title: "Personal Info", icon: User },
  { number: 2, title: "Professional", icon: Stethoscope },
  { number: 3, title: "Practice", icon: Building },
  { number: 4, title: "Pricing", icon: DollarSign },
  { number: 5, title: "Review", icon: CheckCircle2 },
];

export default function RegisterDoctorPage() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1: Personal info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2: Professional info
  const [title, setTitle] = useState("Dr.");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [yearsOfExperience, setYearsOfExperience] = useState<number>(0);

  // Step 3: Practice details
  const [clinicName, setClinicName] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [consultationTypes, setConsultationTypes] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["en"]);

  // Step 4: Pricing
  const [consultationFee, setConsultationFee] = useState<number>(50);
  const [videoFee, setVideoFee] = useState<number>(40);
  const [currency, setCurrency] = useState("EUR");

  function nextStep() {
    setError("");

    // Validate current step
    if (step === 1) {
      if (!firstName || !lastName || !email || !password) {
        setError("Please fill in all required fields");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    if (step === 2) {
      if (selectedSpecialties.length === 0) {
        setError("Please select at least one specialty");
        return;
      }
    }

    if (step === 3) {
      if (consultationTypes.length === 0) {
        setError("Please select at least one consultation type");
        return;
      }
    }

    setStep((s) => Math.min(s + 1, 5));
  }

  function prevStep() {
    setError("");
    setStep((s) => Math.max(s - 1, 1));
  }

  function toggleSpecialty(slug: string) {
    setSelectedSpecialties((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  function toggleConsultationType(type: string) {
    setConsultationTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function toggleLanguage(code: string) {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.set("first_name", firstName);
    formData.set("last_name", lastName);
    formData.set("email", email);
    formData.set("password", password);

    const result = await registerDoctor(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
    // If successful, registerDoctor redirects to verify-email
  }

  function getSelectedCountry() {
    return COUNTRIES.find((c) => c.code === country);
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.number;
            const isCompleted = step > s.number;
            return (
              <div key={s.number} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span
                    className={`mt-1 text-xs ${isActive ? "font-medium text-primary" : "text-muted-foreground"}`}
                  >
                    {s.title}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-2 h-0.5 w-8 sm:w-16 ${
                      step > s.number ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Join MyDoctor as a Doctor</CardTitle>
          <CardDescription>
            Step {step} of 5 -{" "}
            {STEPS.find((s) => s.number === step)?.title}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Step 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-3">
                <form
                  action={async () => {
                    await signInWithGoogle();
                  }}
                >
                  <Button variant="outline" className="w-full" type="submit">
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                </form>

                <form
                  action={async () => {
                    await signInWithApple();
                  }}
                >
                  <Button variant="outline" className="w-full" type="submit">
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                    </svg>
                    Continue with Apple
                  </Button>
                </form>
              </div>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">
                  or fill in manually
                </span>
                <Separator className="flex-1" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dr.smith@clinic.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
            </div>
          )}

          {/* Step 2: Professional Info */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Select value={title} onValueChange={setTitle}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dr.">Dr.</SelectItem>
                      <SelectItem value="Prof.">Prof.</SelectItem>
                      <SelectItem value="Prof. Dr.">Prof. Dr.</SelectItem>
                      <SelectItem value="Assoc. Prof.">Assoc. Prof.</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Years of Experience</Label>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={yearsOfExperience}
                    onChange={(e) =>
                      setYearsOfExperience(parseInt(e.target.value) || 0)
                    }
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Specialties *</Label>
                <p className="text-sm text-muted-foreground">
                  Select one or more specialties that describe your practice
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {SPECIALTIES.map((specialty) => {
                    const label = specialty.nameKey
                      .replace("specialty.", "")
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase());
                    const isSelected = selectedSpecialties.includes(
                      specialty.slug
                    );
                    return (
                      <Badge
                        key={specialty.slug}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer px-3 py-1.5"
                        onClick={() => toggleSpecialty(specialty.slug)}
                      >
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Practice Details */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Clinic Name</Label>
                <Input
                  placeholder="e.g., City Medical Center"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Clinic Address</Label>
                <Input
                  placeholder="Full street address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Consultation Types *</Label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={consultationTypes.includes("in_person")}
                      onCheckedChange={() =>
                        toggleConsultationType("in_person")
                      }
                    />
                    <span className="text-sm">In Person</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={consultationTypes.includes("video")}
                      onCheckedChange={() => toggleConsultationType("video")}
                    />
                    <span className="text-sm">Video Consultation</span>
                  </label>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Languages Spoken</Label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <Badge
                      key={lang.code}
                      variant={
                        selectedLanguages.includes(lang.code)
                          ? "default"
                          : "outline"
                      }
                      className="cursor-pointer"
                      onClick={() => toggleLanguage(lang.code)}
                    >
                      {lang.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Pricing */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    <SelectItem value="TRY">TRY - Turkish Lira</SelectItem>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>In-Person Consultation Fee</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {currency}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      className="pl-14"
                      value={consultationFee}
                      onChange={(e) =>
                        setConsultationFee(parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Video Consultation Fee</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {currency}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      className="pl-14"
                      value={videoFee}
                      onChange={(e) =>
                        setVideoFee(parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                You can change your pricing anytime from your dashboard settings.
                Prices are displayed to patients in the currency you select.
              </p>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 font-semibold">Personal Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name: </span>
                    {title} {firstName} {lastName}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email: </span>
                    {email}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="mb-3 font-semibold">Professional Details</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Experience: </span>
                    {yearsOfExperience} years
                  </div>
                  <div>
                    <span className="text-muted-foreground">Specialties: </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {selectedSpecialties.map((slug) => {
                        const spec = SPECIALTIES.find((s) => s.slug === slug);
                        const label = spec
                          ? spec.nameKey
                              .replace("specialty.", "")
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())
                          : slug;
                        return (
                          <Badge key={slug} variant="secondary" className="text-xs">
                            {label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="mb-3 font-semibold">Practice Details</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {clinicName && (
                    <div>
                      <span className="text-muted-foreground">Clinic: </span>
                      {clinicName}
                    </div>
                  )}
                  {address && (
                    <div>
                      <span className="text-muted-foreground">Address: </span>
                      {address}
                    </div>
                  )}
                  {country && (
                    <div>
                      <span className="text-muted-foreground">Country: </span>
                      {getSelectedCountry()?.name || country}
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Types: </span>
                    {consultationTypes
                      .map((t) => (t === "in_person" ? "In Person" : "Video"))
                      .join(", ")}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Languages: </span>
                    {selectedLanguages
                      .map(
                        (code) =>
                          LANGUAGES.find((l) => l.code === code)?.name || code
                      )
                      .join(", ")}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="mb-3 font-semibold">Pricing</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">
                      In-Person Fee:{" "}
                    </span>
                    {consultationFee} {currency}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Video Fee: </span>
                    {videoFee} {currency}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  By clicking &quot;Create Account&quot;, you agree to our Terms
                  of Service and Privacy Policy. Your account will need email
                  verification before it becomes active. Additional profile details
                  (education, certifications, photos) can be added from your
                  dashboard after registration.
                </p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          {step > 1 ? (
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <Button onClick={nextStep}>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          )}
        </CardFooter>
      </Card>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
