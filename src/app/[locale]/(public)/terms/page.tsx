import { getRegion } from "@/lib/region";
import { TermsDefault } from "./terms-default";
import { TermsUk } from "./terms-uk";

export const metadata = {
  title: "Terms of Service | MyDoctors360",
  description: "Terms of service for using the MyDoctors360 healthcare marketplace.",
};

/**
 * Region router for Terms of Service.
 *
 * Serves `TermsUk` on mydoctors360.co.uk and `TermsDefault` everywhere else
 * (.com, .eu, previews, localhost). See `src/lib/region.ts` for the detection
 * logic and the non-production `X-Preview-Region` override.
 */
export default async function TermsOfServicePage() {
  const region = await getRegion();
  if (region === "uk") return <TermsUk />;
  return <TermsDefault />;
}
