/**
 * Patient-facing condition / procedure hubs for discovery SEO + conversion.
 *
 * Each hub maps to a structured search intent:
 * - primarySpecialty: waitlist / filter default
 * - specialtySlugs: OR pool of doctors to show (primary first)
 * - skillSlug: optional soft boost via doctor_skills (dropped when empty)
 * - displayQuery: label for the search bar "What" field (not free-text bio search)
 */
export interface ConditionHub {
  slug: string;
  /** Short English title (i18n can wrap later) */
  title: string;
  /** One-line patient-facing blurb */
  description: string;
  /** Primary specialty slug (filters, waitlist, specialty page links) */
  specialtySlug: string;
  /**
   * All specialty slugs to OR into the doctor pool (primary first).
   * When omitted, defaults to [specialtySlug].
   */
  specialtySlugs?: readonly string[];
  /**
   * Optional skill slug from skills taxonomy.
   * Soft filter: if no doctor has declared it, specialty pool still shows.
   */
  skillSlug?: string;
  /** UI label for search bar / results banner (not used as bio ILIKE) */
  displayQuery: string;
  /** Optional emoji/icon hint for cards */
  emoji: string;
  /**
   * @deprecated Prefer displayQuery + specialty pool. Kept for any callers
   * that still read free-text; condition browse no longer uses query= for filtering.
   */
  searchQuery?: string;
}

/** Curated top hubs — single source for homepage, /conditions, search, sitemap */
export const CONDITION_HUBS: readonly ConditionHub[] = [
  {
    slug: "knee-pain",
    title: "Knee pain",
    description:
      "Find orthopaedic and physio specialists for knee injuries, arthritis, and sports pain.",
    specialtySlug: "orthopedics",
    specialtySlugs: ["orthopedics", "physiotherapy"],
    skillSlug: "sports-injuries",
    displayQuery: "Knee pain",
    searchQuery: "knee pain",
    emoji: "🦵",
  },
  {
    slug: "back-pain",
    title: "Back & neck pain",
    description:
      "Book doctors and physiotherapists for back pain, sciatica, and neck strain.",
    specialtySlug: "physiotherapy",
    specialtySlugs: ["physiotherapy", "orthopedics", "neurology"],
    skillSlug: "back-neck-pain",
    displayQuery: "Back & neck pain",
    searchQuery: "back pain",
    emoji: "🦴",
  },
  {
    slug: "headache-migraine",
    title: "Headaches & migraines",
    description:
      "See neurologists and GPs experienced with migraine and chronic headaches.",
    specialtySlug: "neurology",
    specialtySlugs: ["neurology", "general-practice"],
    skillSlug: "migraine-management",
    displayQuery: "Headaches & migraines",
    searchQuery: "migraine",
    emoji: "🧠",
  },
  {
    slug: "skin-concerns",
    title: "Skin concerns",
    description:
      "Dermatologists for acne, rashes, moles, eczema, and skin checks.",
    specialtySlug: "dermatology",
    specialtySlugs: ["dermatology"],
    skillSlug: "mole-check",
    displayQuery: "Skin concerns",
    searchQuery: "skin",
    emoji: "✨",
  },
  {
    slug: "anxiety-stress",
    title: "Anxiety & stress",
    description:
      "Private psychologists and psychiatrists for anxiety, stress, and burnout.",
    specialtySlug: "psychology",
    specialtySlugs: ["psychology", "psychiatry"],
    skillSlug: "anxiety-treatment",
    displayQuery: "Anxiety & stress",
    searchQuery: "anxiety",
    emoji: "💭",
  },
  {
    slug: "womens-health",
    title: "Women's health",
    description:
      "Gynaecology specialists for menopause, PCOS, fertility, and routine care.",
    specialtySlug: "gynecology",
    specialtySlugs: ["gynecology"],
    skillSlug: "menopause-management",
    displayQuery: "Women's health",
    searchQuery: "women health",
    emoji: "🌸",
  },
  {
    slug: "heart-health",
    title: "Heart health",
    description:
      "Cardiologists for chest pain, blood pressure, cholesterol, and heart checks.",
    specialtySlug: "cardiology",
    specialtySlugs: ["cardiology"],
    skillSlug: "hypertension-management",
    displayQuery: "Heart health",
    searchQuery: "heart",
    emoji: "❤️",
  },
  {
    slug: "stomach-digestion",
    title: "Stomach & digestion",
    description: "Gastroenterologists for IBS, reflux, and digestive symptoms.",
    specialtySlug: "gastroenterology",
    specialtySlugs: ["gastroenterology"],
    skillSlug: "ibs-treatment",
    displayQuery: "Stomach & digestion",
    searchQuery: "digestion",
    emoji: "🫁",
  },
  {
    slug: "child-health",
    title: "Child health",
    description:
      "Paediatricians for childhood illness, growth, and parent concerns.",
    specialtySlug: "pediatrics",
    specialtySlugs: ["pediatrics"],
    displayQuery: "Child health",
    searchQuery: "child",
    emoji: "👶",
  },
  {
    slug: "dental-care",
    title: "Dental care",
    description:
      "Dentists for check-ups, pain, implants, and cosmetic dentistry.",
    specialtySlug: "dentistry",
    specialtySlugs: ["dentistry"],
    displayQuery: "Dental care",
    searchQuery: "dental",
    emoji: "🦷",
  },
  {
    slug: "eye-care",
    title: "Eye care",
    description:
      "Ophthalmologists for vision problems, eye pain, and check-ups.",
    specialtySlug: "ophthalmology",
    specialtySlugs: ["ophthalmology"],
    displayQuery: "Eye care",
    searchQuery: "eye",
    emoji: "👁️",
  },
  {
    slug: "ent",
    title: "Ear, nose & throat",
    description:
      "ENT specialists for hearing, sinus issues, and throat problems.",
    specialtySlug: "ent",
    specialtySlugs: ["ent"],
    skillSlug: "hearing-loss",
    displayQuery: "Ear, nose & throat",
    searchQuery: "ear nose throat",
    emoji: "👂",
  },
] as const;

export function getConditionHub(slug: string): ConditionHub | undefined {
  return CONDITION_HUBS.find((h) => h.slug === slug);
}

/** Specialty pool for a hub (always includes primary). */
export function conditionSpecialtySlugs(hub: ConditionHub): string[] {
  const pool = hub.specialtySlugs?.length
    ? [...hub.specialtySlugs]
    : [hub.specialtySlug];
  if (!pool.includes(hub.specialtySlug)) {
    pool.unshift(hub.specialtySlug);
  }
  return [...new Set(pool)];
}

/**
 * Direct results URL for condition browse.
 * Uses structured condition= param — not free-text query= — so search
 * resolves specialty pool + optional soft skill without bio ILIKE noise.
 */
export function conditionHubSearchHref(hub: ConditionHub): string {
  const params = new URLSearchParams();
  params.set("condition", hub.slug);
  params.set("sort", "soonest");
  return `/doctors?${params.toString()}`;
}

/** All hub slugs (for sitemap / static params). */
export function getAllConditionHubSlugs(): string[] {
  return CONDITION_HUBS.map((h) => h.slug);
}
