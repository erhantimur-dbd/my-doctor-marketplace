import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { getDependents } from "@/actions/family";
import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import { NotifyMeButton } from "@/components/doctors/notify-me-button";
import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

interface BookPageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata({
  params,
}: BookPageProps): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("booking");
  const adminDb = createAdminClient();

  const { data: doctorData } = await adminDb
    .from("doctors")
    .select("*, profile:profiles!doctors_profile_id_fkey(first_name, last_name)")
    .eq("slug", slug)
    .single();

  if (!doctorData) return { title: t("book_appointment") };

  const doctor: any = doctorData;
  const fullName = `${doctor.title || "Dr."} ${doctor.profile.first_name} ${doctor.profile.last_name}`.trim();

  return {
    title: t("meta_book_title", { name: fullName }),
    description: t("meta_book_description", { name: fullName }),
  };
}

export default async function BookAppointmentPage({ params }: BookPageProps) {
  const { slug, locale } = await params;
  const t = await getTranslations("booking");
  const supabase = await createClient();

  // Progressive checkout: allow unauthenticated guests (wizard collects contact)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Use admin client for doctor data queries (RLS on doctors table blocks user-session reads)
  const adminDb = createAdminClient();

  // Fetch doctor with all needed relations
  const { data: doctorData2 } = await adminDb
    .from("doctors")
    .select(
      `
      id,
      slug,
      title,
      consultation_fee_cents,
      video_consultation_fee_cents,
      base_currency,
      consultation_types,
      cancellation_policy,
      clinic_name,
      address,
      is_active,
      verification_status,
      in_person_deposit_type,
      in_person_deposit_value,
      stripe_account_id,
      stripe_onboarding_complete,
      profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
      location:locations(city, country_code, timezone),
      specialties:doctor_specialties(
        specialty:specialties(id, name_key, slug),
        is_primary
      )
    `
    )
    .eq("slug", slug)
    .single();

  if (!doctorData2) {
    redirect(`/${locale}/doctors`);
  }

  const doctor: any = doctorData2;

  // Check if doctor is eligible for bookings
  if (doctor.verification_status !== "verified" || !doctor.is_active) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-bold">{t("booking_unavailable_title")}</h1>
          <p className="text-muted-foreground">
            {t("booking_unavailable_body")}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            {user && (
              <NotifyMeButton doctorId={doctor.id} />
            )}
            <Button variant="outline" asChild className="w-full">
              <Link href={`/doctors/${doctor.slug}`}>{t("view_profile")}</Link>
            </Button>
            <Button asChild className="w-full">
              <Link href="/doctors">{t("browse_doctors")}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Fetch services for this doctor (for reason-for-visit)
  const { data: servicesData } = await adminDb
    .from("doctor_services")
    .select("id, name, price_cents, duration_minutes, consultation_type, deposit_type, deposit_value")
    .eq("doctor_id", doctor.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  // Fetch patient's family dependents for "booking for" selection
  // Guests (unauthenticated) skip dependents — progressive checkout
  const dependents = user ? await getDependents() : [];

  if (!doctor.stripe_account_id || !doctor.stripe_onboarding_complete) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-bold">{t("payment_pending_title")}</h1>
          <p className="text-muted-foreground">
            {t("payment_pending_body")}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            {user && <NotifyMeButton doctorId={doctor.id} />}
            <Button variant="outline" asChild className="w-full">
              <Link href={`/doctors/${doctor.slug}`}>{t("view_profile")}</Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/contact">{t("contact_support")}</Link>
            </Button>
            <Button asChild className="w-full">
              <Link href="/doctors">{t("browse_doctors")}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const fullName = `${doctor.title || "Dr."} ${doctor.profile.first_name} ${doctor.profile.last_name}`.trim();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/doctors" className="hover:text-foreground">
          {t("doctors_nav")}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/doctors/${doctor.slug}`} className="hover:text-foreground">
          {fullName}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{t("book_nav")}</span>
      </nav>

      {/* Page Title */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">{t("book_appointment")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t("schedule_with", { name: fullName })}
        </p>
      </div>

      {/* Booking Wizard — guests pass isGuest for progressive checkout */}
      <BookingWizard
        doctor={doctor}
        services={servicesData || []}
        dependents={dependents}
        isGuest={!user}
        locale={locale}
      />
    </div>
  );
}
