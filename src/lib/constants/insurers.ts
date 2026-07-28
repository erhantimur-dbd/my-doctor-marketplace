/**
 * UK / EU private medical insurance providers shown on doctor profiles
 * and used as search filters.
 */
export interface InsurerMeta {
  /** Stable slug stored in doctors.accepted_insurers */
  value: string;
  label: string;
  /** Markets where this insurer is commonly relevant */
  markets?: readonly string[];
}

export const INSURERS: readonly InsurerMeta[] = [
  { value: "bupa", label: "Bupa", markets: ["GB", "IE"] },
  { value: "axa", label: "AXA Health", markets: ["GB", "IE"] },
  { value: "aviva", label: "Aviva", markets: ["GB", "IE"] },
  { value: "vitality", label: "Vitality", markets: ["GB"] },
  { value: "wpa", label: "WPA", markets: ["GB"] },
  { value: "cigna", label: "Cigna", markets: ["GB", "IE"] },
  { value: "healix", label: "Healix", markets: ["GB"] },
  { value: "allianz", label: "Allianz Care", markets: ["GB", "IE", "DE", "FR", "ES", "IT"] },
  { value: "simply_health", label: "Simplyhealth", markets: ["GB"] },
  { value: "the_exeter", label: "The Exeter", markets: ["GB"] },
  { value: "freedom", label: "Freedom Health Insurance", markets: ["GB"] },
  { value: "saga", label: "Saga Health Insurance", markets: ["GB"] },
  { value: "aetna", label: "Aetna International", markets: ["GB"] },
  { value: "self_pay", label: "Self-pay / no insurance required" },
] as const;

export type InsurerValue = (typeof INSURERS)[number]["value"];

const INSURER_SET = new Set(INSURERS.map((i) => i.value));

export function isValidInsurer(value: string): value is InsurerValue {
  return INSURER_SET.has(value as InsurerValue);
}

export function getInsurerLabel(value: string): string {
  return INSURERS.find((i) => i.value === value)?.label ?? value;
}

export function filterValidInsurers(values: string[]): string[] {
  return Array.from(new Set(values.filter(isValidInsurer)));
}
