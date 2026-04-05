"use client";

import { useState, useTransition, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlotPicker } from "@/components/booking/slot-picker";
import { RecurringOption, type RecurringConfig } from "@/components/booking/recurring-option";
import { createBookingAndCheckout } from "@/actions/booking";
import { formatCurrency, calculateDepositCents } from "@/lib/utils/currency";
import { formatSpecialtyName } from "@/lib/utils";
import { formatSlotTime } from "@/lib/utils/availability";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  Stethoscope,
  User,
  Users,
  Video,
} from "lucide-react";

interface ServiceOption {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
  consultation_type: string;
  deposit_type?: string | null;
  deposit_value?: number | null;
}

interface Dependent {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  relationship: string;
}

interface BookingWizardProps {
  doctor: {
    id: string;
    slug: string;
    title: string | null;
    consultation_fee_cents: number;
    video_consultation_fee_cents: number | null;
    base_currency: string;
    consultation_types: string[];
    cancellation_policy: string;
    clinic_name: string | null;
    address: string | null;
    in_person_deposit_type?: string;
    in_person_deposit_value?: number | null;
    profile: {
      first_name: string;
      last_name: string;
      avatar_url: string | null;
    };
    location: {
      city: string;
      country_code: string;
      timezone: string;
    } | null;
    specialties: {
      specialty: {
        id: string;
        name_key: string;
        slug: string;
      };
      is_primary: boolean;
    }[];
  };
  services?: ServiceOption[];
  dependents?: Dependent[];
}

type ConsultationType = "in_person" | "video";

interface SlotSelection {
  date: string;
  startTime: string;
  endTime: string;
}

const FOLLOWUP_SERVICE_ID = "__followup__";

export function BookingWizard({ doctor, services = [], dependents = [] }: BookingWizardProps) {
  const searchParams = useSearchParams();
  const initialDate = searchParams.get("date"); // e.g. "2026-03-05" from availability chip
  const initialType = searchParams.get("type") as ConsultationType | null; // e.g. "in_person" or "video"
  const initialTime = searchParams.get("time"); // e.g. "07:00:00" from selected time slot

  // Auto-select consultation type and skip to step 2 if valid type provided via URL
  const validInitialType =
    initialType &&
    (initialType === "in_person" || initialType === "video") &&
    doctor.consultation_types?.includes(initialType)
      ? initialType
      : null;

  const hasDependents = dependents.length > 0;

  type StepId = "patient" | "type" | "schedule" | "review" | "payment";
  const steps: StepId[] = hasDependents
    ? ["patient", "type", "schedule", "review", "payment"]
    : ["type", "schedule", "review", "payment"];

  const [stepIndex, setStepIndex] = useState(
    validInitialType && !hasDependents ? 1 : 0
  );
  const currentStep = steps[stepIndex];
  const [consultationType, setConsultationType] =
    useState<ConsultationType | null>(validInitialType);
  const [slotSelection, setSlotSelection] = useState<SlotSelection | null>(
    null
  );
  const [patientNotes, setPatientNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  // Service selection state
  const [isFirstVisit, setIsFirstVisit] = useState<boolean | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(
    null
  );

  // Recurring appointment state
  const [recurringConfig, setRecurringConfig] = useState<RecurringConfig | null>(null);

  // Patient selection state (for dependent booking)
  const [selectedPatient, setSelectedPatient] = useState<"self" | string>("self");
  const selectedDependent = selectedPatient !== "self"
    ? dependents.find((d) => d.id === selectedPatient) ?? null
    : null;

  const totalSteps = steps.length;
  const fullName = `${doctor.title || "Dr."} ${doctor.profile.first_name} ${doctor.profile.last_name}`.trim();

  const primarySpecialty =
    doctor.specialties?.find((s) => s.is_primary)?.specialty ||
    doctor.specialties?.[0]?.specialty;

  const specialtyName = primarySpecialty
    ? formatSpecialtyName(primarySpecialty.name_key)
    : null;

  // Filter services by selected consultation type
  const filteredServices = consultationType
    ? services.filter(
        (s) =>
          s.consultation_type === consultationType ||
          s.consultation_type === "both"
      )
    : [];

  // Built-in follow-up option using doctor's default fee
  const followUpService: ServiceOption = {
    id: FOLLOWUP_SERVICE_ID,
    name: "Follow-up Appointment",
    price_cents:
      consultationType === "video" && doctor.video_consultation_fee_cents
        ? doctor.video_consultation_fee_cents
        : doctor.consultation_fee_cents,
    duration_minutes: 30,
    consultation_type: consultationType || "in_person",
  };

  const allServiceOptions = [...filteredServices, followUpService];

  // Fee calculations — service-aware
  const consultationFeeCents = selectedService
    ? selectedService.price_cents
    : consultationType === "video" && doctor.video_consultation_fee_cents
      ? doctor.video_consultation_fee_cents
      : doctor.consultation_fee_cents;

  const totalAmountCents = consultationFeeCents;

  // Resolve deposit config: service override → doctor default → none
  // Only for in-person appointments
  let resolvedDepositType: string | null = null;
  let resolvedDepositValue: number | null = null;

  if (consultationType === "in_person") {
    if (selectedService?.deposit_type) {
      // Service has its own deposit override
      resolvedDepositType = selectedService.deposit_type;
      resolvedDepositValue = selectedService.deposit_value ?? null;
    } else if (!selectedService && doctor.in_person_deposit_type && doctor.in_person_deposit_type !== "none") {
      // First-visit: use doctor default
      resolvedDepositType = doctor.in_person_deposit_type;
      resolvedDepositValue = doctor.in_person_deposit_value ?? null;
    } else if (selectedService && !selectedService.deposit_type) {
      // Service inherits from doctor default
      resolvedDepositType = doctor.in_person_deposit_type ?? null;
      resolvedDepositValue = doctor.in_person_deposit_value ?? null;
    }
  }

  const depositAmountCents = calculateDepositCents(
    consultationFeeCents,
    resolvedDepositType,
    resolvedDepositValue
  );
  const isDepositMode = depositAmountCents != null && depositAmountCents > 0;
  const remainderDueCents = isDepositMode
    ? consultationFeeCents - depositAmountCents
    : null;
  const chargeNowCents = isDepositMode
    ? depositAmountCents
    : totalAmountCents;

  // Deposit label for display
  const depositLabel = resolvedDepositType === "percentage" && resolvedDepositValue
    ? `${resolvedDepositValue}% Deposit`
    : "Deposit";

  // Slot duration override when service is selected
  const slotDurationOverride = selectedService
    ? selectedService.duration_minutes
    : undefined;

  function canProceed(): boolean {
    if (currentStep === "patient") return true; // default is "self", always valid
    if (currentStep === "type") {
      if (!consultationType) return false;
      if (isFirstVisit === null) return false;
      if (isFirstVisit === false && !selectedService) return false;
      return true;
    }
    if (currentStep === "schedule") return slotSelection !== null;
    if (currentStep === "review") return true;
    return false;
  }

  function handleNext() {
    if (stepIndex < totalSteps - 1 && canProceed()) {
      setStepIndex(stepIndex + 1);
    }
  }

  function handleBack() {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  }

  function handleConsultationTypeChange(val: string) {
    setConsultationType(val as ConsultationType);
    // Reset service selection when consultation type changes
    setIsFirstVisit(null);
    setSelectedService(null);
    setSlotSelection(null);
  }

  function handleFirstVisitChange(val: string) {
    const isFirst = val === "yes";
    setIsFirstVisit(isFirst);
    setSelectedService(null);
    setSlotSelection(null);
  }

  function handleServiceSelect(serviceId: string) {
    const svc = allServiceOptions.find((s) => s.id === serviceId) || null;
    setSelectedService(svc);
    setSlotSelection(null); // Reset slot since duration may change
  }

  const handleSlotSelect = useCallback((date: string, startTime: string, endTime: string) => {
    setSlotSelection({ date, startTime, endTime });
  }, []);

  function handleProceedToPayment() {
    if (!consultationType || !slotSelection) return;

    startTransition(async () => {
      const result = await createBookingAndCheckout({
        doctor_id: doctor.id,
        appointment_date: slotSelection.date,
        start_time: slotSelection.startTime,
        end_time: slotSelection.endTime,
        consultation_type: consultationType,
        patient_notes: patientNotes || undefined,
        service_id: selectedService?.id && selectedService.id !== FOLLOWUP_SERVICE_ID
          ? selectedService.id
          : undefined,
        duration_minutes: selectedService?.duration_minutes || undefined,
        dependent_id: selectedDependent?.id || undefined,
        dependent_name: selectedDependent
          ? `${selectedDependent.first_name} ${selectedDependent.last_name}`
          : undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error("Failed to create checkout session. Please try again.");
      }
    });
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="relative flex items-start justify-between">
          {/* Background connector line */}
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-muted" />
          {/* Active progress line */}
          <div
            className="absolute left-0 top-4 h-0.5 bg-primary transition-all duration-300"
            style={{ width: `${(stepIndex / (totalSteps - 1)) * 100}%` }}
          />

          {[
            ...(hasDependents ? [{ id: "patient" as StepId, label: "Patient", icon: Users }] : []),
            { id: "type" as StepId, label: "Type", icon: Stethoscope },
            { id: "schedule" as StepId, label: "Schedule", icon: Calendar },
            { id: "review" as StepId, label: "Review", icon: User },
            { id: "payment" as StepId, label: "Payment", icon: CreditCard },
          ].map(({ id, label, icon: Icon }, idx) => (
            <div key={id} className="relative flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ring-4 ring-background transition-colors ${
                  stepIndex >= idx
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span
                className={`mt-1.5 text-xs ${
                  stepIndex >= idx
                    ? "font-medium text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step: Who is this appointment for? (only if user has dependents) */}
      {currentStep === "patient" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Who is this appointment for?
            </CardTitle>
            <CardDescription>
              Select who will be attending this appointment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedPatient}
              onValueChange={setSelectedPatient}
              className="space-y-3"
            >
              {/* Self option */}
              <Label
                htmlFor="patient-self"
                className={`flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent ${
                  selectedPatient === "self" ? "border-primary bg-primary/5" : ""
                }`}
              >
                <RadioGroupItem value="self" id="patient-self" />
                <div className="flex-1">
                  <span className="font-medium">Myself</span>
                  <p className="text-sm text-muted-foreground">
                    Book this appointment for yourself
                  </p>
                </div>
              </Label>

              {/* Dependent options */}
              {dependents.map((dep) => (
                <Label
                  key={dep.id}
                  htmlFor={`patient-${dep.id}`}
                  className={`flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent ${
                    selectedPatient === dep.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <RadioGroupItem value={dep.id} id={`patient-${dep.id}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {dep.first_name} {dep.last_name}
                      </span>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {dep.relationship}
                      </Badge>
                    </div>
                    {dep.date_of_birth && (
                      <p className="text-sm text-muted-foreground">
                        Born {new Date(dep.date_of_birth).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step: Consultation Type + Service Selection */}
      {currentStep === "type" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Choose Consultation Type
            </CardTitle>
            <CardDescription>
              Select how you would like to consult with {fullName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup
              value={consultationType || ""}
              onValueChange={handleConsultationTypeChange}
              className="grid gap-4 md:grid-cols-2"
            >
              {doctor.consultation_types?.includes("in_person") && (
                <Label
                  htmlFor="type-in_person"
                  className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-accent ${
                    consultationType === "in_person"
                      ? "border-primary bg-primary/5"
                      : ""
                  }`}
                >
                  <RadioGroupItem value="in_person" id="type-in_person" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="font-medium">In-Person Visit</span>
                      {doctor.in_person_deposit_type && doctor.in_person_deposit_type !== "none" && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          Deposit Required
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Visit the doctor at their clinic
                    </p>
                    {doctor.clinic_name && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {doctor.clinic_name}
                        {doctor.location && ` — ${doctor.location.city}`}
                      </p>
                    )}
                    <p className="mt-1 text-xs italic text-muted-foreground">
                      Full address provided after booking
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {formatCurrency(
                        doctor.consultation_fee_cents,
                        doctor.base_currency
                      )}
                    </p>
                  </div>
                </Label>
              )}

              {doctor.consultation_types?.includes("video") && (
                <Label
                  htmlFor="type-video"
                  className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-accent ${
                    consultationType === "video"
                      ? "border-primary bg-primary/5"
                      : ""
                  }`}
                >
                  <RadioGroupItem value="video" id="type-video" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-primary" />
                      <span className="font-medium">Video Consultation</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Consult via a secure video call
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {formatCurrency(
                        doctor.video_consultation_fee_cents ||
                          doctor.consultation_fee_cents,
                        doctor.base_currency
                      )}
                    </p>
                  </div>
                </Label>
              )}
            </RadioGroup>

            {/* First-visit question */}
            {consultationType && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-base font-medium">
                    Is this your first visit with this doctor?
                  </Label>
                  <RadioGroup
                    value={
                      isFirstVisit === null
                        ? ""
                        : isFirstVisit
                          ? "yes"
                          : "no"
                    }
                    onValueChange={handleFirstVisitChange}
                    className="grid gap-3 md:grid-cols-2"
                  >
                    <Label
                      htmlFor="first-visit-yes"
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent ${
                        isFirstVisit === true
                          ? "border-primary bg-primary/5"
                          : ""
                      }`}
                    >
                      <RadioGroupItem value="yes" id="first-visit-yes" />
                      <div>
                        <span className="font-medium text-sm">Yes, first visit</span>
                        <p className="text-xs text-muted-foreground">
                          Standard consultation at the default fee
                        </p>
                      </div>
                    </Label>
                    <Label
                      htmlFor="first-visit-no"
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent ${
                        isFirstVisit === false
                          ? "border-primary bg-primary/5"
                          : ""
                      }`}
                    >
                      <RadioGroupItem value="no" id="first-visit-no" />
                      <div>
                        <span className="font-medium text-sm">No, I&apos;ve visited before</span>
                        <p className="text-xs text-muted-foreground">
                          Select a specific service below
                        </p>
                      </div>
                    </Label>
                  </RadioGroup>
                </div>

                {/* Service selection — for returning patients */}
                {isFirstVisit === false && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Select a service
                    </Label>
                    <Select
                      value={selectedService?.id || ""}
                      onValueChange={handleServiceSelect}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose the service you need..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allServiceOptions.map((svc) => (
                          <SelectItem key={svc.id} value={svc.id}>
                            <div className="flex items-center gap-2">
                              <span>{svc.name}</span>
                              <span className="text-muted-foreground">
                                — {formatCurrency(svc.price_cents, doctor.base_currency)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({svc.duration_minutes} min)
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedService && (
                      <div className="rounded-md bg-primary/5 p-3 mt-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{selectedService.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="mr-1 h-3 w-3" />
                                {selectedService.duration_minutes} min
                              </Badge>
                            </div>
                          </div>
                          <p className="text-lg font-semibold">
                            {formatCurrency(selectedService.price_cents, doctor.base_currency)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step: Date and Time */}
      {currentStep === "schedule" && consultationType && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Pick Date & Time
            </CardTitle>
            <CardDescription>
              Choose your preferred appointment date and time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SlotPicker
              doctorId={doctor.id}
              consultationType={consultationType}
              onSlotSelect={handleSlotSelect}
              initialDate={initialDate || undefined}
              initialTime={initialTime || undefined}
              slotDurationOverride={slotDurationOverride}
            />

            {slotSelection && (
              <div className="mt-4 rounded-md bg-primary/5 p-3">
                <p className="text-sm font-medium">Selected Appointment</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(slotSelection.date)} at{" "}
                  {formatSlotTime(slotSelection.startTime)} -{" "}
                  {formatSlotTime(slotSelection.endTime)}
                </p>
              </div>
            )}

            {/* Recurring option — shown after slot is selected */}
            {slotSelection && (
              <div className="mt-4">
                <RecurringOption
                  selectedDate={slotSelection.date}
                  onRecurringChange={setRecurringConfig}
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step: Notes & Review */}
      {currentStep === "review" && consultationType && slotSelection && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Review & Notes
            </CardTitle>
            <CardDescription>
              Add any notes for the doctor and review your booking details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Patient Notes */}
            <div className="space-y-2">
              <Label htmlFor="patient-notes">
                Notes for the Doctor (Optional)
              </Label>
              <Textarea
                id="patient-notes"
                placeholder="Describe your symptoms or reason for visit..."
                value={patientNotes}
                onChange={(e) => setPatientNotes(e.target.value)}
                maxLength={1000}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {patientNotes.length}/1000 characters
              </p>
            </div>

            <Separator />

            {/* Booking Summary */}
            <div className="space-y-4">
              <h3 className="font-semibold">Booking Summary</h3>

              <div className="space-y-3 rounded-md border p-4">
                {/* Doctor Info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Stethoscope className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Doctor</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{fullName}</p>
                    {specialtyName && (
                      <p className="text-xs text-muted-foreground">
                        {specialtyName}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Patient (if booking for dependent) */}
                {selectedDependent && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Patient</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {selectedDependent.first_name} {selectedDependent.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {selectedDependent.relationship}
                        </p>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Consultation Type */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    {consultationType === "video" ? (
                      <Video className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground">Type</span>
                  </div>
                  <Badge variant="secondary">
                    {consultationType === "video"
                      ? "Video Consultation"
                      : "In-Person Visit"}
                  </Badge>
                </div>

                {/* Selected Service */}
                {selectedService && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Stethoscope className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Service</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{selectedService.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedService.duration_minutes} min
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Date and Time */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Date</span>
                  </div>
                  <p className="text-sm font-medium">
                    {formatDate(slotSelection.date)}
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Time</span>
                  </div>
                  <p className="text-sm font-medium">
                    {formatSlotTime(slotSelection.startTime)} -{" "}
                    {formatSlotTime(slotSelection.endTime)}
                  </p>
                </div>

                {/* Recurring Info */}
                {recurringConfig && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Recurring</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {recurringConfig.numWeeks} sessions ({recurringConfig.pattern === "weekly" ? "Weekly" : "Bi-weekly"})
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Price Breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {selectedService ? selectedService.name : "Consultation Fee"}
                      {recurringConfig ? ` × ${recurringConfig.numWeeks}` : ""}
                    </span>
                    <span>
                      {formatCurrency(
                        consultationFeeCents * (recurringConfig?.numWeeks || 1),
                        doctor.base_currency
                      )}
                    </span>
                  </div>
                  {isDepositMode && depositAmountCents != null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {depositLabel}
                      </span>
                      <span>
                        {formatCurrency(depositAmountCents, doctor.base_currency)}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex items-center justify-between font-semibold">
                    <span>{isDepositMode ? "Charge Now" : "Total"}</span>
                    <span className="text-lg">
                      {formatCurrency(chargeNowCents, doctor.base_currency)}
                    </span>
                  </div>
                  {isDepositMode && remainderDueCents != null && (
                    <div className="flex items-center justify-between text-sm text-amber-700 dark:text-amber-400">
                      <span>Due on the Day</span>
                      <span className="font-medium">
                        {formatCurrency(remainderDueCents, doctor.base_currency)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Deposit Info Banner */}
              {isDepositMode && remainderDueCents != null && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/50">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    A {depositLabel.toLowerCase()} secures your appointment. The remaining{" "}
                    {formatCurrency(remainderDueCents, doctor.base_currency)} is payable
                    directly to the doctor on the day. Deposits are fully refundable if
                    cancelled within the cancellation period.
                  </p>
                </div>
              )}

              {/* Cancellation Policy */}
              <p className="text-xs text-muted-foreground">
                {doctor.cancellation_policy === "flexible"
                  ? "Flexible cancellation: Full refund if cancelled more than 24 hours before the appointment."
                  : doctor.cancellation_policy === "moderate"
                    ? "Moderate cancellation: Full refund if cancelled more than 48 hours before, 50% refund between 24-48 hours."
                    : "Strict cancellation: Full refund if cancelled more than 72 hours before the appointment."}
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleNext}>
              Continue to Payment
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step: Payment */}
      {currentStep === "payment" && consultationType && slotSelection && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment
            </CardTitle>
            <CardDescription>
              You will be redirected to our secure payment partner to complete
              your booking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Quick summary */}
              <div className="rounded-md bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{fullName}</p>
                    {selectedService && (
                      <p className="text-sm text-primary font-medium">
                        {selectedService.name}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {formatDate(slotSelection.date)} at{" "}
                      {formatSlotTime(slotSelection.startTime)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">
                      {formatCurrency(chargeNowCents, doctor.base_currency)}
                    </p>
                    {isDepositMode && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {depositLabel.toLowerCase()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {isDepositMode && remainderDueCents != null && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/50">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    You are paying a {depositLabel.toLowerCase()} to secure your appointment.
                    The remaining{" "}
                    <strong>{formatCurrency(remainderDueCents, doctor.base_currency)}</strong>{" "}
                    is payable directly to the doctor on the day.
                  </p>
                </div>
              )}

              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Your appointment will be confirmed once payment is completed.
                  You will receive a confirmation email with all the details.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={handleBack} disabled={isPending}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              size="lg"
              onClick={handleProceedToPayment}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Proceed to Payment
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
