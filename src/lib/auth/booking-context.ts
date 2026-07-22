import { createAdminClient } from "@/lib/supabase/admin";
import { formatSpecialtyName } from "@/lib/utils";
import {
  parseBookRedirect,
  type BookRedirectContext,
} from "@/lib/chat/booking-href";

export interface BookingAuthDoctor {
  slug: string;
  name: string;
  avatarUrl: string | null;
  specialtyDisplay: string | null;
  city: string | null;
  countryCode: string | null;
  consultationFeeCents: number;
  currency: string;
  consultationTypes: string[];
  isVerified: boolean;
}

export interface BookingAuthContext {
  doctor: BookingAuthDoctor;
  book: BookRedirectContext;
}

/**
 * If `redirect` points at a doctor book page, load a slim doctor summary
 * for the login/sign-up appointment card. Returns null when not a book
 * redirect or the doctor cannot be loaded.
 */
export async function loadBookingAuthContext(
  redirectTo: string | null | undefined
): Promise<BookingAuthContext | null> {
  const book = parseBookRedirect(redirectTo);
  if (!book) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("doctors")
    .select(
      `
      slug,
      title,
      consultation_fee_cents,
      base_currency,
      consultation_types,
      verification_status,
      profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url),
      location:locations(city, country_code),
      specialties:doctor_specialties(
        is_primary,
        specialty:specialties(name_key)
      )
    `
    )
    .eq("slug", book.slug)
    .maybeSingle();

  if (!data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
  const location = Array.isArray(row.location) ? row.location[0] : row.location;
  const specialtyRows = (row.specialties || []) as Array<{
    is_primary?: boolean;
    specialty?: { name_key?: string } | null;
  }>;
  const primary =
    specialtyRows.find((s) => s.is_primary)?.specialty ||
    specialtyRows[0]?.specialty;
  const specialtyDisplay = primary?.name_key
    ? formatSpecialtyName(primary.name_key)
    : null;

  const first = profile?.first_name || "";
  const last = profile?.last_name || "";
  const title = row.title || "Dr.";
  const name = `${title} ${first} ${last}`.replace(/\s+/g, " ").trim();

  return {
    book,
    doctor: {
      slug: row.slug,
      name: name || book.slug,
      avatarUrl: profile?.avatar_url || null,
      specialtyDisplay,
      city: location?.city || null,
      countryCode: location?.country_code || null,
      consultationFeeCents: row.consultation_fee_cents ?? 0,
      currency: row.base_currency || "GBP",
      consultationTypes: row.consultation_types || [],
      isVerified: row.verification_status === "verified",
    },
  };
}
