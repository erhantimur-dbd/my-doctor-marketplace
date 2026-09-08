import type { ReactNode } from "react";
import { redirectPatientMarketplaceIfSoftLaunch } from "@/lib/soft-launch/redirect-patient-marketplace";

/** Layout default for patient marketplace route trees during Soft Launch. */
export default function SoftLaunchDarkLayout({
  children,
}: {
  children: ReactNode;
}) {
  redirectPatientMarketplaceIfSoftLaunch();
  return children;
}
