"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  XCircle,
  CalendarClock,
  Clock,
  Calendar,
  Building2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/utils/currency";
import { adminCancelBooking, adminRescheduleBooking } from "@/actions/clinic-booking";

// ─── Types ────────────────────────────────────────────────────

interface Booking {
  id: string;
  booking_number: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  consultation_type: string;
  total_amount_cents: number;
  currency: string;
  doctor_id: string;
  paid_at: string | null;
  stripe_payment_intent_id: string | null;
  patient: { first_name: string; last_name: string } | null;
  doctor: {
    id: string;
    profile: { first_name: string; last_name: string } | null;
  } | null;
}

interface ClinicDoctor {
  user_id: string;
  doctor: {
    id: string;
    consultation_fee_cents: number;
    profile: { first_name: string; last_name: string } | null;
  } | null;
}

interface Props {
  bookings: Booking[];
  doctors: ClinicDoctor[];
  activeTab: string;
}

// ─── Constants ────────────────────────────────────────────────

const CANCELLABLE_STATUSES = new Set([
  "confirmed",
  "pending_approval",
  "approved",
  "pending_reschedule_payment",
]);

const STATUS_STYLES: Record<string, string> = {
  pending_payment: "bg-gray-100 text-gray-700",
  pending_approval: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  approved: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled_patient: "bg-red-100 text-red-700",
  cancelled_doctor: "bg-red-100 text-red-700",
  no_show: "bg-yellow-100 text-yellow-700",
  refunded: "bg-orange-100 text-orange-700",
  pending_reschedule_payment: "bg-purple-100 text-purple-700",
};

const TABS = [
  { key: "upcoming", label: "Upcoming", icon: Clock },
  { key: "past", label: "Past", icon: Calendar },
  { key: "all", label: "All", icon: Building2 },
];

// ─── Helpers ──────────────────────────────────────────────────

function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function addMinutes(timeStr: string, mins: number): string {
  const total = parseTime(timeStr) + mins;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function calcDuration(start: string, end: string): number {
  return parseTime(end) - parseTime(start);
}

function doctorName(d: ClinicDoctor["doctor"]): string {
  if (!d) return "Unknown";
  const p = Array.isArray(d.profile) ? d.profile[0] : d.profile;
  return p ? `Dr. ${p.first_name} ${p.last_name}` : "Unknown";
}

// ─── Cancel Dialog ────────────────────────────────────────────

function CancelDialog({
  booking,
  open,
  onOpenChange,
  onSuccess,
}: {
  booking: Booking;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [refunded, setRefunded] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const isPaid = !!booking.stripe_payment_intent_id && !!booking.paid_at;

  function handleSubmit() {
    setError(null);
    const fd = new FormData();
    fd.set("booking_id", booking.id);
    if (reason) fd.set("reason", reason);

    startTransition(async () => {
      const result = await adminCancelBooking(fd);
      if (result.error) {
        setError(result.error);
      } else {
        setRefunded((result as any).refundAmountCents ?? null);
        setDone(true);
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
          setDone(false);
          setReason("");
        }, 2000);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Cancel Booking #{booking.booking_number}
          </DialogTitle>
          <DialogDescription>
            This will cancel the booking and{" "}
            {isPaid ? "issue a full refund to the patient." : "no charge was made."}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="font-medium">Booking cancelled</p>
            {refunded && refunded > 0 && (
              <p className="text-sm text-muted-foreground">
                Refund of {formatCurrency(refunded, booking.currency)} issued
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p>
                  <span className="font-medium">Patient:</span>{" "}
                  {booking.patient?.first_name} {booking.patient?.last_name}
                </p>
                <p>
                  <span className="font-medium">Date:</span>{" "}
                  {new Date(booking.appointment_date).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                  })}{" "}
                  at {booking.start_time?.slice(0, 5)}
                </p>
                {isPaid && (
                  <p className="mt-1 text-green-700">
                    Full refund of {formatCurrency(booking.total_amount_cents, booking.currency)}{" "}
                    will be issued
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="cancel-reason">Reason (optional)</Label>
                <Textarea
                  id="cancel-reason"
                  placeholder="e.g. Doctor unavailable, clinic closed…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Keep Booking
              </Button>
              <Button variant="destructive" onClick={handleSubmit} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelling…
                  </>
                ) : (
                  "Cancel Booking"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Reschedule Dialog ────────────────────────────────────────

function RescheduleDialog({
  booking,
  doctors,
  open,
  onOpenChange,
  onSuccess,
}: {
  booking: Booking;
  doctors: ClinicDoctor[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const originalDuration = calcDuration(
    booking.start_time?.slice(0, 5) ?? "09:00",
    booking.end_time?.slice(0, 5) ?? "09:30"
  );

  const [newDoctorId, setNewDoctorId] = useState(booking.doctor_id ?? "");
  const [newDate, setNewDate] = useState(booking.appointment_date ?? "");
  const [newStartTime, setNewStartTime] = useState(booking.start_time?.slice(0, 5) ?? "09:00");
  const [newEndTime, setNewEndTime] = useState(
    addMinutes(booking.start_time?.slice(0, 5) ?? "09:00", originalDuration || 30)
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    requiresPayment: boolean;
    paymentLinkUrl?: string;
    priceDiffCents?: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Auto-update end time when start time changes (preserve original duration)
  function handleStartTimeChange(val: string) {
    setNewStartTime(val);
    setNewEndTime(addMinutes(val, originalDuration || 30));
  }

  function handleSubmit() {
    setError(null);
    if (!newDoctorId || !newDate || !newStartTime || !newEndTime) {
      setError("Please fill in all required fields.");
      return;
    }

    const fd = new FormData();
    fd.set("booking_id", booking.id);
    fd.set("new_doctor_id", newDoctorId);
    fd.set("new_appointment_date", newDate);
    fd.set("new_start_time", newStartTime);
    fd.set("new_end_time", newEndTime);
    if (reason) fd.set("reason", reason);

    startTransition(async () => {
      const res = await adminRescheduleBooking(fd);
      if (res.error) {
        setError(res.error);
      } else {
        setResult({
          requiresPayment: (res as any).requiresPayment ?? false,
          paymentLinkUrl: (res as any).paymentLinkUrl,
          priceDiffCents: (res as any).priceDiffCents,
        });
      }
    });
  }

  // Show result state
  if (result) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              {result.requiresPayment ? "Payment Required" : "Booking Rescheduled"}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 text-center space-y-3">
            {result.requiresPayment ? (
              <>
                <p className="text-sm text-muted-foreground">
                  The new slot is{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(result.priceDiffCents ?? 0, booking.currency)} more
                  </span>{" "}
                  than the original. A payment link has been emailed to the patient.
                </p>
                {result.paymentLinkUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={result.paymentLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      View Payment Page
                    </a>
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                The appointment has been rescheduled and the patient has been notified.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                onSuccess();
                onOpenChange(false);
                setResult(null);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-blue-500" />
            Reschedule Booking #{booking.booking_number}
          </DialogTitle>
          <DialogDescription>
            Select a new doctor, date, and time. If the new slot costs more, the patient will be
            sent a payment link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current appointment summary */}
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
              Current appointment
            </p>
            <p>
              {booking.patient?.first_name} {booking.patient?.last_name} —{" "}
              {new Date(booking.appointment_date).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}{" "}
              at {booking.start_time?.slice(0, 5)}
            </p>
          </div>

          {/* Doctor selection */}
          <div className="space-y-1.5">
            <Label>
              Doctor <span className="text-red-500">*</span>
            </Label>
            <Select value={newDoctorId} onValueChange={setNewDoctorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => {
                  const doc = Array.isArray(d.doctor) ? d.doctor[0] : d.doctor;
                  if (!doc) return null;
                  return (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doctorName(doc)}
                      {doc.id === booking.doctor_id && " (current)"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="new-date">
              New Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="new-date"
              type="date"
              value={newDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-start">
                Start Time <span className="text-red-500">*</span>
              </Label>
              <Input
                id="new-start"
                type="time"
                value={newStartTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-end">
                End Time <span className="text-red-500">*</span>
              </Label>
              <Input
                id="new-end"
                type="time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-reason">Reason (optional)</Label>
            <Textarea
              id="reschedule-reason"
              placeholder="e.g. Doctor unavailable, patient request…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rescheduling…
              </>
            ) : (
              "Reschedule Booking"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Table Component ─────────────────────────────────────

export function OrgBookingsClient({ bookings, doctors, activeTab }: Props) {
  const router = useRouter();
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Booking | null>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <>
      {/* Tab navigation */}
      <div className="flex gap-2 border-b">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              href={`/doctor-dashboard/organization/bookings?tab=${t.key}`}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Bookings table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking #</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => {
                const doc: any = Array.isArray(booking.doctor)
                  ? booking.doctor[0]
                  : booking.doctor;
                const docProfile: any = doc?.profile
                  ? Array.isArray(doc.profile) ? doc.profile[0] : doc.profile
                  : null;
                const canAct = CANCELLABLE_STATUSES.has(booking.status);

                return (
                  <TableRow key={booking.id}>
                    <TableCell className="font-mono text-xs">
                      {booking.booking_number}
                    </TableCell>
                    <TableCell className="text-sm">
                      {booking.patient?.first_name} {booking.patient?.last_name}
                    </TableCell>
                    <TableCell className="text-sm">
                      Dr. {docProfile?.first_name} {docProfile?.last_name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(booking.appointment_date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {booking.start_time?.slice(0, 5)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {booking.consultation_type === "video" ? "Video" : "In Person"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatCurrency(booking.total_amount_cents, booking.currency)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[booking.status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {booking.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {canAct ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRescheduleTarget(booking)}
                          >
                            <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                            Reschedule
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                            onClick={() => setCancelTarget(booking)}
                          >
                            <XCircle className="mr-1.5 h-3.5 w-3.5" />
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {bookings.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-12 text-center text-muted-foreground"
                  >
                    {activeTab === "upcoming"
                      ? "No upcoming bookings across your organization"
                      : "No bookings found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      {cancelTarget && (
        <CancelDialog
          booking={cancelTarget}
          open={!!cancelTarget}
          onOpenChange={(v) => !v && setCancelTarget(null)}
          onSuccess={refresh}
        />
      )}

      {rescheduleTarget && (
        <RescheduleDialog
          booking={rescheduleTarget}
          doctors={doctors}
          open={!!rescheduleTarget}
          onOpenChange={(v) => !v && setRescheduleTarget(null)}
          onSuccess={refresh}
        />
      )}
    </>
  );
}
