import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft, Eye, Calendar, Clock, CreditCard, Star,
  Users, BarChart3, MapPin, Video, Building2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

export default async function ImpersonateDoctorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (adminProfile?.role !== "admin") redirect("/en");

  const adminClient = createAdminClient();

  // Fetch doctor data
  const { data: doctor } = await adminClient
    .from("doctors")
    .select(
      `*, profile:profiles!doctors_profile_id_fkey(first_name, last_name, email, phone, avatar_url),
       location:locations(city, country_code),
       specialties:doctor_specialties(specialty:specialties(name_key), is_primary)`
    )
    .eq("id", id)
    .single();

  if (!doctor) redirect("/en/admin/doctors");

  const profile: any = Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile;
  const location: any = Array.isArray(doctor.location) ? doctor.location[0] : doctor.location;

  // Fetch doctor's bookings (recent 20)
  const { data: bookings } = await adminClient
    .from("bookings")
    .select(
      `id, booking_number, appointment_date, start_time, status, consultation_type,
       total_amount_cents, platform_fee_cents, currency,
       patient:profiles!bookings_patient_id_fkey(first_name, last_name)`
    )
    .eq("doctor_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch doctor's reviews
  const { data: reviews } = await adminClient
    .from("reviews")
    .select("id, rating, title, comment, created_at, patient:profiles!reviews_patient_id_fkey(first_name)")
    .eq("doctor_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Stats
  const { count: totalBookings } = await adminClient
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("doctor_id", id)
    .in("status", ["confirmed", "approved", "completed"]);

  const { data: revenueData } = await adminClient
    .from("bookings")
    .select("total_amount_cents, platform_fee_cents, currency")
    .eq("doctor_id", id)
    .in("status", ["confirmed", "approved", "completed"]);

  const totalRevenue = (revenueData || []).reduce(
    (sum, b: any) => sum + (b.total_amount_cents - b.platform_fee_cents), 0
  );
  const currency = (revenueData?.[0] as any)?.currency || "EUR";

  // Log impersonation in audit
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "impersonate_view_doctor",
    target_type: "doctor",
    target_id: id,
    metadata: { doctor_email: profile?.email },
  });

  const statusColors: Record<string, string> = {
    pending_payment: "bg-gray-100 text-gray-700",
    confirmed: "bg-blue-100 text-blue-700",
    approved: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    cancelled_patient: "bg-red-100 text-red-700",
    cancelled_doctor: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      {/* Header with impersonation warning */}
      <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-800">
              Admin View — Dr. {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-sm text-amber-600">
              Read-only view of this doctor&apos;s dashboard. All views are logged in the audit trail.
            </p>
          </div>
        </div>
      </div>

      <Link
        href={`/admin/doctors/${id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Doctor Detail
      </Link>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
              <p className="text-2xl font-bold">{totalBookings || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <CreditCard className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Doctor Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(totalRevenue, currency)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-yellow-50 p-3">
              <Star className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Rating</p>
              <p className="text-2xl font-bold">{doctor.avg_rating?.toFixed(1) || "—"}</p>
              <p className="text-xs text-muted-foreground">{doctor.total_reviews || 0} reviews</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-purple-50 p-3">
              <MapPin className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="text-lg font-bold">{location?.city || "N/A"}</p>
              <p className="text-xs text-muted-foreground">{location?.country_code || ""}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profile Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{profile?.email}</span></div>
          <Separator />
          <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{profile?.phone || "N/A"}</span></div>
          <Separator />
          <div className="flex justify-between"><span className="text-muted-foreground">Consultation Fee</span><span>{formatCurrency(doctor.consultation_fee_cents, doctor.base_currency)}</span></div>
          <Separator />
          <div className="flex justify-between"><span className="text-muted-foreground">Types</span>
            <div className="flex gap-1">{(doctor.consultation_types || []).map((t: string) => (
              <Badge key={t} variant="outline" className="text-xs">{t === "video" ? "Video" : "In Person"}</Badge>
            ))}</div>
          </div>
          <Separator />
          <div className="flex justify-between"><span className="text-muted-foreground">Stripe</span>
            <Badge variant={doctor.stripe_onboarding_complete ? "default" : "destructive"} className="text-xs">
              {doctor.stripe_onboarding_complete ? "Connected" : "Not Connected"}
            </Badge>
          </div>
          <Separator />
          <div className="flex justify-between"><span className="text-muted-foreground">Cancel Policy</span>
            <span className="capitalize">{doctor.cancellation_policy || "flexible"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Recent Bookings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Bookings ({(bookings || []).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(bookings || []).length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No bookings yet</p>
          ) : (
            <div className="space-y-2">
              {(bookings || []).map((b: any) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[b.status] || "bg-gray-100 text-gray-700"}`}>
                      {b.status.replace(/_/g, " ")}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{b.patient?.first_name} {b.patient?.last_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(b.appointment_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} at {b.start_time?.slice(0, 5)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatCurrency(b.total_amount_cents - b.platform_fee_cents, b.currency)}</p>
                    <Badge variant="outline" className="text-xs">
                      {b.consultation_type === "video" ? "Video" : "In Person"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Recent Reviews ({(reviews || []).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(reviews || []).length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No reviews yet</p>
          ) : (
            <div className="space-y-3">
              {(reviews || []).map((r: any) => (
                <div key={r.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  {r.title && <p className="mt-1 text-sm font-medium">{r.title}</p>}
                  {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">— {r.patient?.first_name || "Anonymous"}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
