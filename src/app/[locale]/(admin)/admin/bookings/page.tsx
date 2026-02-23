import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/currency";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  confirmed: "default",
  approved: "default",
  pending_payment: "secondary",
  pending_approval: "secondary",
  completed: "outline",
  cancelled_patient: "destructive",
  cancelled_doctor: "destructive",
  rejected: "destructive",
  no_show: "destructive",
  refunded: "secondary",
};

export default async function AdminBookingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/en");

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      `id, booking_number, appointment_date, start_time, status, consultation_type,
       total_amount_cents, currency,
       patient:profiles!bookings_patient_id_fkey(first_name, last_name),
       doctor:doctors!inner(profile:profiles!doctors_profile_id_fkey(first_name, last_name))`
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Booking Management</h1>

      <Card>
        <CardHeader>
          <CardTitle>Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking #</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(bookings as any[])?.map(
                (booking: any) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-mono text-sm">
                      {booking.booking_number}
                    </TableCell>
                    <TableCell>
                      {booking.patient?.first_name} {booking.patient?.last_name}
                    </TableCell>
                    <TableCell>
                      {booking.doctor?.profile?.first_name}{" "}
                      {booking.doctor?.profile?.last_name}
                    </TableCell>
                    <TableCell>
                      {new Date(booking.appointment_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {booking.consultation_type === "video"
                          ? "Video"
                          : "In Person"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[booking.status] || "outline"}>
                        {booking.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(
                        booking.total_amount_cents,
                        booking.currency
                      )}
                    </TableCell>
                  </TableRow>
                )
              )}
              {(!bookings || bookings.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No bookings yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
