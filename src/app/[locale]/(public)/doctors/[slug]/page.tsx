import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ProfileMapWrapper } from "@/components/maps/profile-map-wrapper";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import {
  Star,
  MapPin,
  Shield,
  Video,
  Clock,
  GraduationCap,
  Award,
  Globe,
  User,
  Calendar,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDateLabel, formatSlotTime } from "@/lib/utils/availability";
import { getNextAvailabilityBatch } from "@/actions/search";
import type { Metadata } from "next";

interface DoctorPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: DoctorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: doctorData } = await supabase
    .from("doctors")
    .select("*, profile:profiles!doctors_profile_id_fkey(first_name, last_name)")
    .eq("slug", slug)
    .single();

  if (!doctorData) return { title: "Doctor Not Found" };

  const doctor: any = doctorData;
  return {
    title: `${doctor.title || "Dr."} ${doctor.profile.first_name} ${doctor.profile.last_name}`,
    description:
      doctor.meta_description ||
      `Book an appointment with ${doctor.title || "Dr."} ${doctor.profile.first_name} ${doctor.profile.last_name}`,
  };
}

export default async function DoctorProfilePage({ params }: DoctorPageProps) {
  const { slug, locale } = await params;
  const supabase = await createClient();

  const { data: doctorData2 } = await supabase
    .from("doctors")
    .select(
      `
      *,
      profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
      location:locations(city, country_code, slug, timezone, latitude, longitude),
      specialties:doctor_specialties(
        specialty:specialties(id, name_key, slug),
        is_primary
      ),
      photos:doctor_photos(id, storage_path, alt_text, is_primary)
    `
    )
    .eq("slug", slug)
    .single();

  if (!doctorData2) notFound();

  const doctor: any = doctorData2;

  // Get reviews
  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      `
      *,
      patient:profiles!reviews_patient_id_fkey(first_name, last_name)
    `
    )
    .eq("doctor_id", doctor.id)
    .eq("is_visible", true)
    .order("created_at", { ascending: false })
    .limit(5);

  // Fetch next availability (reuses the batch RPC with a single-element array)
  const availabilityMap = await getNextAvailabilityBatch([doctor.id]);
  const availability = availabilityMap[doctor.id] || null;

  // Check if doctor has an active subscription (for booking eligibility)
  const { data: doctorSubscription } = await supabase
    .from("doctor_subscriptions")
    .select("id")
    .eq("doctor_id", doctor.id)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();

  const hasActiveSubscription = !!doctorSubscription;

  const primarySpecialty =
    doctor.specialties?.find(
      (s: { is_primary: boolean }) => s.is_primary
    )?.specialty || doctor.specialties?.[0]?.specialty;

  const fullName = `${doctor.title || ""} ${doctor.profile.first_name} ${doctor.profile.last_name}`.trim();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Profile header */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-6 sm:flex-row">
                <Avatar className="h-24 w-24 shrink-0">
                  {doctor.profile.avatar_url ? (
                    <AvatarImage src={doctor.profile.avatar_url} alt={fullName} />
                  ) : null}
                  <AvatarFallback className="text-2xl">
                    <User className="h-10 w-10" />
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <h1 className="text-2xl font-bold">{fullName}</h1>
                    {doctor.verification_status === "verified" && (
                      <Badge
                        variant="secondary"
                        className="gap-1 bg-green-50 text-green-700"
                      >
                        <Shield className="h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                    {doctor.is_featured && (
                      <Badge variant="secondary">Featured</Badge>
                    )}
                  </div>

                  {primarySpecialty && (
                    <p className="mt-1 text-muted-foreground">
                      {primarySpecialty.name_key
                        .replace("specialty.", "")
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {doctor.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {doctor.location.city}, {doctor.location.country_code}
                      </div>
                    )}
                    {doctor.years_of_experience && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {doctor.years_of_experience} years experience
                      </div>
                    )}
                    {doctor.avg_rating > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        {Number(doctor.avg_rating).toFixed(1)} (
                        {doctor.total_reviews} reviews)
                      </div>
                    )}
                  </div>

                  {/* Consultation types */}
                  <div className="mt-3 flex gap-2">
                    {doctor.consultation_types?.map((type: string) => (
                      <Badge key={type} variant="outline">
                        {type === "video" && (
                          <Video className="mr-1 h-3 w-3" />
                        )}
                        {type === "in_person" ? "In Person" : "Video Call"}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          {doctor.bio && (
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {doctor.bio}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Education */}
          {doctor.education && (doctor.education as unknown[]).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Education
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {(
                    doctor.education as {
                      degree: string;
                      institution: string;
                      year: number;
                    }[]
                  ).map(
                    (
                      edu: { degree: string; institution: string; year: number },
                      i: number
                    ) => (
                      <li key={i}>
                        <p className="font-medium">{edu.degree}</p>
                        <p className="text-sm text-muted-foreground">
                          {edu.institution} &middot; {edu.year}
                        </p>
                      </li>
                    )
                  )}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Certifications */}
          {doctor.certifications &&
            (doctor.certifications as unknown[]).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Certifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {(
                      doctor.certifications as {
                        name: string;
                        issuer: string;
                        year: number;
                      }[]
                    ).map(
                      (
                        cert: {
                          name: string;
                          issuer: string;
                          year: number;
                        },
                        i: number
                      ) => (
                        <li key={i}>
                          <p className="font-medium">{cert.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {cert.issuer} &middot; {cert.year}
                          </p>
                        </li>
                      )
                    )}
                  </ul>
                </CardContent>
              </Card>
            )}

          {/* Languages */}
          {doctor.languages && doctor.languages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Languages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {doctor.languages.map((lang: string) => (
                    <Badge key={lang} variant="outline">
                      {lang.toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reviews */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Reviews ({doctor.total_reviews})
              </CardTitle>
              {doctor.total_reviews > 5 && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/doctors/${doctor.slug}/reviews`}>
                    View All
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {(!reviews || reviews.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No reviews yet
                </p>
              )}
              {reviews && reviews.length > 0 && (
                <div className="space-y-4">
                  {reviews.map(
                    (review: any) => (
                      <div key={review.id}>
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < review.rating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-muted"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-medium">
                            {review.patient.first_name}{" "}
                            {review.patient.last_name.charAt(0)}.
                          </span>
                        </div>
                        {review.title && (
                          <p className="mt-1 font-medium">{review.title}</p>
                        )}
                        {review.comment && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {review.comment}
                          </p>
                        )}
                        {review.doctor_response && (
                          <div className="mt-2 rounded-md bg-muted/50 p-3">
                            <p className="text-xs font-medium">
                              Doctor&apos;s Response
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {review.doctor_response}
                            </p>
                          </div>
                        )}
                        <Separator className="mt-4" />
                      </div>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Booking CTA */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            {/* Location map — prefer clinic-level coords, fall back to city */}
            {(doctor.clinic_latitude || doctor.location?.latitude) &&
             (doctor.clinic_longitude || doctor.location?.longitude) && (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <ProfileMapWrapper
                    lat={Number(doctor.clinic_latitude ?? doctor.location.latitude)}
                    lng={Number(doctor.clinic_longitude ?? doctor.location.longitude)}
                    label={doctor.clinic_name || doctor.location?.city}
                  />
                  <div className="p-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {doctor.clinic_name || doctor.location.city}
                      </span>
                    </div>
                    <p className="mt-0.5 pl-5.5 text-sm text-muted-foreground">
                      {doctor.location.city}, {doctor.location.country_code}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Next Availability */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4" />
                  Next Available
                </CardTitle>
              </CardHeader>
              <CardContent>
                {availability && availability.slots.length > 0 ? (
                  <div>
                    <p className="mb-2 text-sm font-medium text-green-700">
                      {formatDateLabel(availability.date)}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {availability.slots.slice(0, 4).map((slot: { start: string; end: string }) => (
                        <Link
                          key={slot.start}
                          href={`/doctors/${doctor.slug}/book?date=${availability.date}&type=${availability.consultationType || "in_person"}`}
                          className="inline-flex items-center rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                        >
                          {formatSlotTime(slot.start)}
                        </Link>
                      ))}
                      {availability.slots.length > 4 && (
                        <span className="inline-flex items-center px-1 py-1.5 text-xs text-muted-foreground">
                          +{availability.slots.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No availability in next 14 days
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Consultation Fee
                  </p>
                  <p className="text-3xl font-bold">
                    {formatCurrency(
                      doctor.consultation_fee_cents,
                      doctor.base_currency,
                      locale
                    )}
                  </p>
                </div>

                {doctor.video_consultation_fee_cents &&
                  doctor.video_consultation_fee_cents !==
                    doctor.consultation_fee_cents && (
                    <div className="mt-2 text-center">
                      <p className="text-sm text-muted-foreground">
                        Video Consultation
                      </p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(
                          doctor.video_consultation_fee_cents,
                          doctor.base_currency,
                          locale
                        )}
                      </p>
                    </div>
                  )}

                <Separator className="my-4" />

                {hasActiveSubscription ? (
                  <>
                    <Button className="w-full" size="lg" asChild>
                      <Link href={`/doctors/${doctor.slug}/book`}>
                        <Calendar className="mr-2 h-4 w-4" />
                        Book Appointment
                      </Link>
                    </Button>

                    <p className="mt-3 text-center text-xs text-muted-foreground">
                      {doctor.cancellation_policy === "flexible"
                        ? "Free cancellation up to 2 hours before"
                        : doctor.cancellation_policy === "moderate"
                          ? "Free cancellation up to 24 hours before"
                          : "Free cancellation up to 48 hours before"}
                    </p>
                  </>
                ) : (
                  <p className="text-center text-sm text-muted-foreground">
                    This doctor is not currently accepting online bookings.
                  </p>
                )}

                {/* Clinic info */}
                {(doctor.clinic_name || doctor.location) && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-2 text-sm">
                      {doctor.clinic_name && (
                        <p className="font-medium">{doctor.clinic_name}</p>
                      )}
                      {doctor.location && (
                        <p className="text-muted-foreground">
                          {doctor.location.city}, {doctor.location.country_code}
                        </p>
                      )}
                      <p className="text-xs italic text-muted-foreground">
                        Exact address provided upon booking
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export const revalidate = 3600;
