/**
 * UK legal entity details for public legal pages (About, Terms, Privacy, etc.).
 *
 * Set these in Vercel → Environment Variables (Production + Preview).
 * Pages must never render raw TBD_ placeholders in production.
 */

export interface CompanyIdentity {
  legalEntityName: string;
  companiesHouseNumber: string;
  registeredOffice: string;
  icoRegistrationNumber: string;
  dpoName: string;
  dpoEmail: string;
  complaintsEmail: string;
  complaintsHandler: string;
  indemnitySummary: string;
  /** True when any required field is still unset / placeholder */
  incomplete: boolean;
  missingKeys: string[];
}

const PLACEHOLDER_PREFIX = "TBD_";

function readEnv(key: string, fallback = ""): string {
  const raw = (process.env[key] || "").trim();
  return raw;
}

function isUnset(value: string): boolean {
  return !value || value.startsWith(PLACEHOLDER_PREFIX);
}

/**
 * Resolve company identity from environment.
 * Prefer real env values; fall back to empty string (never invent a company name).
 */
export function getCompanyIdentity(): CompanyIdentity {
  const legalEntityName = readEnv("LEGAL_ENTITY_NAME");
  const companiesHouseNumber = readEnv("COMPANIES_HOUSE_NUMBER");
  const registeredOffice = readEnv("REGISTERED_OFFICE");
  const icoRegistrationNumber = readEnv("ICO_REGISTRATION_NUMBER");
  const dpoName = readEnv("DPO_NAME") || "Privacy Lead";
  const dpoEmail =
    readEnv("DPO_EMAIL") ||
    readEnv("PRIVACY_EMAIL") ||
    "privacy@mydoctors360.com";
  const complaintsEmail =
    readEnv("COMPLAINTS_EMAIL") ||
    readEnv("SUPPORT_EMAIL") ||
    "support@mydoctors360.com";
  const complaintsHandler =
    readEnv("COMPLAINTS_HANDLER") || "Customer Support Team";
  const indemnitySummary = readEnv("PLATFORM_INDEMNITY_SUMMARY");

  const required: Array<[string, string]> = [
    ["LEGAL_ENTITY_NAME", legalEntityName],
    ["COMPANIES_HOUSE_NUMBER", companiesHouseNumber],
    ["REGISTERED_OFFICE", registeredOffice],
  ];
  const missingKeys = required
    .filter(([, v]) => isUnset(v))
    .map(([k]) => k);

  return {
    legalEntityName: isUnset(legalEntityName)
      ? "MyDoctors360 (legal entity pending registration)"
      : legalEntityName,
    companiesHouseNumber: isUnset(companiesHouseNumber)
      ? "Pending Companies House registration"
      : companiesHouseNumber,
    registeredOffice: isUnset(registeredOffice)
      ? "Registered office address will be published once Companies House registration is complete. Contact support@mydoctors360.com for interim correspondence."
      : registeredOffice,
    icoRegistrationNumber: isUnset(icoRegistrationNumber)
      ? "ICO registration pending"
      : icoRegistrationNumber,
    dpoName,
    dpoEmail,
    complaintsEmail,
    complaintsHandler,
    indemnitySummary: isUnset(indemnitySummary)
      ? "Professional indemnity and platform liability cover details available on request via support@mydoctors360.com."
      : indemnitySummary,
    incomplete: missingKeys.length > 0,
    missingKeys,
  };
}

/** Founding programme hard cap advertised on the soft-launch landing page. */
export const FOUNDING_PROGRAMME_MAX_SPOTS = 100;
