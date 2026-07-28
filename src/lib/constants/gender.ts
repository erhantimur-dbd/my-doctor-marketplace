export const DOCTOR_GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export type DoctorGender = (typeof DOCTOR_GENDERS)[number]["value"];

/** Values that appear as patient-facing search filters (excludes prefer_not_to_say). */
export const SEARCHABLE_GENDERS = DOCTOR_GENDERS.filter(
  (g) => g.value !== "prefer_not_to_say"
);

export function isValidGender(value: string): value is DoctorGender {
  return DOCTOR_GENDERS.some((g) => g.value === value);
}

export function getGenderLabel(value: string | null | undefined): string | null {
  if (!value || value === "prefer_not_to_say") return null;
  return DOCTOR_GENDERS.find((g) => g.value === value)?.label ?? null;
}
