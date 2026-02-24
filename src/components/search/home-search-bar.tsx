"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface HomeSearchBarProps {
  specialties: { id: string; name_key: string; slug: string }[];
  locations: { id: string; city: string; country_code: string; slug: string }[];
}

export function HomeSearchBar({ specialties, locations }: HomeSearchBarProps) {
  const t = useTranslations("home");
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [location, setLocation] = useState("");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (specialty && specialty !== "all") params.set("specialty", specialty);
    if (location && location !== "all") params.set("location", location);

    const qs = params.toString();
    router.push(`/doctors${qs ? `?${qs}` : ""}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Desktop layout */}
      <div className="hidden md:flex items-center gap-0 rounded-full border bg-background shadow-lg transition-shadow hover:shadow-xl overflow-hidden">
        {/* Text input */}
        <div className="flex items-center gap-2 flex-1 pl-5 pr-2">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("search_name_placeholder")}
            className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border" />

        {/* Specialty */}
        <div className="w-44">
          <Select value={specialty} onValueChange={setSpecialty}>
            <SelectTrigger className="h-14 border-0 shadow-none rounded-none focus:ring-0 text-sm">
              <SelectValue placeholder={t("search_specialty_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("search_specialty_placeholder")}</SelectItem>
              {specialties.map((s) => (
                <SelectItem key={s.id} value={s.slug}>
                  {s.name_key
                    .replace("specialty.", "")
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border" />

        {/* Location */}
        <div className="w-44">
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger className="h-14 border-0 shadow-none rounded-none focus:ring-0 text-sm">
              <SelectValue placeholder={t("search_location_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("search_location_placeholder")}</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.slug}>
                  {l.city}, {l.country_code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search button */}
        <div className="pr-2">
          <Button
            size="lg"
            className="rounded-full px-6"
            onClick={handleSearch}
          >
            <Search className="mr-2 h-4 w-4" />
            {t("search_button")}
          </Button>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex md:hidden flex-col gap-3 rounded-2xl border bg-background p-4 shadow-lg">
        {/* Text input */}
        <div className="flex items-center gap-2 rounded-lg border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("search_name_placeholder")}
            className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Specialty */}
        <Select value={specialty} onValueChange={setSpecialty}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder={t("search_specialty_placeholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("search_specialty_placeholder")}</SelectItem>
            {specialties.map((s) => (
              <SelectItem key={s.id} value={s.slug}>
                {s.name_key
                  .replace("specialty.", "")
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (l: string) => l.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Location */}
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder={t("search_location_placeholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("search_location_placeholder")}</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.slug}>
                {l.city}, {l.country_code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search button */}
        <Button className="h-11 w-full rounded-lg" onClick={handleSearch}>
          <Search className="mr-2 h-4 w-4" />
          {t("search_button")}
        </Button>
      </div>
    </div>
  );
}
