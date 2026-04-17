/**
 * Skill catalog for doctor endorsements.
 *
 * Patients can attach up to 5 skills to a review. Counts are aggregated per
 * doctor and shown in a "Skill Endorsements" tab on the profile.
 *
 * `specialties: "all"` means the skill is always selectable.
 * `specialties: [slug, ...]` means the skill only shows for matching specialties.
 */
export interface SkillMeta {
  slug: string;
  label: string;
  specialties: "all" | readonly string[];
}

export const MAX_ENDORSEMENTS_PER_REVIEW = 5;

export const SKILLS: readonly SkillMeta[] = [
  // Universal (shown for every specialty)
  { slug: "clear-communication", label: "Clear communication", specialties: "all" },
  { slug: "bedside-manner", label: "Great bedside manner", specialties: "all" },
  { slug: "thorough-diagnosis", label: "Thorough diagnosis", specialties: "all" },
  { slug: "empathy", label: "Empathy", specialties: "all" },
  { slug: "punctuality", label: "Punctuality", specialties: "all" },
  { slug: "follow-up-care", label: "Excellent follow-up care", specialties: "all" },

  // General practice
  { slug: "preventive-care", label: "Preventive care", specialties: ["general-practice"] },
  { slug: "chronic-disease-management", label: "Chronic disease management", specialties: ["general-practice", "endocrinology"] },
  { slug: "vaccinations", label: "Vaccinations", specialties: ["general-practice", "pediatrics"] },
  { slug: "health-screening", label: "Health screenings", specialties: ["general-practice", "health-screenings"] },

  // Cardiology
  { slug: "hypertension-management", label: "Hypertension management", specialties: ["cardiology"] },
  { slug: "heart-failure-care", label: "Heart failure care", specialties: ["cardiology"] },
  { slug: "arrhythmia-treatment", label: "Arrhythmia treatment", specialties: ["cardiology"] },
  { slug: "cholesterol-management", label: "Cholesterol management", specialties: ["cardiology", "general-practice"] },
  { slug: "cardiac-imaging", label: "Cardiac imaging", specialties: ["cardiology", "radiology"] },

  // Dermatology
  { slug: "acne-treatment", label: "Acne treatment", specialties: ["dermatology"] },
  { slug: "eczema-care", label: "Eczema & psoriasis", specialties: ["dermatology"] },
  { slug: "skin-cancer-screening", label: "Skin cancer screening", specialties: ["dermatology"] },
  { slug: "mole-check", label: "Mole checks", specialties: ["dermatology"] },
  { slug: "hair-loss-treatment", label: "Hair loss treatment", specialties: ["dermatology"] },

  // Orthopedics
  { slug: "knee-surgery", label: "Knee surgery", specialties: ["orthopedics"] },
  { slug: "hip-surgery", label: "Hip surgery", specialties: ["orthopedics"] },
  { slug: "shoulder-treatment", label: "Shoulder treatment", specialties: ["orthopedics"] },
  { slug: "sports-injuries", label: "Sports injuries", specialties: ["orthopedics", "physiotherapy"] },
  { slug: "fracture-care", label: "Fracture care", specialties: ["orthopedics"] },
  { slug: "back-neck-pain", label: "Back & neck pain", specialties: ["orthopedics", "physiotherapy", "neurology"] },

  // Neurology
  { slug: "migraine-management", label: "Migraine management", specialties: ["neurology"] },
  { slug: "epilepsy-care", label: "Epilepsy care", specialties: ["neurology"] },
  { slug: "stroke-rehab", label: "Stroke rehabilitation", specialties: ["neurology"] },
  { slug: "memory-disorders", label: "Memory disorders", specialties: ["neurology"] },
  { slug: "multiple-sclerosis", label: "Multiple sclerosis", specialties: ["neurology"] },

  // Psychiatry
  { slug: "depression-treatment", label: "Depression treatment", specialties: ["psychiatry", "psychology"] },
  { slug: "anxiety-treatment", label: "Anxiety treatment", specialties: ["psychiatry", "psychology"] },
  { slug: "medication-management", label: "Medication management", specialties: ["psychiatry"] },
  { slug: "adhd-assessment", label: "ADHD assessment", specialties: ["psychiatry", "psychology"] },
  { slug: "bipolar-care", label: "Bipolar care", specialties: ["psychiatry"] },

  // Psychology
  { slug: "cbt-therapy", label: "CBT therapy", specialties: ["psychology"] },
  { slug: "trauma-therapy", label: "Trauma therapy", specialties: ["psychology"] },
  { slug: "couples-counselling", label: "Couples counselling", specialties: ["psychology"] },
  { slug: "child-therapy", label: "Child therapy", specialties: ["psychology", "pediatrics"] },

  // Ophthalmology
  { slug: "cataract-surgery", label: "Cataract surgery", specialties: ["ophthalmology"] },
  { slug: "laser-eye-surgery", label: "Laser eye surgery", specialties: ["ophthalmology"] },
  { slug: "glaucoma-care", label: "Glaucoma care", specialties: ["ophthalmology"] },
  { slug: "retinal-treatment", label: "Retinal treatment", specialties: ["ophthalmology"] },

  // ENT
  { slug: "hearing-loss", label: "Hearing loss", specialties: ["ent"] },
  { slug: "sinus-treatment", label: "Sinus treatment", specialties: ["ent"] },
  { slug: "tonsillectomy", label: "Tonsillectomy", specialties: ["ent"] },
  { slug: "vertigo-treatment", label: "Vertigo treatment", specialties: ["ent", "neurology"] },

  // Gynecology
  { slug: "fertility-care", label: "Fertility care", specialties: ["gynecology"] },
  { slug: "prenatal-care", label: "Prenatal care", specialties: ["gynecology"] },
  { slug: "menopause-management", label: "Menopause management", specialties: ["gynecology"] },
  { slug: "contraception-advice", label: "Contraception advice", specialties: ["gynecology", "general-practice"] },
  { slug: "pcos-care", label: "PCOS care", specialties: ["gynecology", "endocrinology"] },

  // Urology
  { slug: "prostate-treatment", label: "Prostate treatment", specialties: ["urology"] },
  { slug: "kidney-stones", label: "Kidney stones", specialties: ["urology", "nephrology"] },
  { slug: "mens-health", label: "Men's health", specialties: ["urology"] },
  { slug: "urinary-incontinence", label: "Urinary incontinence", specialties: ["urology", "gynecology"] },

  // Gastroenterology
  { slug: "ibs-treatment", label: "IBS treatment", specialties: ["gastroenterology"] },
  { slug: "endoscopy", label: "Endoscopy", specialties: ["gastroenterology"] },
  { slug: "colonoscopy", label: "Colonoscopy", specialties: ["gastroenterology"] },
  { slug: "liver-disease", label: "Liver disease", specialties: ["gastroenterology"] },
  { slug: "reflux-treatment", label: "Reflux treatment", specialties: ["gastroenterology"] },

  // Endocrinology
  { slug: "diabetes-care", label: "Diabetes care", specialties: ["endocrinology", "general-practice"] },
  { slug: "thyroid-disorders", label: "Thyroid disorders", specialties: ["endocrinology"] },
  { slug: "hormone-therapy", label: "Hormone therapy", specialties: ["endocrinology", "gynecology"] },

  // Pulmonology
  { slug: "asthma-care", label: "Asthma care", specialties: ["pulmonology", "allergy"] },
  { slug: "copd-care", label: "COPD care", specialties: ["pulmonology"] },
  { slug: "sleep-apnea", label: "Sleep apnea", specialties: ["pulmonology"] },

  // Oncology
  { slug: "chemotherapy", label: "Chemotherapy", specialties: ["oncology"] },
  { slug: "cancer-screening", label: "Cancer screening", specialties: ["oncology", "general-practice"] },
  { slug: "survivorship-care", label: "Survivorship care", specialties: ["oncology"] },

  // Pediatrics
  { slug: "newborn-care", label: "Newborn care", specialties: ["pediatrics"] },
  { slug: "child-development", label: "Child development", specialties: ["pediatrics"] },
  { slug: "childhood-allergies", label: "Childhood allergies", specialties: ["pediatrics", "allergy"] },

  // Dentistry
  { slug: "dental-implants", label: "Dental implants", specialties: ["dentistry"] },
  { slug: "orthodontics", label: "Orthodontics", specialties: ["dentistry"] },
  { slug: "teeth-whitening", label: "Teeth whitening", specialties: ["dentistry"] },
  { slug: "root-canal", label: "Root canal", specialties: ["dentistry"] },
  { slug: "pain-free-dentistry", label: "Pain-free dentistry", specialties: ["dentistry"] },

  // Aesthetic medicine
  { slug: "botox", label: "Botox", specialties: ["aesthetic-medicine"] },
  { slug: "dermal-fillers", label: "Dermal fillers", specialties: ["aesthetic-medicine"] },
  { slug: "laser-treatments", label: "Laser treatments", specialties: ["aesthetic-medicine", "dermatology"] },
  { slug: "natural-results", label: "Natural-looking results", specialties: ["aesthetic-medicine"] },

  // Physiotherapy
  { slug: "sports-rehab", label: "Sports rehabilitation", specialties: ["physiotherapy"] },
  { slug: "posture-correction", label: "Posture correction", specialties: ["physiotherapy"] },
  { slug: "manual-therapy", label: "Manual therapy", specialties: ["physiotherapy"] },
  { slug: "post-surgery-rehab", label: "Post-surgery rehab", specialties: ["physiotherapy"] },

  // Nutrition
  { slug: "weight-management", label: "Weight management", specialties: ["nutrition"] },
  { slug: "sports-nutrition", label: "Sports nutrition", specialties: ["nutrition"] },
  { slug: "diabetic-diet", label: "Diabetic diet planning", specialties: ["nutrition", "endocrinology"] },
  { slug: "gut-health", label: "Gut health", specialties: ["nutrition", "gastroenterology"] },

  // Allergy
  { slug: "food-allergies", label: "Food allergies", specialties: ["allergy"] },
  { slug: "hay-fever", label: "Hay fever", specialties: ["allergy"] },
  { slug: "immunotherapy", label: "Immunotherapy", specialties: ["allergy"] },

  // Rheumatology
  { slug: "rheumatoid-arthritis", label: "Rheumatoid arthritis", specialties: ["rheumatology"] },
  { slug: "lupus-care", label: "Lupus care", specialties: ["rheumatology"] },
  { slug: "osteoporosis", label: "Osteoporosis", specialties: ["rheumatology", "endocrinology"] },

  // Nephrology
  { slug: "ckd-management", label: "CKD management", specialties: ["nephrology"] },
  { slug: "dialysis-care", label: "Dialysis care", specialties: ["nephrology"] },
];

/** Skills available to a doctor based on their specialty slugs. */
export function skillsForSpecialties(specialtySlugs: string[]): SkillMeta[] {
  return SKILLS.filter(
    (s) =>
      s.specialties === "all" ||
      s.specialties.some((slug) => specialtySlugs.includes(slug))
  );
}

/** Lookup a skill by slug. Returns undefined if not in catalog. */
export function getSkill(slug: string): SkillMeta | undefined {
  return SKILLS.find((s) => s.slug === slug);
}

/** Validate a slug against the catalog. */
export function isValidSkillSlug(slug: string): boolean {
  return SKILLS.some((s) => s.slug === slug);
}
