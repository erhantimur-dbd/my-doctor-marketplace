import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/currency";
import { Calendar, Clock, CheckCircle, Eye } from "lucide-react";

const statusColors: Record<string, string> = {
  pending_payment: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-700",
  approved: "bg-blue-100 text-blue-700",
  pending_approval: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled_patient: "bg-red-100 text-red-700",
  cancelled_doctor: "bg-red-100 text-red-700",
  no_show: "bg-yellow-100 text-yellow-700",
  refunded: "bg-orange-100 text-orange-700",
  rejected: "bg-red-100 text-red-700",
};

type TabKey = "upcoming" | "past" | "all";

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab: TabKey =
    rawTab === "past" || rawTab === "all" ? rawTab : "upcoming";

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

  const today = new Date().toISOString().split("T")[0];

  // Count queries for tab badges
  const [{ count: upcomingCount }, { count: pastCount }, { count: allCount }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .gte("appointment_date", today)
        .in("status", [
          "confirmed",
          "approved",
          "pending_payment",
          "pending_approval",
        ]),
      supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .lt("appointment_date", today),
      supabase
        .from("bookings")
        .select("*", { count: "exact", head: true }),
    ]);

  // Build query based on tab
  let query = supabase
    .from("bookings")
    .select(
      `id, booking_number, appointment_date, start_time, end_time, status, consultation_type,
       total_amount_cents, platform_fee_cents, currency,
       patient:profiles!bookings_patient_id_fkey(first_name, last_name),
       doctor:doctors!inner(profile:profiles!doctors_profile_id_fkey(first_name, last_name))`
    )
    .limit(50);

  if (tab === "upcoming") {
    query = query
      .gte("appointment_date", today)
      .in("status", [
        "confirmed",
        "approved",
        "pending_payment",
        "pending_approval",
      ])
      .order("appointment_date", { ascending: true });
  } else if (tab === "past") {
    query = query
      .lt("appointment_date", today)
      .order("appointment_date", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: bookings } = await query;

  const tabs: {
    key: TabKey;
    label: string;
    count: number | null;
    icon: React.ElementType;
  }[] = [
    { key: "upcoming", label: "Upcoming", count: upcomingCount, icon: Clock },
    {
      key: "past",
      label: "Past",
      count: pastCount,
      icon: CheckCircle,
    },
    { key: "all", label: "All", count: allCount, icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Booking Management</h1>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/bookings?tab=${t.key}`}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {(t.count ?? 0) > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 min-w-5 px-1.5 text-xs"
              >
                {t.count}
              </Badge>
            )}
          </Link>
        ))}
      </div>

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
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(bookings as any[])?.map((booking: any) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-mono text-xs">
                    {booking.booking_number}
                  </TableCell>
                  <TableCell className="text-sm">
                    {booking.patient?.first_name} {booking.patient?.last_name}
                  </TableCell>
                  <TableCell className="text-sm">
                    Dr. {booking.doctor?.profile?.first_name}{" "}
                    {booking.doctor?.profile?.last_name}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(booking.appointment_date).toLocaleDateString(
                      "en-GB",
                      { day: "numeric", month: "short", year: "numeric" }
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {booking.start_time?.slice(0, 5)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {booking.consultation_type === "video"
                        ? "Video"
                        : "In Person"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {formatCurrency(
                      booking.total_amount_cents,
                      booking.currency
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusColors[booking.status] ||
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {booking.status.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/bookings/${booking.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {(!bookings || bookings.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-12 text-center text-muted-foreground"
                  >
                    {tab === "upcoming"
                      ? "No upcoming bookings"
                      : tab === "past"
                        ? "No past bookings"
                        : "No bookings yet"}
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
