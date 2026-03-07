"use client";

import { useState, useMemo, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  User,
  Calendar,
  CreditCard,
  FileText,
  Loader2,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { formatCurrency, getBookingFeeCents } from "@/lib/utils/currency";
import {
  createTreatmentPlan,
  type CreateTreatmentPlanInput,
} from "@/actions/treatment-plan";

// ─── Types ──────────────────────────────────────────────────────────────

interface WizardProps {
  doctorId: string;
  currency: string;
  services: Array<{
    id: string;
    name: string;
    price_cents: number;
    duration_minutes: number;
    consultation_type: string;
  }>;
  patients: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string | null;
  }>;
  hasStripe: boolean;
}

// ─── Step indicator ─────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: "Patient", icon: User },
  { number: 2, label: "Details", icon: FileText },
  { number: 3, label: "Sessions", icon: Calendar },
  { number: 4, label: "Pricing", icon: CreditCard },
  { number: 5, label: "Review", icon: ClipboardList },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {STEPS.map((s, index) => {
        const isActive = s.number === currentStep;
        const isCompleted = s.number < currentStep;
        const Icon = s.icon;

        return (
          <div key={s.number} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                  isCompleted
                    ? "border-primary bg-primary text-primary-foreground"
                    : isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted-foreground/30 bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={`hidden text-xs sm:block ${
                  isActive
                    ? "font-medium text-primary"
                    : isCompleted
                      ? "text-primary"
                      : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`mx-1 h-0.5 w-6 sm:mx-2 sm:w-10 ${
                  s.number < currentStep ? "bg-primary" : "bg-muted-foreground/20"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Wizard ─────────────────────────────────────────────────────────────

export function TreatmentPlanWizard({
  doctorId,
  currency,
  services,
  patients,
  hasStripe,
}: WizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Step
  const [step, setStep] = useState(1);

  // Step 1: Patient
  const [patientId, setPatientId] = useState("");
  const [patientSearch, setPatientSearch] = useState("");

  // Step 2: Details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customNotes, setCustomNotes] = useState("");

  // Step 3: Sessions
  const [totalSessions, setTotalSessions] = useState(3);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [consultationType, setConsultationType] = useState<
    "in_person" | "video"
  >("in_person");
  const [serviceId, setServiceId] = useState("");
  const [isCustomService, setIsCustomService] = useState(false);
  const [customServiceName, setCustomServiceName] = useState("");
  const [customPriceCents, setCustomPriceCents] = useState(0);

  // Step 4: Pricing
  const [paymentType, setPaymentType] = useState<"pay_full" | "pay_per_visit">(
    "pay_per_visit"
  );
  const [discountType, setDiscountType] = useState<
    "" | "percentage" | "fixed_amount"
  >("");
  const [discountValue, setDiscountValue] = useState(0);

  // ─── Derived data ───────────────────────────────────────────────────

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients;
    const q = patientSearch.toLowerCase();
    return patients.filter(
      (p) =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
    );
  }, [patients, patientSearch]);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === patientId) || null,
    [patients, patientId]
  );

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) || null,
    [services, serviceId]
  );

  const unitPriceCents = useMemo(() => {
    if (isCustomService) return customPriceCents;
    return selectedService?.price_cents || 0;
  }, [isCustomService, customPriceCents, selectedService]);

  const pricing = useMemo(() => {
    const subtotal = unitPriceCents * totalSessions;
    const platformFeePerSession = getBookingFeeCents(currency);
    const totalPlatformFee = platformFeePerSession * totalSessions;

    let discountCents = 0;
    if (discountType === "percentage" && discountValue > 0) {
      discountCents = Math.round((subtotal * discountValue) / 100);
    } else if (discountType === "fixed_amount" && discountValue > 0) {
      discountCents = discountValue;
    }

    const discountedTotal = Math.max(0, subtotal - discountCents);
    const grandTotal = discountedTotal + totalPlatformFee;

    return {
      unitPriceCents,
      subtotal,
      platformFeePerSession,
      totalPlatformFee,
      discountCents,
      discountedTotal,
      grandTotal,
    };
  }, [unitPriceCents, totalSessions, currency, discountType, discountValue]);

  const serviceName = useMemo(() => {
    if (isCustomService) return customServiceName;
    return selectedService?.name || "";
  }, [isCustomService, customServiceName, selectedService]);

  // ─── Validation ─────────────────────────────────────────────────────

  function canAdvance(): boolean {
    switch (step) {
      case 1:
        return !!patientId;
      case 2:
        return !!title.trim();
      case 3:
        if (totalSessions < 1 || totalSessions > 20) return false;
        if (isCustomService) {
          return !!customServiceName.trim() && customPriceCents > 0;
        }
        return !!serviceId;
      case 4:
        if (unitPriceCents <= 0) return false;
        if (pricing.discountedTotal <= 0) return false;
        return true;
      default:
        return true;
    }
  }

  function handleNext() {
    if (!canAdvance()) {
      switch (step) {
        case 1:
          toast.error("Please select a patient to continue.");
          break;
        case 2:
          toast.error("Please enter a plan title.");
          break;
        case 3:
          if (isCustomService) {
            if (!customServiceName.trim())
              toast.error("Please enter a custom service name.");
            else if (customPriceCents <= 0)
              toast.error("Please enter a valid price for the custom service.");
          } else {
            toast.error("Please select a service.");
          }
          break;
        case 4:
          if (pricing.discountedTotal <= 0)
            toast.error(
              "The discount cannot make the total free. Please adjust."
            );
          else toast.error("Please check the pricing details.");
          break;
      }
      return;
    }
    setStep((s) => Math.min(s + 1, 5));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 1));
  }

  // ─── Submit ─────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!hasStripe) {
      toast.error(
        "Please complete your payment setup before creating treatment plans."
      );
      return;
    }

    startTransition(async () => {
      const input: CreateTreatmentPlanInput = {
        patient_id: patientId,
        title: title.trim(),
        description: description.trim() || undefined,
        custom_notes: customNotes.trim() || undefined,
        total_sessions: totalSessions,
        session_duration_minutes: durationMinutes,
        consultation_type: consultationType,
        payment_type: paymentType,
      };

      if (isCustomService) {
        input.custom_service_name = customServiceName.trim();
        input.custom_price_cents = customPriceCents;
      } else {
        input.service_id = serviceId;
      }

      if (discountType && discountValue > 0) {
        input.discount_type = discountType as "percentage" | "fixed_amount";
        input.discount_value = discountValue;
      }

      const result = await createTreatmentPlan(input);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Treatment plan created and sent to the patient!");
        router.push("/doctor-dashboard/treatment-plans");
      }
    });
  }

  // When selecting a service, auto-fill duration and consultation type
  function handleServiceChange(value: string) {
    setServiceId(value);
    const svc = services.find((s) => s.id === value);
    if (svc) {
      setDurationMinutes(svc.duration_minutes);
      if (
        svc.consultation_type === "in_person" ||
        svc.consultation_type === "video"
      ) {
        setConsultationType(svc.consultation_type);
      }
    }
  }

  // ─── Render steps ───────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      default:
        return null;
    }
  }

  // ─── Step 1: Select Patient ─────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Select Patient</h2>
          <p className="text-sm text-muted-foreground">
            Choose a patient to create a treatment plan for. Only patients with
            prior bookings are shown.
          </p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <User className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No patients found. Patients will appear here after their first
              booking with you.
            </p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No patients match your search.
            </p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {filteredPatients.map((p) => {
              const isSelected = patientId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPatientId(p.id)}
                  className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border"
                  }`}
                >
                  <Avatar className="h-10 w-10">
                    {p.avatar_url ? (
                      <AvatarImage
                        src={p.avatar_url}
                        alt={`${p.first_name} ${p.last_name}`}
                      />
                    ) : null}
                    <AvatarFallback>
                      {p.first_name.charAt(0)}
                      {p.last_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {p.first_name} {p.last_name}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {p.email}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Step 2: Treatment Details ──────────────────────────────────────

  function renderStep2() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Treatment Details</h2>
          <p className="text-sm text-muted-foreground">
            Describe the treatment plan for your patient.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Plan Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g., Physiotherapy Recovery Program"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the treatment plan objectives and approach..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customNotes">Notes for Patient</Label>
            <Textarea
              id="customNotes"
              placeholder="Any additional instructions or notes..."
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              These notes will be visible to the patient.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 3: Sessions ───────────────────────────────────────────────

  function renderStep3() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Session Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Configure the number and type of sessions.
          </p>
        </div>

        <div className="space-y-4">
          {/* Total sessions */}
          <div className="space-y-2">
            <Label htmlFor="totalSessions">Number of Sessions (1-20)</Label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={20}
                value={totalSessions}
                onChange={(e) => setTotalSessions(Number(e.target.value))}
                className="flex-1"
              />
              <Input
                id="totalSessions"
                type="number"
                min={1}
                max={20}
                value={totalSessions}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= 1 && val <= 20) setTotalSessions(val);
                }}
                className="w-20"
              />
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Session Duration</Label>
            <Select
              value={String(durationMinutes)}
              onValueChange={(val) => setDurationMinutes(Number(val))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Consultation type */}
          <div className="space-y-2">
            <Label>Consultation Type</Label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConsultationType("in_person")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${
                  consultationType === "in_person"
                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                    : "border-border hover:bg-accent"
                }`}
              >
                <User className="h-4 w-4" />
                In-Person
              </button>
              <button
                type="button"
                onClick={() => setConsultationType("video")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${
                  consultationType === "video"
                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                    : "border-border hover:bg-accent"
                }`}
              >
                <Calendar className="h-4 w-4" />
                Video
              </button>
            </div>
          </div>

          <Separator />

          {/* Service selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="customService"
                checked={isCustomService}
                onCheckedChange={(checked) => {
                  setIsCustomService(checked === true);
                  if (checked === true) {
                    setServiceId("");
                  } else {
                    setCustomServiceName("");
                    setCustomPriceCents(0);
                  }
                }}
              />
              <Label htmlFor="customService" className="cursor-pointer">
                Use custom service (not from your service list)
              </Label>
            </div>

            {isCustomService ? (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <div className="space-y-2">
                  <Label htmlFor="customServiceName">
                    Service Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="customServiceName"
                    placeholder="e.g., Extended Consultation"
                    value={customServiceName}
                    onChange={(e) => setCustomServiceName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customPrice">
                    Price per Session ({currency}){" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="customPrice"
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                    value={customPriceCents > 0 ? customPriceCents / 100 : ""}
                    onChange={(e) =>
                      setCustomPriceCents(
                        Math.round(Number(e.target.value) * 100)
                      )
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>
                  Select Service <span className="text-destructive">*</span>
                </Label>
                {services.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active services found. Please add services in your
                    dashboard first, or use a custom service above.
                  </p>
                ) : (
                  <Select value={serviceId} onValueChange={handleServiceChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a service..." />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((svc) => (
                        <SelectItem key={svc.id} value={svc.id}>
                          {svc.name} -{" "}
                          {formatCurrency(svc.price_cents, currency)} (
                          {svc.duration_minutes} min)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 4: Pricing ────────────────────────────────────────────────

  function renderStep4() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Pricing & Payment</h2>
          <p className="text-sm text-muted-foreground">
            Review pricing and choose a payment method.
          </p>
        </div>

        {/* Pricing breakdown */}
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Price per session</span>
              <span className="font-medium">
                {formatCurrency(pricing.unitPriceCents, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Sessions ({totalSessions})
              </span>
              <span className="font-medium">
                {formatCurrency(pricing.subtotal, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Platform fee per session
              </span>
              <span className="font-medium">
                {formatCurrency(pricing.platformFeePerSession, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Total platform fee ({totalSessions} sessions)
              </span>
              <span className="font-medium">
                {formatCurrency(pricing.totalPlatformFee, currency)}
              </span>
            </div>

            {pricing.discountCents > 0 && (
              <div className="flex items-center justify-between text-sm text-green-600">
                <span>
                  Discount
                  {discountType === "percentage"
                    ? ` (${discountValue}%)`
                    : ""}
                </span>
                <span className="font-medium">
                  -{formatCurrency(pricing.discountCents, currency)}
                </span>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <span className="font-semibold">Grand Total</span>
              <span className="text-lg font-bold">
                {formatCurrency(pricing.grandTotal, currency)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Patient pays:{" "}
              {formatCurrency(
                pricing.discountedTotal + pricing.totalPlatformFee,
                currency
              )}
            </p>
          </CardContent>
        </Card>

        {/* Discount */}
        <div className="space-y-3">
          <Label>Discount (optional)</Label>
          <div className="flex gap-3">
            <Select
              value={discountType}
              onValueChange={(val) => {
                setDiscountType(
                  val === "none"
                    ? ""
                    : (val as "" | "percentage" | "fixed_amount")
                );
                setDiscountValue(0);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="No discount" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No discount</SelectItem>
                <SelectItem value="percentage">Percentage (%)</SelectItem>
                <SelectItem value="fixed_amount">
                  Fixed Amount ({currency})
                </SelectItem>
              </SelectContent>
            </Select>
            {discountType !== "" && (
              <Input
                type="number"
                min={0}
                max={discountType === "percentage" ? 100 : undefined}
                step={discountType === "percentage" ? 1 : 0.01}
                placeholder={discountType === "percentage" ? "0" : "0.00"}
                value={
                  discountValue > 0
                    ? discountType === "fixed_amount"
                      ? discountValue / 100
                      : discountValue
                    : ""
                }
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (discountType === "fixed_amount") {
                    setDiscountValue(Math.round(val * 100));
                  } else {
                    setDiscountValue(val);
                  }
                }}
                className="w-32"
              />
            )}
          </div>
        </div>

        {/* Payment type */}
        <div className="space-y-3">
          <Label>Payment Type</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPaymentType("pay_full")}
              className={`rounded-lg border p-4 text-left transition-colors ${
                paymentType === "pay_full"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-accent"
              }`}
            >
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <span className="font-semibold">Pay in Full</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Patient pays for all sessions upfront in a single payment.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setPaymentType("pay_per_visit")}
              className={`rounded-lg border p-4 text-left transition-colors ${
                paymentType === "pay_per_visit"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-accent"
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="font-semibold">Pay Per Visit</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Patient pays for each session individually when booking.
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 5: Review & Send ──────────────────────────────────────────

  function renderStep5() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Review & Send</h2>
          <p className="text-sm text-muted-foreground">
            Review all details before sending the treatment plan to your
            patient.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-5 p-5">
            {/* Patient */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Patient
              </p>
              {selectedPatient && (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {selectedPatient.avatar_url ? (
                      <AvatarImage
                        src={selectedPatient.avatar_url}
                        alt={`${selectedPatient.first_name} ${selectedPatient.last_name}`}
                      />
                    ) : null}
                    <AvatarFallback>
                      {selectedPatient.first_name.charAt(0)}
                      {selectedPatient.last_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedPatient.email}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Plan details */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Treatment Plan
              </p>
              <div className="space-y-1">
                <p className="font-medium">{title}</p>
                {description && (
                  <p className="text-sm text-muted-foreground">{description}</p>
                )}
                {customNotes && (
                  <p className="text-sm italic text-muted-foreground">
                    Note: {customNotes}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Sessions */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Sessions
              </p>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between sm:flex-col sm:gap-0.5">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium">{serviceName}</span>
                </div>
                <div className="flex justify-between sm:flex-col sm:gap-0.5">
                  <span className="text-muted-foreground">
                    Total Sessions
                  </span>
                  <span className="font-medium">{totalSessions}</span>
                </div>
                <div className="flex justify-between sm:flex-col sm:gap-0.5">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{durationMinutes} minutes</span>
                </div>
                <div className="flex justify-between sm:flex-col sm:gap-0.5">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">
                    {consultationType === "in_person"
                      ? "In-Person"
                      : "Video"}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Pricing */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Pricing
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Per session</span>
                  <span>{formatCurrency(pricing.unitPriceCents, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Subtotal ({totalSessions} sessions)
                  </span>
                  <span>{formatCurrency(pricing.subtotal, currency)}</span>
                </div>
                {pricing.discountCents > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>
                      -{formatCurrency(pricing.discountCents, currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform fee</span>
                  <span>
                    {formatCurrency(pricing.totalPlatformFee, currency)}
                  </span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(pricing.grandTotal, currency)}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Payment type */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Payment Method
              </p>
              <Badge
                variant="secondary"
                className={
                  paymentType === "pay_full"
                    ? "bg-purple-50 text-purple-700"
                    : "bg-sky-50 text-sky-700"
                }
              >
                {paymentType === "pay_full" ? "Pay in Full" : "Pay Per Visit"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {!hasStripe && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium">Payment setup required</p>
            <p className="mt-1">
              You need to complete your Stripe payment setup before you can send
              treatment plans. Go to your dashboard settings to complete the
              setup.
            </p>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={isPending || !hasStripe}
          className="w-full"
          size="lg"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Send Treatment Plan
            </>
          )}
        </Button>
      </div>
    );
  }

  // ─── Layout ─────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Treatment Plan</h1>
        <p className="text-muted-foreground">
          Create a structured treatment plan and send it to your patient.
        </p>
      </div>

      <StepIndicator currentStep={step} />

      <Card>
        <CardContent className="p-6">{renderStep()}</CardContent>
      </Card>

      {/* Navigation buttons */}
      {step < 5 && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 1}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleNext}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {step === 5 && (
        <div className="flex justify-start">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
