import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  HeartPulse,
  Phone,
  AlertTriangle,
  Pill,
  Activity,
  Droplets,
  ShieldOff,
  Calendar,
  Video,
  MapPin,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id: patientId, locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  // Verify user is a doctor
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, base_currency")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) redirect(`/${locale}/register-doctor`);

  // Verify doctor has completed bookings with this patient
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, booking_number, appointment_date, start_time, end_time, consultation_type, status, total_amount_cents, currency, visit_summary"
    )
    .eq("doctor_id", doctor.id)
    .eq("patient_id", patientId)
    .in("status", ["confirmed", "approved", "completed"])
    .order("appointment_date", { ascending: false });

  if (!bookings || bookings.length === 0) {
    redirect(`/${locale}/doctor-dashboard/patients`);
  }

  const hasCompletedBooking = bookings.some((b) => b.status === "completed");

  // Fetch patient profile
  const { data: patient } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, avatar_url, phone")
    .eq("id", patientId)
    .single();

  if (!patient) redirect(`/${locale}/doctor-dashboard/patients`);

  // Fetch medical profile (only if patient has granted consent and doctor has completed booking)
  let medicalProfile = null;
  if (hasCompletedBooking) {
    const { data: mp } = await supabase
      .from("medical_profiles")
      .select("*")
      .eq("patient_id", patientId)
      .eq("sharing_consent", true)
      .maybeSingle();
    medicalProfile = mp;
  }

  const totalVisits = bookings.filter((b) => b.status === "completed").length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.total_amount_cents || 0), 0);

  const STATUS_COLORS: Record<string, string> = {
    confirmed: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800",
    completed: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <Link href={`/${locale}/doctor-dashboard/patients`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            {patient.avatar_url && (
              <AvatarImage src={patient.avatar_url} alt={patient.first_name} />
            )}
            <AvatarFallback>
              {patient.first_name.charAt(0)}
              {patient.last_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">
              {patient.first_name} {patient.last_name}
            </h1>
            <p className="text-sm text-muted-foreground">{patient.email}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Visits</p>
              <p className="text-2xl font-bold">{totalVisits}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <Activity className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">
                {formatCurrency(totalRevenue, doctor.base_currency)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-purple-50 p-3">
              <HeartPulse className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Medical Profile</p>
              <p className="text-lg font-bold">
                {medicalProfile ? "Shared" : "Not shared"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Medical Profile */}
      {medicalProfile ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="h-4 w-4" />
              Medical Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Blood Type */}
              {medicalProfile.blood_type && (
                <div className="flex items-start gap-2">
                  <Droplets className="h-4 w-4 mt-0.5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium">Blood Type</p>
                    <p className="text-sm text-muted-foreground">
                      {medicalProfile.blood_type}
                    </p>
                  </div>
                </div>
              )}

              {/* Emergency Contact */}
              {(medicalProfile.emergency_contact_name || medicalProfile.emergency_contact_phone) && (
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 mt-0.5 text-orange-500" />
                  <div>
                    <p className="text-sm font-medium">Emergency Contact</p>
                    <p className="text-sm text-muted-foreground">
                      {medicalProfile.emergency_contact_name}
                      {medicalProfile.emergency_contact_phone && (
                        <> — {medicalProfile.emergency_contact_phone}</>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Allergies */}
            {medicalProfile.allergies?.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-medium">Allergies</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {medicalProfile.allergies.map((a: string, i: number) => (
                    <Badge key={i} variant="destructive" className="font-normal">
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Chronic Conditions */}
            {medicalProfile.chronic_conditions?.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <p className="text-sm font-medium">Chronic Conditions</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {medicalProfile.chronic_conditions.map((c: string, i: number) => (
                    <Badge key={i} variant="secondary">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Current Medications */}
            {medicalProfile.current_medications?.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Pill className="h-4 w-4 text-green-500" />
                  <p className="text-sm font-medium">Current Medications</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {medicalProfile.current_medications.map((m: string, i: number) => (
                    <Badge key={i} variant="outline">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {medicalProfile.notes && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium mb-1">Additional Notes</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {medicalProfile.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShieldOff className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="font-medium">Medical Profile Not Available</p>
            <p className="text-sm text-muted-foreground max-w-md mt-1">
              {hasCompletedBooking
                ? "This patient has not shared their medical profile yet. They can enable sharing from their settings."
                : "You need at least one completed consultation to view the patient's medical profile."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Booking History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Booking History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-mono text-sm">
                    {booking.booking_number}
                  </TableCell>
                  <TableCell>
                    {new Date(booking.appointment_date).toLocaleDateString(
                      "en-GB",
                      { day: "numeric", month: "short", year: "numeric" }
                    )}
                  </TableCell>
                  <TableCell>
                    {booking.start_time.slice(0, 5)} -{" "}
                    {booking.end_time.slice(0, 5)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      {booking.consultation_type === "video" ? (
                        <Video className="h-3 w-3" />
                      ) : (
                        <MapPin className="h-3 w-3" />
                      )}
                      {booking.consultation_type === "video"
                        ? "Video"
                        : "In Person"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[booking.status] || "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {booking.status.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(
                      booking.total_amount_cents,
                      booking.currency || doctor.base_currency
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
