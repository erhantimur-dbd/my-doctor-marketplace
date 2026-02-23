import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";

interface BookPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: BookPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: doctorData } = await supabase
    .from("doctors")
    .select("*, profile:profiles!doctors_profile_id_fkey(first_name, last_name)")
    .eq("slug", slug)
    .single();

  if (!doctorData) return { title: "Book Appointment" };

  const doctor: any = doctorData;
  const fullName = `${doctor.title || "Dr."} ${doctor.profile.first_name} ${doctor.profile.last_name}`.trim();

  return {
    title: `Book Appointment - ${fullName}`,
    description: `Book an appointment with ${fullName}. Choose your preferred consultation type, date, and time.`,
  };
}

export default async function BookAppointmentPage({ params }: BookPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/en/login?redirect=/en/doctors/${slug}/book`);
  }

  // Fetch doctor with all needed relations
  const { data: doctorData2 } = await supabase
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
    redirect("/en/doctors");
  }

  const doctor: any = doctorData2;

  // Check if doctor is eligible for bookings
  if (doctor.verification_status !== "verified" || !doctor.is_active) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-2xl font-bold">Booking Unavailable</h1>
          <p className="mt-4 text-muted-foreground">
            This doctor is not currently accepting appointments. Please check
            back later or browse other doctors.
          </p>
          <Link
            href="/doctors"
            className="mt-6 inline-flex items-center text-primary hover:underline"
          >
            Browse Doctors
          </Link>
        </div>
      </div>
    );
  }

  if (!doctor.stripe_account_id || !doctor.stripe_onboarding_complete) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-2xl font-bold">Payment Setup Pending</h1>
          <p className="mt-4 text-muted-foreground">
            This doctor has not yet completed their payment setup. Please check
            back later or browse other doctors.
          </p>
          <Link
            href="/doctors"
            className="mt-6 inline-flex items-center text-primary hover:underline"
          >
            Browse Doctors
          </Link>
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
          Doctors
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/doctors/${doctor.slug}`} className="hover:text-foreground">
          {fullName}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Book Appointment</span>
      </nav>

      {/* Page Title */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Book an Appointment</h1>
        <p className="mt-2 text-muted-foreground">
          Schedule a consultation with {fullName}
        </p>
      </div>

      {/* Booking Wizard */}
      <BookingWizard doctor={doctor} />
    </div>
  );
}
