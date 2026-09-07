import { redirectPatientMarketplaceIfSoftLaunch } from "@/lib/soft-launch/redirect-patient-marketplace";

/** Layout default for patient marketplace route trees during Soft Launch. */
export default function SoftLaunchDarkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  redirectPatientMarketplaceIfSoftLaunch();
  return children;
}
