import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import {
  CheckCircle,
  XCircle,
  ArrowLeft,
  Star,
  Calendar,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { AdminDoctorActions } from "./actions-client";

export default async function AdminDoctorDetailPage({
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

  const { data: doctorData } = await supabase
    .from("doctors")
    .select(
      `*, profile:profiles!doctors_profile_id_fkey(first_name, last_name, email, phone, created_at),
       location:locations(city, country_code),
       specialties:doctor_specialties(specialty:specialties(name_key, slug), is_primary)`
    )
    .eq("id", id)
    .single();

  if (!doctorData) redirect("/en/admin/doctors");

  const doctor: any = doctorData;

  const { count: bookingCount } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("doctor_id", id);

  const { count: reviewCount } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .eq("doctor_id", id);

  const { data: subscription } = await supabase
    .from("doctor_subscriptions")
    .select("plan_id, status, current_period_end, cancel_at_period_end")
    .eq("doctor_id", id)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentPlan = (subscription as any)?.plan_id || "free";

  return (
    <div className="space-y-6">
      <Link
        href="/admin/doctors"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Doctors
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {doctor.title || "Dr."} {doctor.profile.first_name}{" "}
            {doctor.profile.last_name}
          </h1>
          <p className="text-muted-foreground">{doctor.profile.email}</p>
        </div>
        <Badge
          variant={
            doctor.verification_status === "verified"
              ? "default"
              : doctor.verification_status === "pending"
                ? "secondary"
                : "destructive"
          }
        >
          {doctor.verification_status}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Doctor Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slug</span>
              <span className="font-mono text-sm">{doctor.slug}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{doctor.profile.phone || "Not provided"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {doctor.location
                  ? `${doctor.location.city}, ${doctor.location.country_code}`
                  : "Not set"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Experience</span>
              <span>
                {doctor.years_of_experience
                  ? `${doctor.years_of_experience} years`
                  : "Not set"}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Languages</span>
              <span>{doctor.languages?.join(", ") || "Not set"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Registered</span>
              <span>
                {new Date(doctor.profile.created_at).toLocaleDateString()}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subscription</span>
              <span className="flex items-center gap-2">
                {currentPlan === "free" ? (
                  <Badge variant="outline">Free</Badge>
                ) : currentPlan === "professional" ? (
                  <Badge className="bg-blue-600">Professional</Badge>
                ) : (
                  <Badge variant="secondary" className="capitalize">{currentPlan}</Badge>
                )}
                {(subscription as any)?.status && (
                  <span className="text-xs text-muted-foreground">
                    ({(subscription as any).status})
                  </span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rating</span>
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500" />
                {Number(doctor.avg_rating).toFixed(1)} ({doctor.total_reviews}{" "}
                reviews)
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Bookings</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {bookingCount || 0}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Reviews</span>
              <span>{reviewCount || 0}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active</span>
              <span>
                {doctor.is_active ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Featured</span>
              <span>
                {doctor.is_featured ? (
                  <Badge variant="secondary">Yes</Badge>
                ) : (
                  "No"
                )}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stripe Connected</span>
              <span>
                {doctor.stripe_onboarding_complete ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminDoctorActions
            doctorId={doctor.id}
            currentStatus={doctor.verification_status}
            isActive={doctor.is_active}
            isFeatured={doctor.is_featured}
            currentPlan={currentPlan}
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Link href={`/doctors/${doctor.slug}`}>
          <span className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ExternalLink className="h-4 w-4" /> View Public Profile
          </span>
        </Link>
      </div>
    </div>
  );
}
