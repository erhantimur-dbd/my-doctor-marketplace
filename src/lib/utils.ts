import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Medical abbreviation overrides for specialty names.
 * The generic title-case regex turns "mri_scans" → "Mri Scans" which is wrong.
 * This map provides the correct display strings.
 */
const SPECIALTY_DISPLAY_NAMES: Record<string, string> = {
  ent: "ENT",
  mri_scans: "MRI Scans",
  ct_scans: "CT Scans",
  xray: "X-Ray",
  ecg_heart_tests: "ECG / Heart Tests",
  sti_testing: "STI Testing",
}

/**
 * Format a specialty name_key for display.
 * Strips the "specialty." prefix, checks the abbreviation map,
 * then falls back to generic title-case.
 */
export function formatSpecialtyName(nameKey: string): string {
  const key = nameKey.replace("specialty.", "")
  if (SPECIALTY_DISPLAY_NAMES[key]) {
    return SPECIALTY_DISPLAY_NAMES[key]
  }
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase())
}
