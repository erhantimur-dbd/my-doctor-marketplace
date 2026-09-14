import { isDemoSite } from "@/lib/site-mode";

export function DemoBanner() {
  if (!isDemoSite()) return null;

  return (
    <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
      Demo — fictional doctors, test cards only. Not the live service.
    </div>
  );
}
