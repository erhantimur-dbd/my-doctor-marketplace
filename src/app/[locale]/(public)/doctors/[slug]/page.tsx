import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { ClickableProfileMap } from "@/components/maps/clickable-profile-map";
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
  CalendarDays,
  Stethoscope,
  Tag,
} from "lucide-react";
import { HeroSpecialtyIcons } from "@/components/shared/hero-specialty-icons";
import { formatCurrency } from "@/lib/utils/currency";
import { formatSpecialtyName } from "@/lib/utils";
import { AvailabilityCalendar } from "@/components/booking/availability-calendar";
import { MEDICAL_TEST_GROUPS } from "@/lib/constants/medical-tests";
import { ReviewSummaryCard } from "@/components/doctors/review-summary-card";
import { BackToSearchButton } from "@/components/doctors/back-to-search-button";
import { FavoriteButton } from "@/components/doctors/favorite-button";
import { NotifyMeButton } from "@/components/doctors/notify-me-button";
import { TrackDoctorView } from "@/components/doctors/track-doctor-view";
import { PhotoGallery } from "@/components/doctors/photo-gallery";
import { generateMetadata as seoMetadata } from "@/lib/seo/metadata";
import { doctorJsonLd } from "@/lib/seo/json-ld";
import type { Metadata } from "next";

interface DoctorPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: DoctorPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const adminDb = createAdminClient();

  const { data: doctorData } = await adminDb
    .from("doctors")
    .select(
      `*, profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
       location:locations(city, country_code),
       specialties:doctor_specialties(specialty:specialties(name_key), is_primary)`
    )
    .eq("slug", slug)
    .single();

  if (!doctorData) return { title: "Doctor Not Found" };

  const doctor: any = doctorData;
  const fullName = `${doctor.title || "Dr."} ${doctor.profile.first_name} ${doctor.profile.last_name}`;
  const primarySpec = doctor.specialties?.find((s: any) => s.is_primary)?.specialty;
  const specName = primarySpec ? formatSpecialtyName(primarySpec.name_key) : undefined;
  const locationStr = doctor.location ? `${doctor.location.city}, ${doctor.location.country_code}` : "";

  const description =
    doctor.meta_description ||
    `Book an appointment with ${fullName}${specName ? `, ${specName}` : ""}${locationStr ? ` in ${locationStr}` : ""}. Verified specialist on MyDoctors360.`;

  return seoMetadata({
    title: fullName,
    description,
    path: `/${locale}/doctors/${slug}`,
    image: doctor.profile.avatar_url || undefined,
  });
}

export default async function DoctorProfilePage({ params }: DoctorPageProps) {
  const { slug, locale } = await params;
  const adminDb = createAdminClient();

  const { data: doctorData2 } = await adminDb
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
  const { data: reviews } = await adminDb
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

  // Get AI review summary (if available)
  const { data: reviewSummary } = await adminDb
    .from("doctor_review_summaries")
    .select("summary_text, sentiment_tags")
    .eq("doctor_id", doctor.id)
    .single();

  // Check if doctor has an active license (for booking eligibility)
  const { data: doctorLicense } = doctor.organization_id
    ? await adminDb
        .from("licenses")
        .select("id")
        .eq("organization_id", doctor.organization_id)
        .in("status", ["active", "trialing", "past_due"])
        .limit(1)
        .maybeSingle()
    : { data: null };

  const hasActiveSubscription = !!doctorLicense;

  // Fetch services and price book for public display
  const { data: doctorServices } = await adminDb
    .from("doctor_services")
    .select("id, name, description, price_cents, duration_minutes, consultation_type")
    .eq("doctor_id", doctor.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const { data: priceBookEntries } = await adminDb
    .from("doctor_price_book")
    .select("test_id, price_cents")
    .eq("doctor_id", doctor.id);

  const primarySpecialty =
    doctor.specialties?.find(
      (s: { is_primary: boolean }) => s.is_primary
    )?.specialty || doctor.specialties?.[0]?.specialty;
  const secondarySpecialties = doctor.specialties
    ?.filter(
      (s: { is_primary: boolean; specialty: { slug: string } }) =>
        !s.is_primary && s.specialty.slug !== primarySpecialty?.slug
    )
    .map((s: { specialty: { name_key: string; slug: string } }) => s.specialty) || [];

  const fullName = `${doctor.title || ""} ${doctor.profile.first_name} ${doctor.profile.last_name}`.trim();

  const jsonLd = doctorJsonLd({
    name: fullName,
    specialty: primarySpecialty ? formatSpecialtyName(primarySpecialty.name_key) : undefined,
    image: doctor.profile.avatar_url || undefined,
    rating: doctor.avg_rating ? Number(doctor.avg_rating) : undefined,
    reviewCount: doctor.total_reviews || undefined,
    address: doctor.location
      ? { city: doctor.location.city, country: doctor.location.country_code }
      : undefined,
    url: `${process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com"}/${locale}/doctors/${slug}`,
  });

  return (
    <div className="relative min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Decorative specialty icons across page background */}
      <HeroSpecialtyIcons />

      <TrackDoctorView
        id={doctor.id}
        slug={doctor.slug}
        name={fullName}
        specialty={primarySpecialty ? formatSpecialtyName(primarySpecialty.name_key) : ""}
        avatarUrl={doctor.profile.avatar_url || null}
        rating={Number(doctor.avg_rating) || 0}
      />

      {/* ── Blue gradient hero header ── */}
      <div className="relative bg-gradient-to-br from-primary via-primary/90 to-teal-600 dark:from-primary/80 dark:via-primary/70 dark:to-teal-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_-20%,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="relative container mx-auto px-4 pb-20 pt-6">
          <div className="flex items-center justify-between">
            <BackToSearchButton />
            <FavoriteButton doctorId={doctor.id} />
          </div>
          <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center">
            <Avatar className="h-20 w-20 shrink-0 border-[3px] border-white/30 shadow-lg sm:h-24 sm:w-24">
              {doctor.profile.avatar_url ? (
                <AvatarImage src={doctor.profile.avatar_url} alt={fullName} />
              ) : null}
              <AvatarFallback className="bg-white/20 text-white text-2xl">
                <User className="h-10 w-10" />
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-white sm:text-3xl">{fullName}</h1>
                {doctor.verification_status === "verified" && (
                  <div className="flex items-center gap-1 rounded-full bg-green-600 px-2.5 py-0.5 shadow-sm">
                    <Shield className="h-3.5 w-3.5 shrink-0 text-white" />
                    <span className="text-xs font-medium text-white">Verified</span>
                  </div>
                )}
                {doctor.is_featured && (
                  <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-xs border-0 shadow-sm">
                    ★ Featured
                  </Badge>
                )}
              </div>

              {primarySpecialty && (
                <>
                  <p className="mt-1 text-white/80 text-lg">
                    {formatSpecialtyName(primarySpecialty.name_key)}
                  </p>
                  {secondarySpecialties.length > 0 && (
                    <p className="text-sm text-white/50">
                      Also: {secondarySpecialties.map((s: { name_key: string }) => formatSpecialtyName(s.name_key)).join(", ")}
                    </p>
                  )}
                </>
              )}

              <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/70">
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
                    <Star className="h-4 w-4 fill-yellow-300 text-yellow-300" />
                    <span className="text-white/90">{Number(doctor.avg_rating).toFixed(1)}</span> (
                    {doctor.total_reviews} reviews)
                  </div>
                )}
              </div>

              {/* Consultation types */}
              <div className="mt-3 flex gap-2">
                {doctor.consultation_types?.map((type: string) => (
                  <Badge key={type} variant="outline" className="border-white/30 text-white/90 bg-white/10">
                    {type === "video" && (
                      <Video className="mr-1 h-3 w-3" />
                    )}
                    {type === "in_person" ? "In Person" : "Video Call"}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content — pulled up over the hero ── */}
      <div className="relative container mx-auto px-4 -mt-12 pb-8">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Map card (pulled up into the overlap zone) */}
          {(doctor.clinic_latitude || doctor.location?.latitude) &&
           (doctor.clinic_longitude || doctor.location?.longitude) && (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <ClickableProfileMap
                  lat={Number(doctor.clinic_latitude ?? doctor.location.latitude)}
                  lng={Number(doctor.clinic_longitude ?? doctor.location.longitude)}
                  label={doctor.clinic_name || doctor.location?.city}
                  containerClassName="w-full"
                  className="h-48 w-full"
                />
              </CardContent>
            </Card>
          )}

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

          {/* Clinic Photos */}
          {doctor.photos && (doctor.photos as unknown[]).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Clinic Photos</CardTitle>
              </CardHeader>
              <CardContent>
                <PhotoGallery photos={doctor.photos} />
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

          {/* Services & Tests */}
          {((doctorServices && doctorServices.length > 0) ||
            (priceBookEntries && priceBookEntries.length > 0)) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  Services & Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Doctor's custom services */}
                {doctorServices && doctorServices.length > 0 && (
                  <div className="space-y-2">
                    {doctorServices.map((svc: any) => (
                      <div
                        key={svc.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {svc.name}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="mr-1 h-3 w-3" />
                              {svc.duration_minutes} min
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {svc.consultation_type === "both"
                                ? "In-Person & Video"
                                : svc.consultation_type === "video"
                                  ? "Video"
                                  : "In-Person"}
                            </Badge>
                          </div>
                          {svc.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {svc.description}
                            </p>
                          )}
                        </div>
                        <span className="text-sm font-semibold shrink-0 ml-4">
                          {formatCurrency(
                            svc.price_cents,
                            doctor.base_currency,
                            locale
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Price book tests */}
                {priceBookEntries && priceBookEntries.length > 0 && (
                  <>
                    {doctorServices && doctorServices.length > 0 && (
                      <Separator />
                    )}
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Tests & Diagnostics
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {priceBookEntries.map((entry: any) => {
                        const testName =
                          MEDICAL_TEST_GROUPS.flatMap((g) => g.tests).find(
                            (t) => t.id === entry.test_id
                          )?.name ?? entry.test_id;
                        return (
                          <div
                            key={entry.test_id}
                            className="flex items-center justify-between rounded-lg border px-3 py-2"
                          >
                            <span className="text-sm truncate mr-2">
                              {testName}
                            </span>
                            <span className="text-sm font-semibold shrink-0">
                              {formatCurrency(
                                entry.price_cents,
                                doctor.base_currency,
                                locale
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Multi-buy discount hint */}
                {((doctorServices && doctorServices.length > 1) ||
                  (priceBookEntries && priceBookEntries.length > 1)) && (
                  <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 dark:bg-green-950/30">
                    <Tag className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    <p className="text-xs text-green-700 dark:text-green-400">
                      Multi-service discounts may be available when booking
                      multiple tests or follow-up sessions. Ask your doctor for
                      details.
                    </p>
                  </div>
                )}

                {hasActiveSubscription && (
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/doctors/${doctor.slug}/book`}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      Book a Service
                    </Link>
                  </Button>
                )}
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
              {/* AI Review Summary */}
              {reviewSummary && doctor.total_reviews >= 3 && (
                <div className="mb-4">
                  <ReviewSummaryCard
                    summary={reviewSummary.summary_text}
                    sentimentTags={reviewSummary.sentiment_tags || []}
                    reviewSummaryTitle="What patients say"
                    poweredByAi="AI-generated summary"
                  />
                </div>
              )}

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
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto space-y-4">
            {/* Availability Calendar */}
            <Card>
              <CardHeader className="pb-1.5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4" />
                  Availability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AvailabilityCalendar
                  doctorId={doctor.id}
                  doctorSlug={doctor.slug}
                  consultationType="in_person"
                  consultationTypes={doctor.consultation_types}
                  locale={locale}
                />
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

                {doctor.in_person_deposit_type && doctor.in_person_deposit_type !== "none" &&
                  doctor.consultation_types?.includes("in_person") && (
                    <p className="mt-2 text-center text-xs text-amber-700 dark:text-amber-400">
                      Deposit required at booking for in-person visits
                    </p>
                  )}

                <Separator className="my-4" />

                {hasActiveSubscription ? (
                  <>
                    <Button className="w-full" size="lg" asChild>
                      <Link href={`/doctors/${doctor.slug}/book`}>
                        <CalendarDays className="mr-2 h-4 w-4" />
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

                    <div className="mt-3">
                      <NotifyMeButton doctorId={doctor.id} />
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-center text-sm text-muted-foreground">
                      This doctor is not currently accepting online bookings.
                    </p>
                    <NotifyMeButton doctorId={doctor.id} />
                  </div>
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
    </div>
  );
}

export const revalidate = 3600;
