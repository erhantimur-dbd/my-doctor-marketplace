"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Video,
  MapPin,
  Calendar,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BookingRow = any;

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending_approval: "bg-yellow-100 text-yellow-800",
  pending_payment: "bg-orange-100 text-orange-800",
  confirmed: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled_patient: "bg-red-100 text-red-800",
  cancelled_doctor: "bg-red-100 text-red-800",
  rejected: "bg-red-100 text-red-800",
  no_show: "bg-gray-100 text-gray-800",
  refunded: "bg-purple-100 text-purple-800",
};

function statusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorCurrency, setDoctorCurrency] = useState("EUR");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingBookingId, setRejectingBookingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
      .select("id, base_currency")
      .eq("profile_id", user.id)
      .single();
    if (!doctor) return;

    setDoctorId(doctor.id);
    setDoctorCurrency(doctor.base_currency);

    const { data } = await supabase
      .from("bookings")
      .select(
        "id, booking_number, appointment_date, start_time, end_time, consultation_type, status, currency, total_amount_cents, patient_notes, patient:profiles!bookings_patient_id_fkey(first_name, last_name, email)"
      )
      .eq("doctor_id", doctor.id)
      .order("appointment_date", { ascending: false })
      .order("start_time", { ascending: false });

    setBookings((data as unknown as BookingRow[]) || []);
    setLoading(false);
  }

  async function acceptBooking(bookingId: string) {
    setActionLoading(bookingId);
    const supabase = createSupabase();
    await supabase
      .from("bookings")
      .update({ status: "approved" })
      .eq("id", bookingId);
    await loadData();
    setActionLoading(null);
  }

  async function rejectBooking() {
    if (!rejectingBookingId) return;
    setActionLoading(rejectingBookingId);
    const supabase = createSupabase();
    await supabase
      .from("bookings")
      .update({
        status: "rejected",
        cancellation_reason: rejectReason || null,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", rejectingBookingId);

    setRejectDialogOpen(false);
    setRejectReason("");
    setRejectingBookingId(null);
    await loadData();
    setActionLoading(null);
  }

  const today = new Date().toISOString().split("T")[0];

  const pendingBookings = bookings.filter(
    (b) => b.status === "pending_approval"
  );
  const upcomingBookings = bookings.filter(
    (b) =>
      ["confirmed", "approved"].includes(b.status) &&
      b.appointment_date >= today
  );
  const pastBookings = bookings.filter(
    (b) =>
      ["completed", "cancelled_patient", "cancelled_doctor", "rejected", "no_show", "refunded"].includes(b.status) ||
      (["confirmed", "approved"].includes(b.status) && b.appointment_date < today)
  );

  function renderBookingTable(rows: BookingRow[], showActions: boolean) {
    if (rows.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">No bookings in this category</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Booking #</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Amount</TableHead>
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((booking) => (
            <TableRow key={booking.id}>
              <TableCell className="font-mono text-sm">
                {booking.booking_number}
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">
                    {booking.patient.first_name} {booking.patient.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {booking.patient.email}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                {new Date(booking.appointment_date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell>
                {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="gap-1">
                  {booking.consultation_type === "video" ? (
                    <Video className="h-3 w-3" />
                  ) : (
                    <MapPin className="h-3 w-3" />
                  )}
                  {booking.consultation_type === "video" ? "Video" : "In Person"}
                </Badge>
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[booking.status] || "bg-gray-100 text-gray-800"}`}
                >
                  {statusLabel(booking.status)}
                </span>
              </TableCell>
              <TableCell className="font-medium">
                {formatCurrency(
                  booking.total_amount_cents,
                  booking.currency || doctorCurrency
                )}
              </TableCell>
              {showActions && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => acceptBooking(booking.id)}
                      disabled={actionLoading === booking.id}
                    >
                      {actionLoading === booking.id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                      )}
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setRejectingBookingId(booking.id);
                        setRejectReason("");
                        setRejectDialogOpen(true);
                      }}
                      disabled={actionLoading === booking.id}
                    >
                      <XCircle className="mr-1 h-3 w-3" />
                      Reject
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
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
        <h1 className="text-2xl font-bold">Bookings</h1>
        <p className="text-muted-foreground">
          Manage your appointment requests and bookings
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-yellow-50 p-3">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{pendingBookings.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Upcoming</p>
              <p className="text-2xl font-bold">{upcomingBookings.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-gray-50 p-3">
              <Calendar className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Past</p>
              <p className="text-2xl font-bold">{pastBookings.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            Pending
            {pendingBookings.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                {pendingBookings.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {renderBookingTable(pendingBookings, true)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {renderBookingTable(upcomingBookings, false)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {renderBookingTable(pastBookings, false)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for rejection (optional)</Label>
              <Textarea
                placeholder="Provide a reason for the patient..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={rejectBooking}>
              Reject Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
