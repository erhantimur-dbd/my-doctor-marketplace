/**
 * Patient-facing condition / procedure hubs for discovery SEO + conversion.
 * Each hub maps to search filters (specialty + optional query keywords).
 */
export interface ConditionHub {
  slug: string;
  /** Short English title (i18n can wrap later) */
  title: string;
  /** One-line patient-facing blurb */
  description: string;
  /** Specialty slug for /doctors?specialty= */
  specialtySlug: string;
  /** Optional free-text query to bias search */
  searchQuery?: string;
  /** Optional emoji/icon hint for cards */
  emoji: string;
}

/** Curated top hubs — keep in sync with popular SYMPTOMS / specialties */
export const CONDITION_HUBS: readonly ConditionHub[] = [
  {
    slug: "knee-pain",
    title: "Knee pain",
    description: "Find orthopaedic and physio specialists for knee injuries, arthritis, and sports pain.",
    specialtySlug: "orthopedics",
    searchQuery: "knee pain",
    emoji: "🦵",
  },
  {
    slug: "back-pain",
    title: "Back & neck pain",
    description: "Book doctors and physiotherapists for back pain, sciatica, and neck strain.",
    specialtySlug: "physiotherapy",
    searchQuery: "back pain",
    emoji: "🦴",
  },
  {
    slug: "headache-migraine",
    title: "Headaches & migraines",
    description: "See neurologists and GPs experienced with migraine and chronic headaches.",
    specialtySlug: "neurology",
    searchQuery: "migraine",
    emoji: "🧠",
  },
  {
    slug: "skin-concerns",
    title: "Skin concerns",
    description: "Dermatologists for acne, rashes, moles, eczema, and skin checks.",
    specialtySlug: "dermatology",
    searchQuery: "skin",
    emoji: "✨",
  },
  {
    slug: "anxiety-stress",
    title: "Anxiety & stress",
    description: "Private psychologists and psychiatrists for anxiety, stress, and burnout.",
    specialtySlug: "psychology",
    searchQuery: "anxiety",
    emoji: "💭",
  },
  {
    slug: "womens-health",
        title: "Womens health",
    description: "Gynaecology specialists for menopause, PCOS, fertility, and routine care.",
    specialtySlug: "gynecology",
    searchQuery: "women health",
    emoji: "🌸",
  },
  {
    slug: "heart-health",
    title: "Heart health",
    description: "Cardiologists for chest pain, blood pressure, cholesterol, and heart checks.",
    specialtySlug: "cardiology",
    searchQuery: "heart",
    emoji: "❤️",
  },
  {
    slug: "stomach-digestion",
    title: "Stomach & digestion",
    description: "Gastroenterologists for IBS, reflux, and digestive symptoms.",
    specialtySlug: "gastroenterology",
    searchQuery: "digestion",
    emoji: "🫁",
  },
  {
    slug: "child-health",
    title: "Child health",
    description: "Paediatricians for childhood illness, growth, and parent concerns.",
    specialtySlug: "pediatrics",
    searchQuery: "child",
    emoji: "👶",
  },
  {
    slug: "dental-care",
    title: "Dental care",
    description: "Dentists for check-ups, pain, implants, and cosmetic dentistry.",
    specialtySlug: "dentistry",
    searchQuery: "dental",
    emoji: "🦷",
  },
  {
    slug: "eye-care",
    title: "Eye care",
    description: "Ophthalmologists for vision problems, eye pain, and check-ups.",
    specialtySlug: "ophthalmology",
    searchQuery: "eye",
    emoji: "👁️",
  },
  {
    slug: "ent",
    title: "Ear, nose & throat",
    description: "ENT specialists for hearing, sinus issues, and throat problems.",
    specialtySlug: "ent",
    searchQuery: "ear nose throat",
    emoji: "👂",
  },
] as const;

export function getConditionHub(slug: string): ConditionHub | undefined {
  return CONDITION_HUBS.find((h) => h.slug === slug);
}

export function conditionHubSearchHref(hub: ConditionHub): string {
  const params = new URLSearchParams();
  params.set("specialty", hub.specialtySlug);
  if (hub.searchQuery) params.set("query", hub.searchQuery);
  params.set("sort", "soonest");
  return `/doctors?${params.toString()}`;
}
