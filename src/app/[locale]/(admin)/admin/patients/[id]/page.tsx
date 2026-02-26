import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  User,
  Calendar,
  Star,
  MapPin,
  Mail,
  Phone,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

const statusColors: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700",
  approved: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled_patient: "bg-red-100 text-red-700",
  cancelled_doctor: "bg-red-100 text-red-700",
  no_show: "bg-yellow-100 text-yellow-700",
  refunded: "bg-orange-100 text-orange-700",
};

export default async function AdminPatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (adminProfile?.role !== "admin") redirect("/en");

  const { data: patient } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (!patient) redirect("/en/admin/patients");

  // Get bookings
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      `id, booking_number, appointment_date, start_time, status, consultation_type,
       total_amount_cents, currency,
       doctor:doctors!inner(slug, profile:profiles!doctors_profile_id_fkey(first_name, last_name))`
    )
    .eq("patient_id", id)
    .order("appointment_date", { ascending: false })
    .limit(20);

  // Get reviews
  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      `id, rating, title, comment, is_visible, created_at,
       doctor:doctors!inner(slug, profile:profiles!doctors_profile_id_fkey(first_name, last_name))`
    )
    .eq("patient_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const totalSpent = (bookings || [])
    .filter((b: any) =>
      ["confirmed", "approved", "completed"].includes(b.status)
    )
    .reduce((sum: number, b: any) => sum + b.total_amount_cents, 0);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/patients"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Patients
      </Link>

      {/* Patient Header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          {patient.avatar_url && <AvatarImage src={patient.avatar_url} />}
          <AvatarFallback className="text-lg">
            {patient.first_name?.[0]}
            {patient.last_name?.[0]}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">
            {patient.first_name} {patient.last_name}
          </h1>
          <p className="text-muted-foreground">
            Patient since{" "}
            {new Date(patient.created_at).toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{patient.email}</span>
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{patient.phone || "Not provided"}</span>
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {[patient.city, patient.state, patient.country]
                  .filter(Boolean)
                  .join(", ") || "Not provided"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Bookings</span>
              <span className="font-bold">{bookings?.length || 0}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reviews Written</span>
              <span className="font-bold">{reviews?.length || 0}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Spent</span>
              <span className="font-bold">
                {formatCurrency(totalSpent, "EUR")}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Language</span>
              <span className="uppercase">
                {patient.preferred_locale || "en"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Currency</span>
              <span>{patient.preferred_currency || "EUR"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Booking History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Booking History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!bookings || bookings.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No bookings yet
            </p>
          ) : (
            <div className="space-y-3">
              {bookings.map((booking: any) => (
                <Link
                  key={booking.id}
                  href={`/admin/bookings/${booking.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">
                        Dr. {booking.doctor?.profile?.first_name}{" "}
                        {booking.doctor?.profile?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {booking.booking_number} ·{" "}
                        {new Date(
                          booking.appointment_date
                        ).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {formatCurrency(
                          booking.total_amount_cents,
                          booking.currency
                        )}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusColors[booking.status] ||
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {booking.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Reviews Written
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!reviews || reviews.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No reviews written yet
            </p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review: any) => (
                <div key={review.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i <= review.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        for Dr. {review.doctor?.profile?.first_name}{" "}
                        {review.doctor?.profile?.last_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          review.is_visible ? "default" : "destructive"
                        }
                        className="text-xs"
                      >
                        {review.is_visible ? "Visible" : "Hidden"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString(
                          "en-GB"
                        )}
                      </span>
                    </div>
                  </div>
                  {review.title && (
                    <p className="mt-2 text-sm font-medium">{review.title}</p>
                  )}
                  {review.comment && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {review.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
