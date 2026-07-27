/**
 * Curated popular conditions & procedures for homepage discovery
 * and the search autocomplete "popular" mode.
 *
 * IDs must exist in SYMPTOMS / MEDICAL_TESTS.
 */
export const POPULAR_CONDITION_IDS = {
  symptoms: [
    "back_pain",
    "knee_pain",
    "shoulder_pain",
    "headache",
    "migraine",
    "acne",
    "eczema",
    "anxiety",
    "depression",
    "menopause_symptoms",
    "high_blood_pressure",
    "sports_injury",
    "chest_pain",
  ],
  tests: [
    "mri",
    "ultrasound",
    "blood_glucose",
    "cbc",
    "allergy_blood_test",
    "gastroscopy",
    "colonoscopy",
  ],
} as const;

/** Shorter set for chips shown under the hero search bar */
export const SEARCH_BAR_CONDITION_IDS = {
  symptoms: [
    "back_pain",
    "knee_pain",
    "acne",
    "anxiety",
    "headache",
    "menopause_symptoms",
  ],
  tests: ["mri", "ultrasound", "cbc"],
} as const;
