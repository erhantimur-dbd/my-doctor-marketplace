"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { SlotPicker } from "@/components/booking/slot-picker";
import { createBookingAndCheckout } from "@/actions/booking";
import { formatCurrency, calculateDepositCents } from "@/lib/utils/currency";
import { formatSpecialtyName } from "@/lib/utils";
import { formatSlotTime } from "@/lib/utils/availability";
import { localeToBcp47 } from "@/lib/voice/locale";
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
  /** Unauthenticated progressive checkout */
  isGuest?: boolean;
  locale?: string;
}

type ConsultationType = "in_person" | "video";

interface SlotSelection {
  date: string;
  startTime: string;
  endTime: string;
}

const FOLLOWUP_SERVICE_ID = "__followup__";
const NEW_PATIENT_SERVICE_ID = "__new_patient__";

export function BookingWizard({
  doctor,
  services = [],
  dependents = [],
  isGuest = false,
}: BookingWizardProps) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const initialDate = searchParams.get("date"); // e.g. "2026-03-05" from availability chip
  const initialType = searchParams.get("type") as ConsultationType | null; // e.g. "in_person" or "video"
  const initialTime = searchParams.get("time"); // e.g. "07:00:00" from selected time slot
  const initialServiceId = searchParams.get("service"); // optional service_id deep-link

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

  // Reason-for-visit (service) — prefilled when type is deep-linked so one-tap
  // book from card/chat can proceed without an extra answer.
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(
    null
  );
  const hasAutoAdvancedFromUrl = useRef(false);

  // Patient selection state (for dependent booking)
  const [selectedPatient, setSelectedPatient] = useState<"self" | string>("self");
  const selectedDependent = selectedPatient !== "self"
    ? dependents.find((d) => d.id === selectedPatient) ?? null
    : null;

  // Guest contact (progressive checkout)
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestTerms, setGuestTerms] = useState(false);

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

  const defaultFeeCents =
    consultationType === "video" && doctor.video_consultation_fee_cents
      ? doctor.video_consultation_fee_cents
      : doctor.consultation_fee_cents;

  // Reason-for-visit options: always include new patient + follow-up defaults
  // plus any doctor-configured services (never an empty silent catalog).
  const newPatientReason: ServiceOption = {
    id: NEW_PATIENT_SERVICE_ID,
    name: t("reason_new_patient"),
    price_cents: defaultFeeCents,
    duration_minutes: 30,
    consultation_type: consultationType || "in_person",
  };
  const followUpService: ServiceOption = {
    id: FOLLOWUP_SERVICE_ID,
    name: t("reason_follow_up"),
    price_cents: defaultFeeCents,
    duration_minutes: 30,
    consultation_type: consultationType || "in_person",
  };

  const reasonOptions: ServiceOption[] = [
    newPatientReason,
    ...filteredServices,
    followUpService,
  ];

  // Prefill reason: URL ?service=, else default new-patient when type is set
  // (one-tap deep links must not block on missing reason).
  useEffect(() => {
    if (!consultationType) return;
    if (selectedService) return;

    if (initialServiceId) {
      const match = services.find(
        (s) =>
          s.id === initialServiceId &&
          (s.consultation_type === consultationType ||
            s.consultation_type === "both")
      );
      if (match) {
        setSelectedService(match);
        return;
      }
    }

    // Default reason so type step / one-tap review can proceed
    setSelectedService({
      id: NEW_PATIENT_SERVICE_ID,
      name: t("reason_new_patient"),
      price_cents: defaultFeeCents,
      duration_minutes: 30,
      consultation_type: consultationType,
    });
  }, [
    consultationType,
    initialServiceId,
    services,
    selectedService,
    defaultFeeCents,
    t,
  ]);

  // Fee calculations — service-aware
  const consultationFeeCents = selectedService
    ? selectedService.price_cents
    : defaultFeeCents;

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
  const depositLabel =
    resolvedDepositType === "percentage" && resolvedDepositValue
      ? t("deposit_percentage", { value: resolvedDepositValue })
      : t("deposit_label");

  // Slot duration override when service is selected
  const slotDurationOverride = selectedService
    ? selectedService.duration_minutes
    : undefined;

  function canProceed(): boolean {
    if (currentStep === "patient") return true; // default is "self", always valid
    if (currentStep === "type") {
      // Need type + a reason-for-visit (always selectedService after Phase 5)
      if (!consultationType) return false;
      if (!selectedService) return false;
      return true;
    }
    if (currentStep === "schedule") return slotSelection !== null;
    if (currentStep === "review") {
      if (!isGuest) return true;
      return (
        guestFirstName.trim().length > 0 &&
        guestLastName.trim().length > 0 &&
        guestEmail.includes("@") &&
        guestTerms
      );
    }
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
    // Reset reason when consultation type changes (fees/durations differ)
    setSelectedService(null);
    setSlotSelection(null);
  }

  function handleReasonSelect(reasonId: string) {
    const reason = reasonOptions.find((s) => s.id === reasonId) || null;
    setSelectedService(reason);
    setSlotSelection(null); // duration may change
  }

  /** Real doctor_services row id (not synthetic new-patient / follow-up). */
  const realServiceId =
    selectedService?.id &&
    selectedService.id !== FOLLOWUP_SERVICE_ID &&
    selectedService.id !== NEW_PATIENT_SERVICE_ID
      ? selectedService.id
      : undefined;

  function bookPathWithContext(opts?: {
    date?: string;
    time?: string;
    type?: ConsultationType | null;
  }): string {
    const params = new URLSearchParams();
    const type = opts?.type ?? consultationType;
    if (type) params.set("type", type);
    if (opts?.date) params.set("date", opts.date);
    if (opts?.time) params.set("time", opts.time);
    if (realServiceId) params.set("service", realServiceId);
    const qs = params.toString();
    return `/doctors/${doctor.slug}/book${qs ? `?${qs}` : ""}`;
  }

  const handleSlotSelect = useCallback((date: string, startTime: string, endTime: string) => {
    setSlotSelection({ date, startTime, endTime });
  }, []);

  // One-tap conversion: when URL prefilled type+date+time and slot resolves,
  // skip Schedule and land on Review (once).
  useEffect(() => {
    if (hasAutoAdvancedFromUrl.current) return;
    if (!validInitialType || !initialDate || !initialTime) return;
    if (!slotSelection) return;
    if (currentStep !== "schedule") return;

    const reviewIdx = hasDependents ? 3 : 2; // patient? type schedule review payment
    hasAutoAdvancedFromUrl.current = true;
    setStepIndex(reviewIdx);
  }, [
    slotSelection,
    currentStep,
    validInitialType,
    initialDate,
    initialTime,
    hasDependents,
  ]);

  function handleProceedToPayment() {
    if (!consultationType || !slotSelection) return;
    if (isGuest && !canProceed() && currentStep === "payment") {
      // Ensure guest details filled on review before payment step
    }

    startTransition(async () => {
      const result = await createBookingAndCheckout({
        doctor_id: doctor.id,
        appointment_date: slotSelection.date,
        start_time: slotSelection.startTime,
        end_time: slotSelection.endTime,
        consultation_type: consultationType,
        patient_notes: patientNotes || undefined,
        service_id: realServiceId,
        duration_minutes: selectedService?.duration_minutes || undefined,
        dependent_id: selectedDependent?.id || undefined,
        dependent_name: selectedDependent
          ? `${selectedDependent.first_name} ${selectedDependent.last_name}`
          : undefined,
        guest: isGuest
          ? {
              first_name: guestFirstName.trim(),
              last_name: guestLastName.trim(),
              email: guestEmail.trim(),
              phone: guestPhone.trim(),
              terms_accepted: guestTerms,
            }
          : undefined,
      });

      if (result.error) {
        toast.error(result.error);
        if ("requiresLogin" in result && result.requiresLogin) {
          const q = new URLSearchParams();
          q.set(
            "redirect",
            `/${locale}${bookPathWithContext({
              date: slotSelection.date,
              time: slotSelection.startTime,
              type: consultationType,
            })}`
          );
          window.location.href = `/${locale}/login?${q.toString()}`;
        }
        return;
      }

      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error(t("checkout_failed"));
      }
    });
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString(localeToBcp47(locale), {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const stepMeta: { id: StepId; label: string; icon: typeof User }[] = [
    ...(hasDependents
      ? [{ id: "patient" as StepId, label: t("step_patient"), icon: Users }]
      : []),
    { id: "type" as StepId, label: t("step_type"), icon: Stethoscope },
    { id: "schedule" as StepId, label: t("step_schedule"), icon: Calendar },
    { id: "review" as StepId, label: t("step_review"), icon: User },
    { id: "payment" as StepId, label: t("step_payment"), icon: CreditCard },
  ];

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

          {stepMeta.map(({ id, label, icon: Icon }, idx) => (
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
              {t("who_for")}
            </CardTitle>
            <CardDescription>
              {t("who_for_desc")}
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
                  <span className="font-medium">{t("myself")}</span>
                  <p className="text-sm text-muted-foreground">
                    {t("myself_desc")}
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
                        {t("born", {
                          date: new Date(dep.date_of_birth + "T00:00:00").toLocaleDateString(
                            localeToBcp47(locale),
                            { day: "numeric", month: "long", year: "numeric" }
                          ),
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
              {t("next")}
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
              {t("choose_type")}
            </CardTitle>
            <CardDescription>
              {t("choose_type_desc", { name: fullName })}
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
                      <span className="font-medium">{t("in_person")}</span>
                      {doctor.in_person_deposit_type && doctor.in_person_deposit_type !== "none" && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          {t("deposit_required_badge")}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("in_person_desc")}
                    </p>
                    {doctor.clinic_name && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {doctor.clinic_name}
                        {doctor.location && ` — ${doctor.location.city}`}
                      </p>
                    )}
                    <p className="mt-1 text-xs italic text-muted-foreground">
                      {t("address_after_booking")}
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
                      <span className="font-medium">{t("video")}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("video_desc")}
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

            {/* Reason for visit — always required (defaults when doctor has no services) */}
            {consultationType && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div>
                    <Label className="text-base font-medium">
                      {t("reason_for_visit")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t("reason_for_visit_desc")}
                    </p>
                  </div>
                  <RadioGroup
                    value={selectedService?.id || ""}
                    onValueChange={handleReasonSelect}
                    className="grid gap-3"
                  >
                    {reasonOptions.map((reason) => (
                      <Label
                        key={reason.id}
                        htmlFor={`reason-${reason.id}`}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-accent ${
                          selectedService?.id === reason.id
                            ? "border-primary bg-primary/5"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <RadioGroupItem
                            value={reason.id}
                            id={`reason-${reason.id}`}
                          />
                          <div className="min-w-0">
                            <span className="font-medium text-sm">
                              {reason.name}
                            </span>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {t("service_duration_label", {
                                minutes: reason.duration_minutes,
                              })}
                            </p>
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">
                          {formatCurrency(
                            reason.price_cents,
                            doctor.base_currency
                          )}
                        </p>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={handleNext} disabled={!canProceed()}>
              {t("next")}
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
              {t("pick_date_time")}
            </CardTitle>
            <CardDescription>
              {t("pick_date_time_desc")}
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
                <p className="text-sm font-medium">{t("selected_appointment")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("datetime_at", {
                    date: formatDate(slotSelection.date),
                    time: `${formatSlotTime(slotSelection.startTime, locale)} - ${formatSlotTime(slotSelection.endTime, locale)}`,
                  })}
                </p>
              </div>
            )}

          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("back")}
            </Button>
            <Button onClick={handleNext} disabled={!canProceed()}>
              {t("next")}
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
              {t("review_title")}
            </CardTitle>
            <CardDescription>
              {t("review_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Guest contact — progressive checkout */}
            {isGuest && (
              <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div>
                  <h3 className="font-semibold">{t("guest_details_title")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("guest_details_desc")}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="guest-first">{t("guest_first_name")}</Label>
                    <Input
                      id="guest-first"
                      value={guestFirstName}
                      onChange={(e) => setGuestFirstName(e.target.value)}
                      autoComplete="given-name"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="guest-last">{t("guest_last_name")}</Label>
                    <Input
                      id="guest-last"
                      value={guestLastName}
                      onChange={(e) => setGuestLastName(e.target.value)}
                      autoComplete="family-name"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guest-email">{t("guest_email")}</Label>
                  <Input
                    id="guest-email"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guest-phone">{t("guest_phone")}</Label>
                  <Input
                    id="guest-phone"
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="guest-terms"
                    checked={guestTerms}
                    onCheckedChange={(v) => setGuestTerms(v === true)}
                  />
                  <Label htmlFor="guest-terms" className="text-sm font-normal leading-snug">
                    {t("guest_terms")}
                  </Label>
                </div>
                <p className="text-sm">
                  <Link
                    href={`/login?redirect=${encodeURIComponent(
                      `/${locale}${bookPathWithContext({
                        date: slotSelection.date,
                        time: slotSelection.startTime,
                        type: consultationType,
                      })}`
                    )}`}
                    className="text-primary hover:underline"
                  >
                    {t("sign_in_instead")}
                  </Link>
                </p>
              </div>
            )}

            {/* Patient Notes */}
            <div className="space-y-2">
              <Label htmlFor="patient-notes">
                {t("patient_notes")}
              </Label>
              <Textarea
                id="patient-notes"
                placeholder={t("patient_notes_placeholder")}
                value={patientNotes}
                onChange={(e) => setPatientNotes(e.target.value)}
                maxLength={1000}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {t("characters_count", { current: patientNotes.length, max: 1000 })}
              </p>
            </div>

            <Separator />

            {/* Booking Summary */}
            <div className="space-y-4">
              <h3 className="font-semibold">{t("booking_summary")}</h3>

              <div className="space-y-3 rounded-md border p-4">
                {/* Doctor Info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Stethoscope className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t("doctor")}</span>
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
                        <span className="text-muted-foreground">{t("patient")}</span>
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
                    <span className="text-muted-foreground">{t("type")}</span>
                  </div>
                  <Badge variant="secondary">
                    {consultationType === "video"
                      ? t("video")
                      : t("in_person")}
                  </Badge>
                </div>

                {/* Reason for visit */}
                {selectedService && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Stethoscope className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {t("reason_for_visit")}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{selectedService.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("service_duration_label", {
                            minutes: selectedService.duration_minutes,
                          })}
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
                    <span className="text-muted-foreground">{t("date")}</span>
                  </div>
                  <p className="text-sm font-medium">
                    {formatDate(slotSelection.date)}
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t("time")}</span>
                  </div>
                  <p className="text-sm font-medium">
                    {formatSlotTime(slotSelection.startTime, locale)} -{" "}
                    {formatSlotTime(slotSelection.endTime, locale)}
                  </p>
                </div>

                <Separator />

                {/* Price Breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {selectedService ? selectedService.name : t("consultation_fee")}
                    </span>
                    <span>
                      {formatCurrency(
                        consultationFeeCents,
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
                    <span>{isDepositMode ? t("charge_now") : t("total")}</span>
                    <span className="text-lg">
                      {formatCurrency(chargeNowCents, doctor.base_currency)}
                    </span>
                  </div>
                  {isDepositMode && remainderDueCents != null && (
                    <div className="flex items-center justify-between text-sm text-amber-700 dark:text-amber-400">
                      <span>{t("due_on_day")}</span>
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
                    {t("deposit_secures_info", {
                      deposit: depositLabel,
                      remainder: formatCurrency(remainderDueCents, doctor.base_currency),
                    })}
                  </p>
                </div>
              )}

              {/* Cancellation Policy */}
              <p className="text-xs text-muted-foreground">
                {doctor.cancellation_policy === "flexible"
                  ? t("cancel_policy_flexible_detail")
                  : doctor.cancellation_policy === "moderate"
                    ? t("cancel_policy_moderate_detail")
                    : t("cancel_policy_strict_detail")}
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("back")}
            </Button>
            <Button onClick={handleNext} disabled={!canProceed()}>
              {t("continue_to_payment")}
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
              {t("payment_title")}
            </CardTitle>
            <CardDescription>
              {t("payment_redirect")}
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
                      {t("datetime_at", {
                        date: formatDate(slotSelection.date),
                        time: formatSlotTime(slotSelection.startTime, locale),
                      })}
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
                    {t("payment_deposit_paying", {
                      deposit: depositLabel,
                      remainder: formatCurrency(remainderDueCents, doctor.base_currency),
                    })}
                  </p>
                </div>
              )}

              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {t("payment_confirm_note")}
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={handleBack} disabled={isPending}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("back")}
            </Button>
            <Button
              size="lg"
              onClick={handleProceedToPayment}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("processing")}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {t("proceed_to_payment")}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
