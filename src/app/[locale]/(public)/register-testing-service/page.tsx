"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { registerTestingService } from "@/actions/auth";
import { getTestingSpecialties } from "@/lib/constants/specialties";
import { COUNTRIES, LANGUAGES } from "@/lib/constants/countries";
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  User,
  FlaskConical,
  Building,
  CheckCircle2,
} from "lucide-react";

const TESTING_SPECIALTIES = getTestingSpecialties();

const STEPS = [
  { number: 1, title: "Personal Info", icon: User },
  { number: 2, title: "Service Details", icon: FlaskConical },
  { number: 3, title: "Practice", icon: Building },
  { number: 4, title: "Review", icon: CheckCircle2 },
];

export default function RegisterTestingServicePage() {
  const locale = useLocale();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1: Personal info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2: Service details
  const [serviceName, setServiceName] = useState("");
  const [selectedTestTypes, setSelectedTestTypes] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["en"]);

  // Step 3: Practice details
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");

  function nextStep() {
    setError("");

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
      if (selectedTestTypes.length === 0) {
        setError("Please select at least one test type");
        return;
      }
    }

    setStep((s) => Math.min(s + 1, 4));
  }

  function prevStep() {
    setError("");
    setStep((s) => Math.max(s - 1, 1));
  }

  function toggleTestType(slug: string) {
    setSelectedTestTypes((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
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
    formData.set("locale", locale);

    const result = await registerTestingService(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
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
                        ? "bg-teal-600 text-white"
                        : isCompleted
                          ? "bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400"
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
                    className={`mt-1 text-xs ${isActive ? "font-medium text-teal-600" : "text-muted-foreground"}`}
                  >
                    {s.title}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-2 h-0.5 w-8 sm:w-16 ${
                      step > s.number ? "bg-teal-600" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Card className="border-teal-200 dark:border-teal-900">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/30">
            <FlaskConical className="h-6 w-6 text-teal-600" />
          </div>
          <CardTitle className="text-2xl">Register as a Testing Service</CardTitle>
          <CardDescription>
            Step {step} of 4 —{" "}
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
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@clinic.com"
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
                  placeholder="Minimum 8 characters"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-teal-600 hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          )}

          {/* Step 2: Service Details */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="serviceName">Service / Clinic Name</Label>
                <Input
                  id="serviceName"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="e.g. London Blood Testing Centre"
                />
              </div>

              <div className="space-y-3">
                <Label>Test Types Offered *</Label>
                <p className="text-xs text-muted-foreground">
                  Select all test types your service provides
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {TESTING_SPECIALTIES.map((spec) => {
                    const isSelected = selectedTestTypes.includes(spec.slug);
                    const displayName = spec.nameKey
                      .replace("specialty.", "")
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase());
                    return (
                      <div
                        key={spec.slug}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors ${
                          isSelected
                            ? "border-teal-300 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/30"
                            : "hover:border-muted-foreground/30"
                        }`}
                        onClick={() => toggleTestType(spec.slug)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleTestType(spec.slug)}
                        />
                        <span className="text-sm">{displayName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Languages Spoken</Label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => {
                    const isSelected = selectedLanguages.includes(lang.code);
                    return (
                      <Badge
                        key={lang.code}
                        variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-teal-600 hover:bg-teal-700"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => toggleLanguage(lang.code)}
                      >
                        {lang.name}
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
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 High Street, London"
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

              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  Testing services are offered as in-person appointments. Patients will visit your location for their tests.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-4">
                {/* Personal Info */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground">
                    Personal Info
                  </h4>
                  <div className="mt-2 rounded-lg border p-3 text-sm">
                    <p>
                      <strong>Name:</strong> {firstName} {lastName}
                    </p>
                    <p>
                      <strong>Email:</strong> {email}
                    </p>
                  </div>
                </div>

                {/* Service Details */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground">
                    Service Details
                  </h4>
                  <div className="mt-2 rounded-lg border p-3 text-sm">
                    {serviceName && (
                      <p>
                        <strong>Service Name:</strong> {serviceName}
                      </p>
                    )}
                    <p className="mt-1">
                      <strong>Test Types:</strong>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {selectedTestTypes.map((slug) => {
                        const spec = TESTING_SPECIALTIES.find(
                          (s) => s.slug === slug
                        );
                        const displayName = spec
                          ? spec.nameKey
                              .replace("specialty.", "")
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())
                          : slug;
                        return (
                          <Badge
                            key={slug}
                            variant="secondary"
                            className="text-xs"
                          >
                            {displayName}
                          </Badge>
                        );
                      })}
                    </div>
                    <p className="mt-2">
                      <strong>Languages:</strong>{" "}
                      {selectedLanguages
                        .map(
                          (code) =>
                            LANGUAGES.find((l) => l.code === code)?.name ||
                            code
                        )
                        .join(", ")}
                    </p>
                  </div>
                </div>

                {/* Practice Details */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground">
                    Practice Details
                  </h4>
                  <div className="mt-2 rounded-lg border p-3 text-sm">
                    {address && (
                      <p>
                        <strong>Address:</strong> {address}
                      </p>
                    )}
                    {country && (
                      <p>
                        <strong>Country:</strong>{" "}
                        {getSelectedCountry()?.name || country}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-4 text-sm dark:border-teal-900 dark:bg-teal-950/20">
                <p className="text-teal-800 dark:text-teal-200">
                  By registering, you agree to our{" "}
                  <Link href="/terms" className="underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="underline">
                    Privacy Policy
                  </Link>
                  . Your service will be listed after verification.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-6 flex justify-between">
            {step > 1 ? (
              <Button variant="outline" onClick={prevStep} disabled={loading}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <Button
                onClick={nextStep}
                className="bg-teal-600 hover:bg-teal-700"
              >
                Continue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FlaskConical className="mr-2 h-4 w-4" />
                )}
                {loading ? "Creating account..." : "Create Testing Service Account"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Already a doctor? */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Want to register as a doctor instead?{" "}
        <Link href="/register-doctor" className="text-primary hover:underline">
          Register as a Doctor
        </Link>
      </p>
    </div>
  );
}
