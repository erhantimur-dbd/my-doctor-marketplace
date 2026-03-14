"use client";

import { DoctorCompareProvider } from "@/hooks/use-doctor-compare";
import { CompareTray } from "@/components/doctors/compare-tray";
import { ComparisonModal } from "@/components/doctors/comparison-modal";

export function CompareProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DoctorCompareProvider>
      {children}
      <CompareTray />
      <ComparisonModal />
    </DoctorCompareProvider>
  );
}
