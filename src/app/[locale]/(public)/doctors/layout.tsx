import type { ReactNode } from "react";

/**
 * Do not wrap this tree in SoftLaunchDarkLayout.
 * That backup redirect would swallow `/doctors/:slug/book` after the
 * coming-soon gate allowlists the Soft Launch Soft CTA book deep-link.
 * Listing (`page.tsx`) and profile (`[slug]/page.tsx`) still call
 * redirectPatientMarketplaceIfSoftLaunch. Directory/profile stay gated
 * by isAllowedOnComingSoon + vercel.json (no bare `|doctors|` token).
 */
export default function DoctorsLayout({ children }: { children: ReactNode }) {
  return children;
}
