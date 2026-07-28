/**
 * Condition / procedure landing-page taxonomy for SEO (Wave B1).
 * Seeded from symptoms + common procedures; each maps to specialties.
 */
import { SYMPTOMS } from "./symptoms";

export interface ConditionMeta {
  /** URL slug e.g. "back-pain" */
  slug: string;
  /** Display name */
  name: string;
  /** Short SEO description */
  description: string;
  /** Primary specialty slug */
  primarySpecialty: string;
  /** Related specialty slugs */
  relatedSpecialties: string[];
  /** Optional keywords for search matching */
  keywords: string[];
}

function toSlug(id: string): string {
  return id.replace(/_/g, "-");
}

function humanize(id: string): string {
  return id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Core procedure/condition pages beyond symptoms */
const EXTRA_CONDITIONS: readonly ConditionMeta[] = [
  {
    slug: "mole-check",
    name: "Mole Check",
    description:
      "Book a private mole check with a verified dermatologist. Fast appointments for skin cancer screening and lesion review.",
    primarySpecialty: "dermatology",
    relatedSpecialties: ["general-practice"],
    keywords: ["mole", "mole mapping", "skin check", "lesion"],
  },
  {
    slug: "cataract-surgery",
    name: "Cataract Surgery",
    description:
      "Find private ophthalmologists offering cataract assessment and surgery across the UK and Europe.",
    primarySpecialty: "ophthalmology",
    relatedSpecialties: [],
    keywords: ["cataract", "lens replacement", "blurred vision"],
  },
  {
    slug: "knee-replacement",
    name: "Knee Replacement",
    description:
      "Compare private orthopaedic surgeons for knee replacement and joint pain assessment.",
    primarySpecialty: "orthopedics",
    relatedSpecialties: ["physiotherapy"],
    keywords: ["knee replacement", "knee arthritis", "total knee"],
  },
  {
    slug: "hip-replacement",
    name: "Hip Replacement",
    description:
      "Book private hip replacement consultations with verified orthopaedic specialists.",
    primarySpecialty: "orthopedics",
    relatedSpecialties: ["physiotherapy"],
    keywords: ["hip replacement", "hip pain", "arthritis hip"],
  },
  {
    slug: "endoscopy",
    name: "Endoscopy (OGD)",
    description:
      "Find gastroenterologists offering private endoscopy and digestive investigations.",
    primarySpecialty: "gastroenterology",
    relatedSpecialties: ["general-practice"],
    keywords: ["endoscopy", "ogd", "gastroscopy", "camera test"],
  },
  {
    slug: "menopause",
    name: "Menopause",
    description:
      "Private menopause care including HRT advice from gynaecology and general practice specialists.",
    primarySpecialty: "gynecology",
    relatedSpecialties: ["general-practice", "endocrinology"],
    keywords: ["menopause", "hrt", "hot flushes", "perimenopause"],
  },
  {
    slug: "adhd-assessment",
    name: "ADHD Assessment",
    description:
      "Book private ADHD assessments with psychiatry and psychology specialists.",
    primarySpecialty: "psychiatry",
    relatedSpecialties: ["psychology"],
    keywords: ["adhd", "attention deficit", "hyperactivity"],
  },
  {
    slug: "autism-assessment",
    name: "Autism Assessment",
    description:
      "Private autism assessments for adults and children with verified clinicians.",
    primarySpecialty: "psychiatry",
    relatedSpecialties: ["psychology", "pediatrics"],
    keywords: ["autism", "asd", "neurodiversity"],
  },
  {
    slug: "sports-injuries",
    name: "Sports Injuries",
    description:
      "Private orthopaedic and physiotherapy care for sports injuries and musculoskeletal pain.",
    primarySpecialty: "orthopedics",
    relatedSpecialties: ["physiotherapy"],
    keywords: ["sports injury", "sprain", "strain", "athlete"],
  },
  {
    slug: "varicose-veins",
    name: "Varicose Veins",
    description:
      "Find private vascular specialists for varicose vein assessment and treatment.",
    primarySpecialty: "vascular-surgery",
    relatedSpecialties: ["general-practice"],
    keywords: ["varicose", "veins", "leg veins"],
  },
];

const fromSymptoms: ConditionMeta[] = SYMPTOMS.map((s) => ({
  slug: toSlug(s.id),
  name: humanize(s.id),
  description: `Find and book verified private specialists for ${humanize(s.id).toLowerCase()}. Compare ratings, fees, and live availability on MyDoctors360.`,
  primarySpecialty: s.primarySpecialty,
  relatedSpecialties: [...s.relatedSpecialties],
  keywords: [...s.keywords],
}));

/** Deduped catalog: extra conditions win on slug collision */
const bySlug = new Map<string, ConditionMeta>();
for (const c of fromSymptoms) bySlug.set(c.slug, c);
for (const c of EXTRA_CONDITIONS) bySlug.set(c.slug, c);

export const CONDITIONS: readonly ConditionMeta[] = Array.from(bySlug.values()).sort(
  (a, b) => a.name.localeCompare(b.name)
);

export function getConditionBySlug(slug: string): ConditionMeta | undefined {
  return bySlug.get(slug);
}

export function getAllConditionSlugs(): string[] {
  return CONDITIONS.map((c) => c.slug);
}
