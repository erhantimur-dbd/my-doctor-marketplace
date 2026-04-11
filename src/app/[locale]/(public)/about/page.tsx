import { getRegion } from "@/lib/region";
import { AboutDefault } from "./about-default";
import { AboutUk } from "./about-uk";

export const metadata = {
  title: "About | MyDoctors360",
  description:
    "MyDoctors360 is a technology platform that connects patients with independent private doctors.",
};

/**
 * Region router for the About page. UK variant on mydoctors360.co.uk, the
 * generic variant everywhere else. Also fills in the missing /about route
 * flagged in CLAUDE.md.
 */
export default async function AboutPage() {
  const region = await getRegion();
  if (region === "uk") return <AboutUk />;
  return <AboutDefault />;
}
