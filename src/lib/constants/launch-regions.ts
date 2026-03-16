/**
 * Launch regions — countries where MyDoctors360 is live for in-person appointments.
 * Video consultations are available globally regardless of region.
 *
 * Update this list as we expand to new markets.
 */

export const LAUNCH_REGION_CODES = ["GB", "IE", "IT", "TR", "ES"] as const;

export type LaunchRegionCode = (typeof LAUNCH_REGION_CODES)[number];

export const LAUNCH_REGIONS: {
  code: LaunchRegionCode;
  name: string;
  flag: string;
}[] = [
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "TR", name: "Türkiye", flag: "🇹🇷" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
];

/** Check if a country code is in a launch region */
export function isLaunchRegion(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false;
  return (LAUNCH_REGION_CODES as readonly string[]).includes(
    countryCode.toUpperCase()
  );
}
