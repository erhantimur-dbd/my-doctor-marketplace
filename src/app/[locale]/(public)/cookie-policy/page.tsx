import { getRegion } from "@/lib/region";
import { CookiePolicyDefault } from "./cookie-policy-default";
import { CookiePolicyUk } from "./cookie-policy-uk";

export const metadata = {
  title: "Cookie Policy | MyDoctors360",
  description: "Cookie policy for MyDoctors360 healthcare marketplace.",
};

/**
 * Region router for Cookie Policy. UK variant on mydoctors360.co.uk, the
 * existing cross-region variant everywhere else. See `src/lib/region.ts`.
 */
export default async function CookiePolicyPage() {
  const region = await getRegion();
  if (region === "uk") return <CookiePolicyUk />;
  return <CookiePolicyDefault />;
}
