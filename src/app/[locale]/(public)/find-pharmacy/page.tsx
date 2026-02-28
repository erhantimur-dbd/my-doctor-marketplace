import { Badge } from "@/components/ui/badge";
import { Pill } from "lucide-react";
import { PharmacySearch } from "@/components/pharmacy/pharmacy-search";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find a Pharmacy | MyDoctor",
  description:
    "Search for NHS pharmacies near you by postcode. Find opening hours, addresses, and phone numbers for pharmacies across the UK.",
};

export default function FindPharmacyPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <div className="container mx-auto text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Pill className="h-7 w-7 text-primary" />
          </div>
          <Badge variant="secondary" className="mb-4">
            NHS Pharmacy Finder
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Find a Pharmacy
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Search for NHS pharmacies near you. Enter your UK postcode to find
            addresses, opening hours, and contact details.
          </p>
        </div>
      </section>

      {/* Search + Results */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto">
          <PharmacySearch />
        </div>
      </section>
    </>
  );
}
