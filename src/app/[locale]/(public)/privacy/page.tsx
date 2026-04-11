import { getRegion } from "@/lib/region";
import { PrivacyDefault } from "./privacy-default";
import { PrivacyUk } from "./privacy-uk";

export const metadata = {
  title: "Privacy Policy | MyDoctors360",
  description: "Privacy policy for MyDoctors360 healthcare marketplace.",
};

/**
 * Region router for Privacy Policy. UK variant on mydoctors360.co.uk, the
 * existing cross-region variant everywhere else. See `src/lib/region.ts`.
 */
export default async function PrivacyPolicyPage() {
  const region = await getRegion();
  if (region === "uk") return <PrivacyUk />;
  return <PrivacyDefault />;
}
