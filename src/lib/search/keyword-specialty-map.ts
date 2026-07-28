/**
 * Symptom/keyword → specialty mapping for free-text search.
 * GP is usually first port of call; specialist is the related option.
 */
export const KEYWORD_SPECIALTY_MAP: Record<
  string,
  { primary: string; specialist: string }
> = {
  // General symptoms → GP first, specialist secondary
  headache: { primary: "general-practice", specialist: "neurology" },
  migraine: { primary: "general-practice", specialist: "neurology" },
  dizzy: { primary: "general-practice", specialist: "neurology" },
  seizure: { primary: "general-practice", specialist: "neurology" },
  sick: { primary: "general-practice", specialist: "gastroenterology" },
  nausea: { primary: "general-practice", specialist: "gastroenterology" },
  tired: { primary: "general-practice", specialist: "endocrinology" },
  fatigue: { primary: "general-practice", specialist: "endocrinology" },
  fever: { primary: "general-practice", specialist: "general-practice" },
  pain: { primary: "general-practice", specialist: "general-practice" },
  // Skin
  skin: { primary: "general-practice", specialist: "dermatology" },
  rash: { primary: "general-practice", specialist: "dermatology" },
  acne: { primary: "dermatology", specialist: "dermatology" },
  eczema: { primary: "dermatology", specialist: "dermatology" },
  // Heart
  heart: { primary: "general-practice", specialist: "cardiology" },
  chest: { primary: "general-practice", specialist: "cardiology" },
  palpitations: { primary: "general-practice", specialist: "cardiology" },
  // Musculoskeletal
  bone: { primary: "general-practice", specialist: "orthopedics" },
  joint: { primary: "general-practice", specialist: "orthopedics" },
  knee: { primary: "general-practice", specialist: "orthopedics" },
  back: { primary: "general-practice", specialist: "orthopedics" },
  fracture: { primary: "general-practice", specialist: "orthopedics" },
  // Eye
  eye: { primary: "general-practice", specialist: "ophthalmology" },
  vision: { primary: "general-practice", specialist: "ophthalmology" },
  sight: { primary: "general-practice", specialist: "ophthalmology" },
  // Ear/Nose/Throat
  ear: { primary: "general-practice", specialist: "ent" },
  nose: { primary: "general-practice", specialist: "ent" },
  throat: { primary: "general-practice", specialist: "ent" },
  hearing: { primary: "general-practice", specialist: "ent" },
  sinus: { primary: "general-practice", specialist: "ent" },
  // Digestive
  stomach: { primary: "general-practice", specialist: "gastroenterology" },
  digestive: { primary: "general-practice", specialist: "gastroenterology" },
  gut: { primary: "general-practice", specialist: "gastroenterology" },
  ibs: { primary: "gastroenterology", specialist: "gastroenterology" },
  // Endocrine
  diabetes: { primary: "general-practice", specialist: "endocrinology" },
  thyroid: { primary: "general-practice", specialist: "endocrinology" },
  hormone: { primary: "general-practice", specialist: "endocrinology" },
  // Respiratory
  lung: { primary: "general-practice", specialist: "pulmonology" },
  breathing: { primary: "general-practice", specialist: "pulmonology" },
  asthma: { primary: "general-practice", specialist: "pulmonology" },
  cough: { primary: "general-practice", specialist: "pulmonology" },
  // Oncology
  cancer: { primary: "general-practice", specialist: "oncology" },
  tumor: { primary: "general-practice", specialist: "oncology" },
  lump: { primary: "general-practice", specialist: "oncology" },
  // Pediatrics
  child: { primary: "pediatrics", specialist: "pediatrics" },
  baby: { primary: "pediatrics", specialist: "pediatrics" },
  infant: { primary: "pediatrics", specialist: "pediatrics" },
  // Dental
  teeth: { primary: "dentistry", specialist: "dentistry" },
  dental: { primary: "dentistry", specialist: "dentistry" },
  tooth: { primary: "dentistry", specialist: "dentistry" },
  // Mental health
  anxiety: { primary: "general-practice", specialist: "psychology" },
  depression: { primary: "general-practice", specialist: "psychology" },
  mental: { primary: "general-practice", specialist: "psychiatry" },
  stress: { primary: "general-practice", specialist: "psychology" },
  // Women's health
  pregnancy: { primary: "gynecology", specialist: "gynecology" },
  period: { primary: "general-practice", specialist: "gynecology" },
  fertility: { primary: "gynecology", specialist: "gynecology" },
  // Urinary
  urine: { primary: "general-practice", specialist: "urology" },
  bladder: { primary: "general-practice", specialist: "urology" },
  kidney: { primary: "general-practice", specialist: "nephrology" },
  // Allergy
  allergy: { primary: "general-practice", specialist: "allergy" },
  allergic: { primary: "general-practice", specialist: "allergy" },
  hayfever: { primary: "general-practice", specialist: "allergy" },
  // Lifestyle
  weight: { primary: "general-practice", specialist: "nutrition" },
  diet: { primary: "nutrition", specialist: "nutrition" },
  obesity: { primary: "general-practice", specialist: "nutrition" },
  // Physio
  physiotherapy: { primary: "physiotherapy", specialist: "physiotherapy" },
  physio: { primary: "physiotherapy", specialist: "physiotherapy" },
  rehab: { primary: "physiotherapy", specialist: "physiotherapy" },
};

/** Match first keyword hit in a free-text query. */
export function matchKeywordSpecialty(
  query: string
): { primary: string; specialist: string } | null {
  const words = query.trim().toLowerCase().split(/\s+/);
  for (const word of words) {
    if (KEYWORD_SPECIALTY_MAP[word]) return KEYWORD_SPECIALTY_MAP[word];
  }
  return null;
}
