"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Search,
  User,
  Stethoscope,
  Calendar,
  CreditCard,
  CheckCircle2,
  Mail,
} from "lucide-react";
import {
  adminSearchPatients,
  adminCreatePatient,
  adminSearchDoctors,
  adminCreateBookingOnBehalf,
} from "@/actions/admin";
import { SlotPicker } from "@/components/booking/slot-picker";
import { formatCurrency } from "@/lib/utils/currency";
import { Link } from "@/i18n/navigation";

type Step = 1 | 2 | 3 | 4 | 5;

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
}

interface Doctor {
  id: string;
  slug: string;
  name: string;
  email: string;
  consultation_fee_cents: number;
  video_consultation_fee_cents: number | null;
  base_currency: string;
  consultation_types: string[];
  stripe_ready: boolean;
}

const STEPS = [
  { num: 1 as Step, label: "Patient", icon: User },
  { num: 2 as Step, label: "Doctor", icon: Stethoscope },
  { num: 3 as Step, label: "Date & Time", icon: Calendar },
  { num: 4 as Step, label: "Review", icon: CreditCard },
  { num: 5 as Step, label: "Done", icon: CheckCircle2 },
];

export function AdminBookingWizard() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 - Patient
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);
  const [newPatientData, setNewPatientData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
  });
  const [creatingPatient, setCreatingPatient] = useState(false);

  // Step 2 - Doctor
  const [doctorQuery, setDoctorQuery] = useState("");
  const [doctorResults, setDoctorResults] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [searchingDoctors, setSearchingDoctors] = useState(false);

  // Step 3 - Date/Time
  const [consultationType, setConsultationType] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedStartTime, setSelectedStartTime] = useState<string>("");
  const [selectedEndTime, setSelectedEndTime] = useState<string>("");

  // Step 4 - Notes
  const [patientNotes, setPatientNotes] = useState("");

  // Step 5 - Result
  const [bookingResult, setBookingResult] = useState<{
    bookingId: string;
    bookingNumber: string;
    patientEmail: string;
  } | null>(null);

  // Patient search
  const handlePatientSearch = useCallback(async (q: string) => {
    setPatientQuery(q);
    if (q.length < 2) {
      setPatientResults([]);
      return;
    }
    setSearchingPatients(true);
    const result = await adminSearchPatients(q);
    setPatientResults(result.data || []);
    setSearchingPatients(false);
  }, []);

  // Create patient
  const handleCreatePatient = useCallback(async () => {
    if (!newPatientData.email || !newPatientData.first_name || !newPatientData.last_name) {
      setError("Please fill in all required fields.");
      return;
    }
    setCreatingPatient(true);
    setError(null);
    const result = await adminCreatePatient(newPatientData);
    setCreatingPatient(false);

    if (result.error) {
      if ("existingPatient" in result && result.existingPatient) {
        setSelectedPatient(result.existingPatient as Patient);
        setShowNewPatientForm(false);
        setError(null);
      } else {
        setError(result.error);
      }
      return;
    }

    if ("patient" in result && result.patient) {
      setSelectedPatient(result.patient as Patient);
      setShowNewPatientForm(false);
    }
  }, [newPatientData]);

  // Doctor search
  const handleDoctorSearch = useCallback(async (q: string) => {
    setDoctorQuery(q);
    if (q.length < 2) {
      setDoctorResults([]);
      return;
    }
    setSearchingDoctors(true);
    const result = await adminSearchDoctors(q);
    setDoctorResults(result.data || []);
    setSearchingDoctors(false);
  }, []);

  // Submit booking
  const handleSubmit = useCallback(async () => {
    if (!selectedPatient || !selectedDoctor || !selectedDate || !selectedStartTime) return;
    setLoading(true);
    setError(null);

    const result = await adminCreateBookingOnBehalf({
      patient_id: selectedPatient.id,
      doctor_id: selectedDoctor.id,
      appointment_date: selectedDate,
      start_time: selectedStartTime,
      end_time: selectedEndTime,
      consultation_type: consultationType,
      patient_notes: patientNotes || undefined,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if ("bookingId" in result) {
      setBookingResult({
        bookingId: result.bookingId as string,
        bookingNumber: result.bookingNumber as string,
        patientEmail: result.patientEmail as string,
      });
      setStep(5);
    }
  }, [selectedPatient, selectedDoctor, selectedDate, selectedStartTime, selectedEndTime, consultationType, patientNotes]);

  const canProceed = () => {
    switch (step) {
      case 1: return !!selectedPatient;
      case 2: return !!selectedDoctor;
      case 3: return !!selectedDate && !!selectedStartTime && !!consultationType;
      case 4: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step === 4) {
      handleSubmit();
    } else if (step < 5) {
      setStep((step + 1) as Step);
      setError(null);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
      setError(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.num;
          const isCompleted = step > s.num;
          return (
            <div key={s.num} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCompleted
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span className={`text-xs font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-2 h-px w-8 md:w-16 ${isCompleted ? "bg-green-500" : "bg-muted-foreground/30"}`} />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Patient */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Select or Create Patient
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-lg border bg-green-50 p-4">
                <div>
                  <p className="font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedPatient.email}</p>
                  {selectedPatient.phone && (
                    <p className="text-sm text-muted-foreground">{selectedPatient.phone}</p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => { setSelectedPatient(null); setPatientQuery(""); }}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                {!showNewPatientForm ? (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, email, or phone..."
                        value={patientQuery}
                        onChange={(e) => handlePatientSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {searchingPatients && <p className="text-sm text-muted-foreground">Searching...</p>}
                    {patientResults.length > 0 && (
                      <div className="space-y-2">
                        {patientResults.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedPatient(p)}
                            className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                          >
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{p.first_name} {p.last_name}</p>
                              <p className="text-xs text-muted-foreground">{p.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {patientQuery.length >= 2 && patientResults.length === 0 && !searchingPatients && (
                      <p className="text-sm text-muted-foreground">No patients found.</p>
                    )}
                    <Button variant="outline" onClick={() => setShowNewPatientForm(true)} className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      Create New Patient
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>First Name *</Label>
                        <Input
                          value={newPatientData.first_name}
                          onChange={(e) => setNewPatientData((d) => ({ ...d, first_name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Last Name *</Label>
                        <Input
                          value={newPatientData.last_name}
                          onChange={(e) => setNewPatientData((d) => ({ ...d, last_name: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={newPatientData.email}
                        onChange={(e) => setNewPatientData((d) => ({ ...d, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Phone (optional)</Label>
                      <Input
                        value={newPatientData.phone}
                        onChange={(e) => setNewPatientData((d) => ({ ...d, phone: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowNewPatientForm(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreatePatient} disabled={creatingPatient}>
                        {creatingPatient && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Patient
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Doctor */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Select Doctor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedDoctor ? (
              <div className="flex items-center justify-between rounded-lg border bg-green-50 p-4">
                <div>
                  <p className="font-medium">Dr. {selectedDoctor.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedDoctor.email}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="outline">
                      {formatCurrency(selectedDoctor.consultation_fee_cents, selectedDoctor.base_currency)}
                    </Badge>
                    {selectedDoctor.consultation_types.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t === "video" ? "Video" : "In Person"}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  setSelectedDoctor(null);
                  setDoctorQuery("");
                  setConsultationType("");
                  setSelectedDate("");
                  setSelectedStartTime("");
                  setSelectedEndTime("");
                }}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search doctors by name or email..."
                    value={doctorQuery}
                    onChange={(e) => handleDoctorSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {searchingDoctors && <p className="text-sm text-muted-foreground">Searching...</p>}
                {doctorResults.length > 0 && (
                  <div className="space-y-2">
                    {doctorResults.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => {
                          setSelectedDoctor(d);
                          // Auto-select consultation type if only one
                          if (d.consultation_types.length === 1) {
                            setConsultationType(d.consultation_types[0]);
                          }
                        }}
                        disabled={!d.stripe_ready}
                        className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          <Stethoscope className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Dr. {d.name}</p>
                            <p className="text-xs text-muted-foreground">{d.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {formatCurrency(d.consultation_fee_cents, d.base_currency)}
                          </Badge>
                          {!d.stripe_ready && (
                            <Badge variant="destructive" className="text-xs">No Stripe</Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {doctorQuery.length >= 2 && doctorResults.length === 0 && !searchingDoctors && (
                  <p className="text-sm text-muted-foreground">No doctors found.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Date/Time */}
      {step === 3 && selectedDoctor && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Select Date & Time
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Consultation type selector */}
            {selectedDoctor.consultation_types.length > 1 && (
              <div>
                <Label className="mb-2 block">Consultation Type</Label>
                <div className="flex gap-2">
                  {selectedDoctor.consultation_types.map((type) => (
                    <Button
                      key={type}
                      variant={consultationType === type ? "default" : "outline"}
                      onClick={() => {
                        setConsultationType(type);
                        setSelectedDate("");
                        setSelectedStartTime("");
                        setSelectedEndTime("");
                      }}
                    >
                      {type === "video" ? "Video Consultation" : "In-Person Consultation"}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {consultationType && (
              <SlotPicker
                doctorId={selectedDoctor.id}
                consultationType={consultationType}
                onSlotSelect={(date, startTime, endTime) => {
                  setSelectedDate(date);
                  setSelectedStartTime(startTime);
                  setSelectedEndTime(endTime);
                }}
              />
            )}

            {selectedDate && selectedStartTime && (
              <div className="rounded-lg border bg-green-50 p-3 text-sm">
                <p className="font-medium text-green-800">
                  Selected: {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} at {selectedStartTime.slice(0, 5)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review */}
      {step === 4 && selectedPatient && selectedDoctor && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Review & Confirm
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y rounded-lg border">
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-muted-foreground">Patient</span>
                <span className="text-sm font-medium">{selectedPatient.first_name} {selectedPatient.last_name} ({selectedPatient.email})</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-muted-foreground">Doctor</span>
                <span className="text-sm font-medium">Dr. {selectedDoctor.name}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-muted-foreground">Date</span>
                <span className="text-sm font-medium">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-muted-foreground">Time</span>
                <span className="text-sm font-medium">{selectedStartTime.slice(0, 5)} – {selectedEndTime.slice(0, 5)}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-muted-foreground">Type</span>
                <span className="text-sm font-medium">
                  {consultationType === "video" ? "Video Consultation" : "In-Person Consultation"}
                </span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-muted-foreground">Consultation Fee</span>
                <span className="text-sm font-medium">
                  {formatCurrency(
                    consultationType === "video" && selectedDoctor.video_consultation_fee_cents
                      ? selectedDoctor.video_consultation_fee_cents
                      : selectedDoctor.consultation_fee_cents,
                    selectedDoctor.base_currency
                  )}
                </span>
              </div>
            </div>

            <div>
              <Label>Notes for Patient (optional)</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={patientNotes}
                onChange={(e) => setPatientNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <strong>Note:</strong> A payment link will be emailed to the patient. The booking will remain in &ldquo;Pending Payment&rdquo; until the patient completes the payment. The link expires in 24 hours but can be resent.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Done */}
      {step === 5 && bookingResult && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold">Booking Created Successfully!</h2>
            <p className="mt-2 text-muted-foreground">
              Booking <span className="font-mono font-medium">{bookingResult.bookingNumber}</span> has been created.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              Payment link sent to <strong>{bookingResult.patientEmail}</strong>
            </div>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button asChild>
                <Link href={`/admin/bookings/${bookingResult.bookingId}`}>
                  View Booking
                </Link>
              </Button>
              <Button variant="outline" onClick={() => {
                // Reset wizard
                setStep(1);
                setSelectedPatient(null);
                setSelectedDoctor(null);
                setConsultationType("");
                setSelectedDate("");
                setSelectedStartTime("");
                setSelectedEndTime("");
                setPatientNotes("");
                setBookingResult(null);
                setError(null);
                setPatientQuery("");
                setDoctorQuery("");
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Create Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      {step < 5 && (
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBack} disabled={step === 1}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleNext} disabled={!canProceed() || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {step === 4 ? "Create Booking" : "Next"}
            {step < 4 && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
