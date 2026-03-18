import { getOrgBookings } from "@/actions/org-dashboard";
import { requireOrgMember } from "@/actions/organization";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/currency";
import { ArrowLeft, Calendar, Clock, Building2 } from "lucide-react";

const statusColors: Record<string, string> = {
  pending_payment: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-700",
  approved: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled_patient: "bg-red-100 text-red-700",
  cancelled_doctor: "bg-red-100 text-red-700",
  no_show: "bg-yellow-100 text-yellow-700",
  refunded: "bg-orange-100 text-orange-700",
};

export default async function OrgBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { error } = await requireOrgMember(["owner", "admin"]);
  if (error) redirect("/en/doctor-dashboard");

  const { tab: rawTab } = await searchParams;
  const tab = (rawTab === "past" || rawTab === "all") ? rawTab : "upcoming";

  const result = await getOrgBookings({ tab });
  const bookings = (result.data || []) as any[];

  const tabs = [
    { key: "upcoming", label: "Upcoming", icon: Clock },
    { key: "past", label: "Past", icon: Calendar },
    { key: "all", label: "All", icon: Building2 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/doctor-dashboard/organization"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">Organization Bookings</h1>
      </div>

      <div className="flex gap-2 border-b">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              href={`/doctor-dashboard/organization/bookings?tab=${t.key}`}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.key
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking: any) => {
                const doctor = booking.doctor;
                const doctorProfile: any = doctor?.profile
                  ? (Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile)
                  : null;
                return (
                  <TableRow key={booking.id}>
                    <TableCell className="font-mono text-xs">
                      {booking.booking_number}
                    </TableCell>
                    <TableCell className="text-sm">
                      {booking.patient?.first_name} {booking.patient?.last_name}
                    </TableCell>
                    <TableCell className="text-sm">
                      Dr. {doctorProfile?.first_name} {doctorProfile?.last_name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(booking.appointment_date).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
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
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusColors[booking.status] || "bg-gray-100 text-gray-700"
                      }`}>
                        {booking.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {bookings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                    {tab === "upcoming" ? "No upcoming bookings across your organization" : "No bookings found"}
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
