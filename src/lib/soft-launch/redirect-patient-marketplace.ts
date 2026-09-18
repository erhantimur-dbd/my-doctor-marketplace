import { redirect } from "next/navigation";
import { SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME } from "@/lib/constants/company";

/**
 * Preview backup for vercel.json (host-scoped to prod). Same target as the
 * Soft Launch rewrite: coming-soon, not a live patient directory.
 * Call from listing/profile pages only — not /doctors/:slug/book.
 */
export function redirectPatientMarketplaceIfSoftLaunch(): void {
  if (SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME) {
    redirect("/coming-soon/index.html");
  }
}
