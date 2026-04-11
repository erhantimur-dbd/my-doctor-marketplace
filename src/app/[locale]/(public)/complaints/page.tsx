import { notFound } from "next/navigation";
import { isRegion } from "@/lib/region";
import { ComplaintsUk } from "./complaints-uk";

export const metadata = {
  title: "Complaints | MyDoctors360",
  description:
    "How to raise a concern about MyDoctors360 or about the clinical care you received through the platform, in the United Kingdom.",
};

/**
 * UK-only /complaints page.
 *
 * Returns 404 on non-UK hosts. On `.co.uk` it renders the ComplaintsUk
 * component, which separates platform complaints from clinical complaints
 * and signposts to GMC, CQC, ICO, and ISCAS as appropriate.
 */
export default async function ComplaintsPage() {
  if (!(await isRegion("uk"))) notFound();
  return <ComplaintsUk />;
}
