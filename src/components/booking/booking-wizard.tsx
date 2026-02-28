"use client";

import { useState, useTransition } from "react";
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
import { SlotPicker } from "@/components/booking/slot-picker";
import { createBookingAndCheckout } from "@/actions/booking";
import { formatCurrency } from "@/lib/utils/currency";
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
  Video,
} from "lucide-react";

const PLATFORM_FEE_PERCENT = 15;

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
}

type ConsultationType = "in_person" | "video";

interface SlotSelection {
  date: string;
  startTime: string;
  endTime: string;
}

export function BookingWizard({ doctor }: BookingWizardProps) {
  const searchParams = useSearchParams();
  const initialDate = searchParams.get("date"); // e.g. "2026-03-05" from availability chip
  const initialType = searchParams.get("type") as ConsultationType | null; // e.g. "in_person" or "video"

  // Auto-select consultation type and skip to step 2 if valid type provided via URL
  const validInitialType =
    initialType &&
    (initialType === "in_person" || initialType === "video") &&
    doctor.consultation_types?.includes(initialType)
      ? initialType
      : null;

  const [step, setStep] = useState(validInitialType ? 2 : 1);
  const [consultationType, setConsultationType] =
    useState<ConsultationType | null>(validInitialType);
  const [slotSelection, setSlotSelection] = useState<SlotSelection | null>(
    null
  );
  const [patientNotes, setPatientNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const totalSteps = 4;
  const fullName = `${doctor.title || "Dr."} ${doctor.profile.first_name} ${doctor.profile.last_name}`.trim();

  const primarySpecialty =
    doctor.specialties?.find((s) => s.is_primary)?.specialty ||
    doctor.specialties?.[0]?.specialty;

  const specialtyName = primarySpecialty
    ? primarySpecialty.name_key
        .replace("specialty.", "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l: string) => l.toUpperCase())
    : null;

  // Fee calculations
  const consultationFeeCents =
    consultationType === "video" && doctor.video_consultation_fee_cents
      ? doctor.video_consultation_fee_cents
      : doctor.consultation_fee_cents;

  const platformFeeCents = Math.round(
    (consultationFeeCents * PLATFORM_FEE_PERCENT) / 100
  );
  const totalAmountCents = consultationFeeCents + platformFeeCents;

  function canProceed(): boolean {
    if (step === 1) return consultationType !== null;
    if (step === 2) return slotSelection !== null;
    if (step === 3) return true;
    return false;
  }

  function handleNext() {
    if (step < totalSteps && canProceed()) {
      setStep(step + 1);
    }
  }

  function handleBack() {
    if (step > 1) {
      setStep(step - 1);
    }
  }

  function handleSlotSelect(date: string, startTime: string, endTime: string) {
    setSlotSelection({ date, startTime, endTime });
  }

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
        <div className="flex items-center justify-between">
          {[
            { num: 1, label: "Type" },
            { num: 2, label: "Schedule" },
            { num: 3, label: "Review" },
            { num: 4, label: "Payment" },
          ].map(({ num, label }) => (
            <div key={num} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    step >= num
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {num}
                </div>
                <span className="mt-1 text-xs text-muted-foreground">
                  {label}
                </span>
              </div>
              {num < totalSteps && (
                <div
                  className={`mx-2 h-0.5 flex-1 ${
                    step > num ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Consultation Type */}
      {step === 1 && (
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
          <CardContent>
            <RadioGroup
              value={consultationType || ""}
              onValueChange={(val) =>
                setConsultationType(val as ConsultationType)
              }
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
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Date and Time */}
      {step === 2 && consultationType && (
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

      {/* Step 3: Notes & Review */}
      {step === 3 && consultationType && slotSelection && (
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

                <Separator />

                {/* Price Breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Consultation Fee
                    </span>
                    <span>
                      {formatCurrency(
                        consultationFeeCents,
                        doctor.base_currency
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Service Fee ({PLATFORM_FEE_PERCENT}%)
                    </span>
                    <span>
                      {formatCurrency(platformFeeCents, doctor.base_currency)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-lg">
                      {formatCurrency(totalAmountCents, doctor.base_currency)}
                    </span>
                  </div>
                </div>
              </div>

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

      {/* Step 4: Payment */}
      {step === 4 && consultationType && slotSelection && (
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
                    <p className="text-sm text-muted-foreground">
                      {formatDate(slotSelection.date)} at{" "}
                      {formatSlotTime(slotSelection.startTime)}
                    </p>
                  </div>
                  <p className="text-xl font-bold">
                    {formatCurrency(totalAmountCents, doctor.base_currency)}
                  </p>
                </div>
              </div>

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
