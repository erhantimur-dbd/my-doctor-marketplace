export const LOCATION_FACILITIES = [
  { value: "wheelchair_accessible", label: "Wheelchair accessible" },
  { value: "free_parking", label: "Free parking" },
  { value: "paid_parking", label: "Paid parking" },
  { value: "disabled_parking", label: "Disabled parking" },
  { value: "lift_access", label: "Lift access" },
  { value: "public_transport", label: "Near public transport" },
  { value: "step_free", label: "Step-free access" },
  { value: "hearing_loop", label: "Hearing loop" },
  { value: "toilet_accessible", label: "Accessible toilet" },
] as const;

export type LocationFacility = (typeof LOCATION_FACILITIES)[number]["value"];

const FACILITY_SET = new Set(LOCATION_FACILITIES.map((f) => f.value));

export function isValidFacility(value: string): value is LocationFacility {
  return FACILITY_SET.has(value as LocationFacility);
}

export function getFacilityLabel(value: string): string {
  return LOCATION_FACILITIES.find((f) => f.value === value)?.label ?? value;
}

export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export type DayHours = { open: string; close: string } | null;
export type OpeningHours = Partial<Record<WeekdayKey, DayHours>>;
