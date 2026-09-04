import {
  getMedicalSpecialties,
  getSpecialtyMeta,
  getTestingSpecialties,
} from "@/lib/constants/specialties";
import { formatSpecialtyName } from "@/lib/utils";

export interface SpecialtyInviteCopy {
  headline: string;
  subhead: string;
  /** Practitioner benefits — 3 to 5 items */
  usps: readonly string[];
  /** Optional line distinguishing solo vs multi-seat clinic signup */
  clinicVsSolo?: string;
}

/**
 * Founding-doctor invite landing copy, keyed by medical specialty slug.
 * English v1 — marketplace + practice-tool framing only (no clinical-care claims).
 */
export const SPECIALTY_INVITES: Record<string, SpecialtyInviteCopy> = {
  "general-practice": {
    headline: "Invite your GP practice to MyDoctors360",
    subhead:
      "Independent GPs list a founding profile so private patients can find you, book check-ups and consultations, and pay you directly.",
    usps: [
      "Private patients searching for a GP can discover your practice and book routine check-ups, screenings, and consultations online.",
      "Publish fees and availability for in-person and video appointments on your own profile.",
      "Collect payments securely when you upgrade to accept online bookings.",
      "Founding Free profile stays free forever — first 100 doctors keep founding perks.",
    ],
    clinicVsSolo:
      "Solo GPs start on Founding Free. Multi-GP practices can add seats on the Clinic plan when you are ready.",
  },
  cardiology: {
    headline: "Invite your cardiology practice to MyDoctors360",
    subhead:
      "Independent cardiologists get a founding profile, online booking, and practice tools — patients find you; you deliver the care.",
    usps: [
      "Patients looking for private heart specialists can find your profile and book consultations for blood pressure, cholesterol, and follow-up.",
      "Show your consultation types, fees, and real-time availability.",
      "Take payments through the platform when you unlock online bookings.",
      "Founding Free is free forever, with first-100 founding perks.",
    ],
    clinicVsSolo:
      "Works for solo consultants and multi-clinician cardiology groups on Clinic seats.",
  },
  dermatology: {
    headline: "Invite your dermatology practice to MyDoctors360",
    subhead:
      "Independent dermatologists list a profile so private patients can book mole checks, acne reviews, and skin consultations with you.",
    usps: [
      "Patients searching for private dermatology can discover you and book online for common skin, hair, and nail concerns.",
      "Highlight treatments you offer and publish transparent fees on your profile.",
      "Online booking for new and follow-up appointments, including video where you enable it.",
      "Founding Free profile is free forever — lock in first-100 perks.",
    ],
    clinicVsSolo:
      "Solo dermatologists start free. Skin clinics can add seats on the Clinic plan.",
  },
  orthopedics: {
    headline: "Invite your orthopaedic practice to MyDoctors360",
    subhead:
      "Independent orthopaedic specialists get discovered by private patients looking to book joint, sports-injury, and back consultations.",
    usps: [
      "Patients seeking private orthopaedic advice can find your profile and book consultations online.",
      "List the conditions and procedures you treat, with fees shown upfront.",
      "Manage availability and payments from one practice dashboard.",
      "Founding Free listing stays free forever for the first 100 doctors.",
    ],
    clinicVsSolo:
      "Solo consultants and multi-surgeon groups both fit — Clinic seats when you need them.",
  },
  neurology: {
    headline: "Invite your neurology practice to MyDoctors360",
    subhead:
      "Independent neurologists publish a founding profile so private patients can find you and book headache, seizure, and nerve consultations.",
    usps: [
      "Patients looking for a private neurologist can discover your practice and book online.",
      "Show your focus areas, fees, and appointment types on a verified profile.",
      "Practice tools for bookings and payments — you remain the clinician.",
      "Founding Free is free forever, with first-100 founding perks.",
    ],
  },
  psychiatry: {
    headline: "Invite your psychiatry practice to MyDoctors360",
    subhead:
      "Independent psychiatrists list a profile so private patients can find you and book assessments and follow-ups online.",
    usps: [
      "Patients searching for private psychiatric care can discover your profile and book consultations with you.",
      "Publish availability for in-person and video appointments you choose to offer.",
      "Collect fees securely when you enable online bookings.",
      "Founding Free profile stays free forever — first 100 keep founding perks.",
    ],
    clinicVsSolo:
      "Solo consultants start on Founding Free. Group practices can add Clinic seats.",
  },
  psychology: {
    headline: "Invite your psychology practice to MyDoctors360",
    subhead:
      "Independent psychologists and therapists get a founding profile so private clients can find you and book sessions online.",
    usps: [
      "Clients looking for private therapy and counselling can discover your profile and book with you.",
      "Show session types, fees, and languages on your public listing.",
      "Online booking and payments when you upgrade to accept bookings.",
      "Founding Free is free forever for founding members.",
    ],
    clinicVsSolo:
      "Solo practitioners start free. Multi-therapist clinics can add seats later.",
  },
  ophthalmology: {
    headline: "Invite your ophthalmology practice to MyDoctors360",
    subhead:
      "Independent ophthalmologists list a profile so private patients can book vision assessments and eye consultations with you.",
    usps: [
      "Patients searching for private eye care can find your practice and book online.",
      "Publish consultation fees and the appointment types you offer.",
      "Practice dashboard for bookings and payments — you provide the care.",
      "Founding Free profile is free forever, with first-100 perks.",
    ],
    clinicVsSolo:
      "Solo consultants and multi-surgeon eye clinics both work — Clinic plan for extra seats.",
  },
  ent: {
    headline: "Invite your ENT practice to MyDoctors360",
    subhead:
      "Independent ENT specialists get a founding profile so private patients can find you and book sinus, hearing, and throat consultations.",
    usps: [
      "Patients looking for a private ENT can discover your profile and book online.",
      "List common presentations you see and show fees upfront.",
      "Online booking for new and follow-up appointments you choose to offer.",
      "Founding Free stays free forever — first 100 doctors keep founding perks.",
    ],
  },
  gynecology: {
    headline: "Invite your gynaecology practice to MyDoctors360",
    subhead:
      "Independent gynaecologists list a founding profile so private patients can find you and book screenings, consultations, and follow-ups.",
    usps: [
      "Patients searching for private women's health care can discover your practice and book with you.",
      "Publish appointment types, fees, and availability on your own profile.",
      "Collect payments securely when you unlock online bookings.",
      "Founding Free profile is free forever, with first-100 founding perks.",
    ],
    clinicVsSolo:
      "Solo consultants start on Founding Free. Multi-clinician women's health clinics can add seats.",
  },
  urology: {
    headline: "Invite your urology practice to MyDoctors360",
    subhead:
      "Independent urologists publish a profile so private patients can find you and book consultations online.",
    usps: [
      "Patients looking for a private urologist can discover your profile and book appointments with you.",
      "Show fees and the consultation types you offer.",
      "Practice tools for scheduling and payments — you remain the clinician.",
      "Founding Free is free forever for the first 100 doctors.",
    ],
  },
  gastroenterology: {
    headline: "Invite your gastroenterology practice to MyDoctors360",
    subhead:
      "Independent gastroenterologists get a founding profile so private patients can find you and book digestive-health consultations.",
    usps: [
      "Patients searching for private GI specialists can discover you and book online.",
      "Highlight the consultations you offer and publish transparent fees.",
      "Online booking and payment collection when you upgrade.",
      "Founding Free listing stays free forever, with first-100 perks.",
    ],
  },
  endocrinology: {
    headline: "Invite your endocrinology practice to MyDoctors360",
    subhead:
      "Independent endocrinologists list a profile so private patients can find you and book diabetes, thyroid, and hormone consultations.",
    usps: [
      "Patients looking for a private endocrinologist can discover your practice and book with you.",
      "Publish availability, fees, and consultation types on your profile.",
      "Manage bookings and payments from one dashboard.",
      "Founding Free is free forever — lock in first-100 founding perks.",
    ],
  },
  pulmonology: {
    headline: "Invite your respiratory practice to MyDoctors360",
    subhead:
      "Independent pulmonologists get a founding profile so private patients can find you and book asthma, COPD, and cough consultations.",
    usps: [
      "Patients searching for a private respiratory specialist can discover your profile and book online.",
      "Show the appointment types and fees you set.",
      "Practice tools for bookings and payments — you deliver the care.",
      "Founding Free profile stays free forever for founding members.",
    ],
  },
  oncology: {
    headline: "Invite your oncology practice to MyDoctors360",
    subhead:
      "Independent oncologists list a founding profile so private patients can find you and book consultations and follow-ups.",
    usps: [
      "Patients looking for a private oncologist can discover your profile and book consultations with you.",
      "Publish fees, languages, and availability you choose to offer.",
      "Online booking and secure payments when you enable them.",
      "Founding Free is free forever, with first-100 founding perks.",
    ],
  },
  pediatrics: {
    headline: "Invite your paediatric practice to MyDoctors360",
    subhead:
      "Independent paediatricians list a profile so families can find you and book well-child and illness consultations online.",
    usps: [
      "Parents searching for a private paediatrician can discover your practice and book with you.",
      "Show well-child, vaccination, and consultation slots you offer, with fees upfront.",
      "Online booking and payments when you upgrade to accept bookings.",
      "Founding Free profile is free forever — first 100 keep founding perks.",
    ],
    clinicVsSolo:
      "Solo paediatricians start free. Group practices can add Clinic seats for extra clinicians.",
  },
  dentistry: {
    headline: "Invite your dental practice to MyDoctors360",
    subhead:
      "Independent dentists and dental clinics list a founding profile so private dental patients can find you and book online.",
    usps: [
      "Private dental patients can discover your practice and book check-ups, whitening, and routine treatments with you.",
      "Publish your treatment list, fees, and availability on a verified profile.",
      "Online booking for new and existing patients — you provide the dentistry.",
      "Collect payments securely when you unlock online bookings.",
      "Multi-seat Clinic path for practices with several dentists.",
    ],
    clinicVsSolo:
      "Solo dentists start on Founding Free. Multi-chair clinics can add seats on the Clinic plan when you are ready.",
  },
  "aesthetic-medicine": {
    headline: "Invite your aesthetic clinic to MyDoctors360",
    subhead:
      "Independent aesthetic practitioners list a profile so private patients can find you and book consultations and treatments online.",
    usps: [
      "Patients searching for private aesthetic treatments can discover your clinic and book with you.",
      "Show the consultations and procedures you offer, with fees on your profile.",
      "Online booking and payments when you enable them.",
      "Founding Free listing is free forever, with first-100 founding perks.",
    ],
    clinicVsSolo:
      "Solo practitioners start free. Multi-room clinics can add seats on the Clinic plan.",
  },
  physiotherapy: {
    headline: "Invite your physiotherapy practice to MyDoctors360",
    subhead:
      "Independent physiotherapists get a founding profile so private patients can find you and book rehab and injury sessions.",
    usps: [
      "Patients looking for private physiotherapy can discover your practice and book online.",
      "Publish session types, fees, and availability you set.",
      "Practice dashboard for bookings and payments — you deliver the therapy.",
      "Founding Free is free forever for the first 100 practitioners.",
    ],
    clinicVsSolo:
      "Solo physios start on Founding Free. Clinics with several therapists can add seats.",
  },
  radiology: {
    headline: "Invite your radiology practice to MyDoctors360",
    subhead:
      "Independent radiologists and imaging practices list a profile so private patients can find you and book imaging consultations.",
    usps: [
      "Patients searching for private imaging can discover your practice and request appointments with you.",
      "Publish the consultation and reporting services you offer, with fees shown upfront.",
      "Online booking and payments when you unlock them.",
      "Founding Free profile stays free forever, with first-100 perks.",
    ],
    clinicVsSolo:
      "Solo reporters and multi-room imaging centres can both join — Clinic seats for extra clinicians.",
  },
  nutrition: {
    headline: "Invite your nutrition practice to MyDoctors360",
    subhead:
      "Independent nutritionists and dietitians list a founding profile so private clients can find you and book consultations.",
    usps: [
      "Clients looking for private nutrition advice can discover your profile and book with you.",
      "Show consultation types, fees, and availability on your listing.",
      "Online booking and secure payments when you enable bookings.",
      "Founding Free is free forever — lock in first-100 founding perks.",
    ],
  },
  allergy: {
    headline: "Invite your allergy practice to MyDoctors360",
    subhead:
      "Independent allergists list a profile so private patients can find you and book allergy and asthma consultations.",
    usps: [
      "Patients searching for a private allergist can discover your practice and book online.",
      "Publish the consultations you offer and the fees you set.",
      "Practice tools for scheduling and payments — you remain the clinician.",
      "Founding Free profile is free forever for founding members.",
    ],
  },
  rheumatology: {
    headline: "Invite your rheumatology practice to MyDoctors360",
    subhead:
      "Independent rheumatologists get a founding profile so private patients can find you and book joint and autoimmune consultations.",
    usps: [
      "Patients looking for a private rheumatologist can discover your profile and book with you.",
      "Show fees, languages, and appointment types on your public listing.",
      "Online booking and payments when you upgrade to accept bookings.",
      "Founding Free stays free forever, with first-100 founding perks.",
    ],
  },
  nephrology: {
    headline: "Invite your nephrology practice to MyDoctors360",
    subhead:
      "Independent nephrologists list a profile so private patients can find you and book kidney-health consultations.",
    usps: [
      "Patients searching for a private nephrologist can discover your practice and book online.",
      "Publish consultation fees and availability you choose to offer.",
      "Manage bookings and payments from one practice dashboard.",
      "Founding Free is free forever — first 100 doctors keep founding perks.",
    ],
  },
};

/** Clinic seat-invite tokens are 32-byte hex strings (64 chars). */
const CLINIC_INVITE_TOKEN = /^[a-f0-9]{64}$/i;

export function isClinicInviteToken(value: string): boolean {
  return CLINIC_INVITE_TOKEN.test(value);
}

export function isTestingSpecialtySlug(slug: string): boolean {
  return getTestingSpecialties().some((s) => s.slug === slug);
}

export function isMedicalInviteSlug(slug: string): boolean {
  return getMedicalSpecialties().some((s) => s.slug === slug);
}

function buildFallbackInvite(slug: string): SpecialtyInviteCopy {
  const meta = getSpecialtyMeta(slug);
  const name = meta ? formatSpecialtyName(meta.nameKey) : slug;
  const conditionHints = (meta?.commonConditions ?? [])
    .slice(0, 2)
    .map((c) => c.charAt(0).toLowerCase() + c.slice(1));
  const bookingHint =
    conditionHints.length > 0
      ? ` including ${conditionHints.join(" and ")}`
      : "";

  return {
    headline: `Invite your ${name.toLowerCase()} practice to MyDoctors360`,
    subhead: `Independent ${name.toLowerCase()} clinicians list a founding profile so private patients can find you and book consultations online.`,
    usps: [
      `Private patients searching for ${name.toLowerCase()} can discover your practice and book with you${bookingHint}.`,
      "Publish your fees, availability, and consultation types on a verified profile.",
      "Collect payments securely when you unlock online bookings.",
      "Founding Free profile stays free forever — first 100 keep founding perks.",
    ],
    clinicVsSolo:
      "Solo clinicians start on Founding Free. Multi-clinician practices can add seats on the Clinic plan.",
  };
}

/** Medical specialty invite copy. Testing slugs and unknown slugs return undefined. */
export function getSpecialtyInvite(slug: string): SpecialtyInviteCopy | undefined {
  if (!isMedicalInviteSlug(slug)) return undefined;
  return SPECIALTY_INVITES[slug] ?? buildFallbackInvite(slug);
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
