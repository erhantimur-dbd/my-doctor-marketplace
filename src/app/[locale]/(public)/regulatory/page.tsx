import { notFound } from "next/navigation";
import { isRegion } from "@/lib/region";
import { RegulatoryUk } from "./regulatory-uk";

export const metadata = {
  title: "Regulatory Status | MyDoctors360",
  description:
    "How MyDoctors360 is regulated in the United Kingdom, how each listed doctor is regulated, and how to verify them on the GMC register and CQC directory.",
};

/**
 * UK-only /regulatory page.
 *
 * Returns 404 on `.com`, `.eu`, localhost, and any preview host that does
 * not resolve to UK via `getRegion()`. On `.co.uk` it renders the
 * RegulatoryUk component. This keeps .com/.eu sitemaps and search indexes
 * free of a UK-specific page that would otherwise mislead non-UK visitors.
 */
export default async function RegulatoryPage() {
  if (!(await isRegion("uk"))) notFound();
  return <RegulatoryUk />;
}
