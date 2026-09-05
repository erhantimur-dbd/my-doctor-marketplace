import {
  getMedicalSpecialties,
  getTestingSpecialties,
} from "@/lib/constants/specialties";
import { formatSpecialtyName } from "@/lib/utils";

export interface SpecialtyInviteCopy {
  headline: string;
  subhead: string;
  /** Practitioner benefits — always 5 items */
  usps: readonly string[];
  /** Optional line distinguishing solo vs multi-clinician signup */
  clinicVsSolo?: string;
}

function templateUsps(specialty: string): readonly string[] {
  return [
    `Built for ${specialty} private practice — booking, calendar, video, payments for independent ${specialty} clinicians.`,
    "Founding Free — claim a founding seat, build your profile before patient launch (no card).",
    "Verified profile path — list with credentials patients can trust when discovery opens.",
    `Specialty-ready listing — fees, consult types, and availability suited to ${specialty} (not a generic GP-only form).`,
    "You stay clinically independent — MD360 is booking/video/payments software, not CQC / not care delivery.",
  ];
}

function templateInvite(slug: string): SpecialtyInviteCopy {
  const specialty = formatSpecialtyName(
    slug === "ent" ? "specialty.ent" : `specialty.${slug.replace(/-/g, "_")}`
  );
  const label = specialty === "ENT" ? "ENT" : specialty.toLowerCase();
  return {
    headline: `Invite your ${label} practice to MyDoctors360`,
    subhead: `Founding tools for independent ${label} clinicians — booking, calendar, video, and payments. Build your profile before patient discovery opens.`,
    usps: templateUsps(label),
  };
}

/**
 * Founding-doctor invite landing copy, keyed by medical specialty slug.
 * English v1 — marketplace + practice-tool framing only (no clinical-care claims).
 * Six specialties use Parker’s locked USP packs; remaining medical slugs use the 5-bullet template.
 */
export const SPECIALTY_INVITES: Record<string, SpecialtyInviteCopy> = {
  dentistry: {
    headline: "Invite your dental practice to MyDoctors360",
    subhead:
      "Founding tools for independent dentists — booking, calendar, video, and payments. Build your clinic profile before patient discovery opens.",
    usps: [
      "Built for private dental practice — online booking, calendar, video consults, and payments for independent dentists.",
      "Founding Free — claim a founding seat and build your clinic profile before patient discovery opens (no card).",
      "Verified listing path — credentials and practice details patients can trust when the marketplace lifts.",
      "Dental-ready profile — fees, consult types, and availability for exams, treatments, and follow-ups (not a GP-only form).",
      "You stay clinically independent — MD360 is booking, video and payments software, not CQC and not care delivery.",
    ],
  },
  cardiology: {
    headline: "Invite your cardiology practice to MyDoctors360",
    subhead:
      "Founding tools for independent cardiologists — booking, calendar, video, and payments. Prepare your profile ahead of patient launch.",
    usps: [
      "Built for private cardiology — booking, calendar, video, and payments for independent cardiologists.",
      "Founding Free — claim a founding seat and prepare your profile ahead of patient launch (no card).",
      "Verified listing path — specialist credentials visible when discovery opens.",
      "Cardiology-ready profile — consult fees, follow-up types, and availability suited to specialty clinics.",
      "You stay clinically independent — marketplace tools only; MD360 does not provide or manage clinical care.",
    ],
  },
  "general-practice": {
    headline: "Invite your GP practice to MyDoctors360",
    subhead:
      "Founding tools for independent private GPs — booking, calendar, video, and payments. Claim a founding seat and build your profile (no card).",
    usps: [
      "Built for independent private GPs — booking, calendar, video, and payments without a clinic chain.",
      "Founding Free — first-100 founding seat, free profile build, no card required.",
      "Verified listing path — patients find a checked profile when the patient side opens.",
      "GP-ready profile — appointments, fees, and availability for private primary care consults.",
      "You stay clinically independent — MD360 is software for booking/video/payments, not a care provider and not CQC-registered.",
    ],
  },
  dermatology: {
    headline: "Invite your dermatology practice to MyDoctors360",
    subhead:
      "Founding tools for independent dermatologists — booking, calendar, video, and payments. Build your specialty profile before launch.",
    usps: [
      "Built for private dermatology — booking, calendar, video, and payments for independent dermatologists.",
      "Founding Free — claim a founding seat and build your specialty profile before launch (no card).",
      "Verified listing path — specialist credentials ready for discovery day one.",
      "Dermatology-ready profile — consult types, fees, and availability for clinic and video follow-ups.",
      "You stay clinically independent — marketplace tools only; no CQC / no care delivery by MD360.",
    ],
  },
  psychiatry: {
    headline: "Invite your psychiatry practice to MyDoctors360",
    subhead:
      "Founding tools for independent psychiatrists — booking, calendar, video sessions, and payments. Prepare your profile before patient discovery.",
    usps: [
      "Built for private mental-health practice — booking, calendar, video sessions, and payments for independent clinicians.",
      "Founding Free — claim a founding seat and prepare your profile before patient discovery (no card).",
      "Verified listing path — credentials patients can trust when listings go live.",
      "Specialty-ready profile — session types, fees, and availability for video and in-clinic appointments.",
      "You stay clinically independent — MD360 provides booking/video/payments software only, not clinical care and not CQC.",
    ],
  },
  psychology: {
    headline: "Invite your psychology practice to MyDoctors360",
    subhead:
      "Founding tools for independent psychologists — booking, calendar, video sessions, and payments. Prepare your profile before patient discovery.",
    usps: [
      "Built for private mental-health practice — booking, calendar, video sessions, and payments for independent clinicians.",
      "Founding Free — claim a founding seat and prepare your profile before patient discovery (no card).",
      "Verified listing path — credentials patients can trust when listings go live.",
      "Specialty-ready profile — session types, fees, and availability for video and in-clinic appointments.",
      "You stay clinically independent — MD360 provides booking/video/payments software only, not clinical care and not CQC.",
    ],
  },
};

for (const spec of getMedicalSpecialties()) {
  if (!SPECIALTY_INVITES[spec.slug]) {
    SPECIALTY_INVITES[spec.slug] = templateInvite(spec.slug);
  }
}

export { isClinicInviteToken } from "@/lib/clinic-invite-token";

export function isTestingSpecialtySlug(slug: string): boolean {
  return getTestingSpecialties().some((s) => s.slug === slug);
}

export function isMedicalInviteSlug(slug: string): boolean {
  return getMedicalSpecialties().some((s) => s.slug === slug);
}

/** Medical specialty invite copy. Testing slugs and unknown slugs return undefined. */
export function getSpecialtyInvite(slug: string): SpecialtyInviteCopy | undefined {
  if (!isMedicalInviteSlug(slug)) return undefined;
  return SPECIALTY_INVITES[slug] ?? templateInvite(slug);
}

export function getSpecialtyInviteSlugs(): readonly string[] {
  return getMedicalSpecialties().map((s) => s.slug);
}

export function foundingRegisterHref(specialtySlug: string): string {
  const params = new URLSearchParams({
    tier: "free",
    founding: "1",
    specialty: specialtySlug,
  });
  return `/register-doctor?${params.toString()}`;
}
