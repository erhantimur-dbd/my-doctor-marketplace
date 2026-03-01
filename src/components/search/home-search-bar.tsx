"use client";

import { useState, useEffect, useRef, useCallback, useTransition, useMemo } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LocationCombobox } from "@/components/search/location-combobox";
import {
  Search,
  MapPin,
  Loader2,
  Stethoscope,
  User,
  Heart,
  Brain,
  Eye,
  Smile,
  Baby,
  Activity,
  Wind,
  Shield,
  Apple,
  Droplets,
  Ear,
  Flower,
  Scan,
  Thermometer,
  TestTube2,
  Building2,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGeolocation } from "@/hooks/use-geolocation";
import { findNearestLocation } from "@/lib/utils/geo";
import { searchSuggestions } from "@/actions/search";
import type { DoctorSuggestion } from "@/actions/search";
import { getSpecialtyColor } from "@/lib/constants/specialty-colors";
import { SYMPTOMS } from "@/lib/constants/symptoms";
import { MEDICAL_TESTS } from "@/lib/constants/medical-tests";
import { matchSymptoms, matchTests } from "@/lib/utils/search-matcher";
import type { SearchMatch } from "@/lib/utils/search-matcher";

/* ── Slug → Icon map (matches homepage + specialties page) ─ */
const specialtyIconMap: Record<string, React.ElementType> = {
  "general-practice": Stethoscope,
  cardiology: Heart,
  dermatology: Flower,
  orthopedics: Activity,
  neurology: Brain,
  psychiatry: Brain,
  psychology: Heart,
  ophthalmology: Eye,
  ent: Ear,
  gynecology: Baby,
  urology: Activity,
  gastroenterology: Apple,
  endocrinology: Droplets,
  pulmonology: Wind,
  oncology: Shield,
  pediatrics: Baby,
  dentistry: Smile,
  "aesthetic-medicine": Flower,
  physiotherapy: Activity,
  radiology: Scan,
  nutrition: Apple,
  allergy: Flower,
  rheumatology: Activity,
  nephrology: Droplets,
};

/** Convert specialty slug to i18n key: "general-practice" → "general_practice" */
function slugToSpecialtyKey(slug: string) {
  return slug.replace(/-/g, "_");
}

interface HomeSearchBarProps {
  specialties: { id: string; name_key: string; slug: string }[];
  locations: {
    id: string;
    city: string;
    country_code: string;
    slug: string;
    latitude: number | null;
    longitude: number | null;
  }[];
}

// Popular specialties shown on focus before typing
const POPULAR_SLUGS = [
  "general-practice",
  "dentistry",
  "gynecology",
  "orthopedics",
  "nutrition",
  "psychology",
  "ophthalmology",
];

type SuggestionItem =
  | { type: "specialty"; slug: string; label: string }
  | { type: "doctor"; slug: string; label: string; sub?: string }
  | { type: "symptom"; id: string; labelKey: string; specialtySlug: string; score: number }
  | { type: "test"; id: string; labelKey: string; specialtySlug: string; score: number }
  | { type: "gp_fallback" };

export function HomeSearchBar({ specialties, locations }: HomeSearchBarProps) {
  const t = useTranslations("home");
  const tSpec = useTranslations("specialty");
  const tSymptom = useTranslations("symptom");
  const tTest = useTranslations("test");
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [consultationType, setConsultationType] = useState<"all" | "in_person" | "video">("all");
  const [hasManuallySelected, setHasManuallySelected] = useState(false);

  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [doctorResults, setDoctorResults] = useState<DoctorSuggestion[]>([]);
  const [isPending, startTransition] = useTransition();
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Popular specialties (resolved from the specialties prop)
  const popularSpecialties = POPULAR_SLUGS
    .map((slug) => specialties.find((s) => s.slug === slug))
    .filter(Boolean) as typeof specialties;

  const geo = useGeolocation("auto");

  // Auto-select nearest location when GPS coords arrive
  useEffect(() => {
    if (
      geo.latitude !== null &&
      geo.longitude !== null &&
      !hasManuallySelected &&
      !location
    ) {
      const nearest = findNearestLocation(
        { latitude: geo.latitude, longitude: geo.longitude },
        locations
      );
      if (nearest) {
        setLocation(nearest);
      }
    }
  }, [geo.latitude, geo.longitude, hasManuallySelected, location, locations]);

  // Filter specialties client-side
  const filteredSpecialties =
    query.trim().length >= 2
      ? specialties.filter((s) => {
          const label = s.name_key
            .replace("specialty.", "")
            .replace(/_/g, " ");
          return label.toLowerCase().includes(query.trim().toLowerCase());
        })
      : [];

  // Whether we're in "popular" mode (empty input, just focused) vs "search" mode (typing)
  const isSearchMode = query.trim().length >= 2;

  // Match symptoms and tests client-side
  const symptomMatches = useMemo(
    () => (isSearchMode ? matchSymptoms(query, SYMPTOMS, 3) : []),
    [query, isSearchMode]
  );
  const testMatches = useMemo(
    () => (isSearchMode ? matchTests(query, MEDICAL_TESTS, 3) : []),
    [query, isSearchMode]
  );

  // Debounced doctor search
  useEffect(() => {
    if (!isSearchMode) {
      setDoctorResults([]);
      return;
    }

    setHighlightIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const results = await searchSuggestions(query.trim());
        setDoctorResults(results);
      });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isSearchMode]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Which specialties to show in the dropdown
  const displaySpecialties = isSearchMode
    ? filteredSpecialties.slice(0, 3) // Reduced from 5 to 3 to keep dropdown compact
    : popularSpecialties;

  // Show GP fallback when query >= 3 chars but no symptom/test matches found
  const showGpFallback =
    isSearchMode &&
    query.trim().length >= 3 &&
    symptomMatches.length === 0 &&
    testMatches.length === 0;

  // Build flat suggestion list for keyboard navigation
  const allSuggestions: SuggestionItem[] = useMemo(() => {
    const items: SuggestionItem[] = [];
    // Specialties
    for (const s of displaySpecialties) {
      items.push({
        type: "specialty",
        slug: s.slug,
        label: s.name_key
          .replace("specialty.", "")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l: string) => l.toUpperCase()),
      });
    }
    // Symptoms
    for (const m of symptomMatches) {
      items.push(m);
    }
    // Tests
    for (const m of testMatches) {
      items.push(m);
    }
    // Doctors
    for (const d of doctorResults) {
      items.push({
        type: "doctor",
        slug: d.slug,
        label: d.name,
        sub: d.specialty,
      });
    }
    // GP fallback
    if (showGpFallback) {
      items.push({ type: "gp_fallback" });
    }
    return items;
  }, [displaySpecialties, symptomMatches, testMatches, doctorResults, showGpFallback]);

  const handleLocationChange = (value: string) => {
    setHasManuallySelected(true);
    setLocation(value);
  };

  const handleLocateClick = () => {
    setHasManuallySelected(false);
    geo.requestPosition();
  };

  const handleSearch = useCallback(() => {
    setShowSuggestions(false);
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (location && location !== "all") params.set("location", location);
    if (consultationType !== "all") params.set("consultationType", consultationType);
    const qs = params.toString();
    router.push(`/doctors${qs ? `?${qs}` : ""}`);
  }, [query, location, consultationType, router]);

  const navigateToSpecialty = useCallback(
    (slug: string) => {
      setShowSuggestions(false);
      router.push(`/specialties/${slug}`);
    },
    [router]
  );

  const handleSelectSuggestion = (item: SuggestionItem) => {
    setShowSuggestions(false);
    switch (item.type) {
      case "specialty":
        navigateToSpecialty(item.slug);
        break;
      case "doctor":
        router.push(`/doctors/${item.slug}`);
        break;
      case "symptom":
      case "test":
        navigateToSpecialty(item.specialtySlug);
        break;
      case "gp_fallback":
        navigateToSpecialty("general-practice");
        break;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || allSuggestions.length === 0) {
      if (e.key === "Enter") handleSearch();
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < allSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : allSuggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < allSuggestions.length) {
          handleSelectSuggestion(allSuggestions[highlightIndex]);
        } else {
          handleSearch();
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setHighlightIndex(-1);
        break;
    }
  };

  const hasSuggestions =
    showSuggestions &&
    (displaySpecialties.length > 0 ||
      symptomMatches.length > 0 ||
      testMatches.length > 0 ||
      doctorResults.length > 0 ||
      isPending ||
      showGpFallback);

  /** Render a symptom/test match row */
  const renderMatchRow = (
    item: SearchMatch,
    idx: number,
    icon: React.ElementType,
    options?: { mobile?: boolean }
  ) => {
    const Icon = icon;
    const label =
      item.type === "symptom"
        ? tSymptom(item.labelKey.replace("symptom.", ""))
        : tTest(item.labelKey.replace("test.", ""));
    const specLabel = tSpec(slugToSpecialtyKey(item.specialtySlug));
    const SpecIcon = specialtyIconMap[item.specialtySlug] || Stethoscope;
    const sc = getSpecialtyColor(item.specialtySlug);

    return (
      <button
        key={item.id}
        type="button"
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 ${options?.mobile ? "py-2.5 active:bg-accent/50" : `py-2 transition-colors ${
          highlightIndex === idx
            ? "bg-accent text-accent-foreground"
            : "hover:bg-accent/50"
        }`} text-sm`}
        onMouseEnter={options?.mobile ? undefined : () => setHighlightIndex(idx)}
        onMouseDown={(e) => {
          e.preventDefault();
          handleSelectSuggestion(item);
        }}
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          item.type === "symptom" ? "bg-orange-50" : "bg-purple-50"
        }`}>
          <Icon className={`h-3.5 w-3.5 ${
            item.type === "symptom" ? "text-orange-600" : "text-purple-600"
          }`} />
        </span>
        <span className="truncate">{label}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <span>→</span>
          <span className={`flex h-4 w-4 items-center justify-center rounded ${sc.bg}`}>
            <SpecIcon className={`h-2.5 w-2.5 ${sc.text}`} />
          </span>
          <span>{specLabel}</span>
        </span>
      </button>
    );
  };

  /** Render the GP fallback CTA */
  const renderGpFallback = (idx: number, options?: { mobile?: boolean }) => (
    <button
      type="button"
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 ${options?.mobile ? "py-2.5 active:bg-accent/50" : `py-2 transition-colors ${
        highlightIndex === idx
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50"
      }`} text-sm`}
      onMouseEnter={options?.mobile ? undefined : () => setHighlightIndex(idx)}
      onMouseDown={(e) => {
        e.preventDefault();
        handleSelectSuggestion({ type: "gp_fallback" });
      }}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
        <Stethoscope className="h-3.5 w-3.5 text-emerald-600" />
      </span>
      <span className="text-muted-foreground">{t("suggestions_see_gp")}</span>
    </button>
  );

  // Shared dropdown content (desktop)
  const renderDropdown = () => {
    if (!hasSuggestions) return null;

    let itemIndex = -1;
    const specialtiesHeading = isSearchMode
      ? t("suggestions_specialties")
      : t("suggestions_popular");

    return (
      <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border bg-background shadow-lg">
        {/* Specialties group (popular or filtered) */}
        {displaySpecialties.length > 0 && (
          <div className="p-1">
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {specialtiesHeading}
            </div>
            {displaySpecialties.map((s) => {
              itemIndex++;
              const idx = itemIndex;
              const SpecIcon = specialtyIconMap[s.slug] || Stethoscope;
              const sc = getSpecialtyColor(s.slug);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    highlightIndex === idx
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  }`}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion({
                      type: "specialty",
                      slug: s.slug,
                      label: s.name_key,
                    });
                  }}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${sc.bg}`}>
                    <SpecIcon className={`h-3.5 w-3.5 ${sc.text}`} />
                  </span>
                  <span>
                    {s.name_key
                      .replace("specialty.", "")
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Symptoms group */}
        {symptomMatches.length > 0 && (
          <div className="p-1">
            {(displaySpecialties.length > 0) && (
              <div className="mx-2 border-t" />
            )}
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {t("suggestions_symptoms")}
            </div>
            {symptomMatches.map((m) => {
              itemIndex++;
              return renderMatchRow(m, itemIndex, Thermometer);
            })}
          </div>
        )}

        {/* Tests group */}
        {testMatches.length > 0 && (
          <div className="p-1">
            {(displaySpecialties.length > 0 || symptomMatches.length > 0) && (
              <div className="mx-2 border-t" />
            )}
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {t("suggestions_tests")}
            </div>
            {testMatches.map((m) => {
              itemIndex++;
              return renderMatchRow(m, itemIndex, TestTube2);
            })}
          </div>
        )}

        {/* Doctors group (only in search mode) */}
        {isSearchMode && (doctorResults.length > 0 || isPending) && (
          <div className="p-1">
            {(displaySpecialties.length > 0 || symptomMatches.length > 0 || testMatches.length > 0) && (
              <div className="mx-2 border-t" />
            )}
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {t("suggestions_doctors")}
            </div>
            {isPending && doctorResults.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("suggestions_searching")}
              </div>
            )}
            {doctorResults.map((d) => {
              itemIndex++;
              const idx = itemIndex;
              return (
                <button
                  key={d.slug}
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    highlightIndex === idx
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  }`}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion({
                      type: "doctor",
                      slug: d.slug,
                      label: d.name,
                      sub: d.specialty,
                    });
                  }}
                >
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{d.name}</span>
                  {d.specialty && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {d.specialty}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* GP fallback */}
        {showGpFallback && (
          <div className="p-1">
            <div className="mx-2 border-t" />
            {(() => {
              itemIndex++;
              return renderGpFallback(itemIndex);
            })()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-3xl" ref={wrapperRef}>
      {/* Desktop layout */}
      <div className="relative hidden md:block">
        <div className="flex items-center gap-0 rounded-full border bg-background shadow-lg transition-shadow hover:shadow-xl overflow-hidden">
          {/* Text input */}
          <div className="flex items-center gap-2 flex-1 pl-5 pr-2">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              placeholder={t("search_name_placeholder")}
              className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoComplete="off"
            />
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-border" />

          {/* Location — searchable combobox */}
          <div className="w-56">
            <LocationCombobox
              locations={locations}
              value={location}
              onValueChange={handleLocationChange}
              placeholder={t("search_location_placeholder")}
              variant="inline"
              geoSupported={geo.supported}
              geoLoading={geo.loading}
              onUseMyLocation={handleLocateClick}
              useMyLocationLabel={t("use_my_location")}
              detectingLabel={t("detecting_location") || "Detecting..."}
              onEnterKey={handleSearch}
            />
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

        {/* Consultation type toggle — desktop */}
        <div className="flex justify-center gap-1 mt-3">
          {(["all", "in_person", "video"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setConsultationType(type)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                consultationType === type
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {type === "in_person" && <Building2 className="h-3 w-3" />}
              {type === "video" && <Video className="h-3 w-3" />}
              {type === "all" && t("all_consultation_types")}
              {type === "in_person" && t("in_person_consultation")}
              {type === "video" && t("video_consultation")}
            </button>
          ))}
        </div>

        {/* Autocomplete dropdown — desktop */}
        {renderDropdown()}
      </div>

      {/* Mobile layout */}
      <div className="relative flex md:hidden flex-col gap-3 rounded-2xl border bg-background p-4 shadow-lg">
        {/* Text input */}
        <div className="flex items-center gap-2 rounded-lg border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={mobileInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={t("search_name_placeholder")}
            className="h-11 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            autoComplete="off"
          />
        </div>

        {/* Autocomplete dropdown — mobile (positioned inside the card) */}
        {hasSuggestions && (
          <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
            {/* Specialties group (popular or filtered) */}
            {displaySpecialties.length > 0 && (
              <div className="p-1">
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {isSearchMode ? t("suggestions_specialties") : t("suggestions_popular")}
                </div>
                {displaySpecialties.map((s) => {
                  const SpecIcon = specialtyIconMap[s.slug] || Stethoscope;
                  const sc = getSpecialtyColor(s.slug);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm active:bg-accent/50"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion({
                          type: "specialty",
                          slug: s.slug,
                          label: s.name_key,
                        });
                      }}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${sc.bg}`}>
                        <SpecIcon className={`h-3.5 w-3.5 ${sc.text}`} />
                      </span>
                      <span>
                        {s.name_key
                          .replace("specialty.", "")
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Symptoms group (mobile) */}
            {symptomMatches.length > 0 && (
              <div className="p-1">
                {displaySpecialties.length > 0 && <div className="mx-2 border-t" />}
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {t("suggestions_symptoms")}
                </div>
                {symptomMatches.map((m) =>
                  renderMatchRow(m, -1, Thermometer, { mobile: true })
                )}
              </div>
            )}

            {/* Tests group (mobile) */}
            {testMatches.length > 0 && (
              <div className="p-1">
                {(displaySpecialties.length > 0 || symptomMatches.length > 0) && (
                  <div className="mx-2 border-t" />
                )}
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {t("suggestions_tests")}
                </div>
                {testMatches.map((m) =>
                  renderMatchRow(m, -1, TestTube2, { mobile: true })
                )}
              </div>
            )}

            {/* Doctors group (only in search mode) */}
            {isSearchMode && (doctorResults.length > 0 || isPending) && (
              <div className="p-1">
                {(displaySpecialties.length > 0 || symptomMatches.length > 0 || testMatches.length > 0) && (
                  <div className="mx-2 border-t" />
                )}
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {t("suggestions_doctors")}
                </div>
                {isPending && doctorResults.length === 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("suggestions_searching")}
                  </div>
                )}
                {doctorResults.map((d) => (
                  <button
                    key={d.slug}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm active:bg-accent/50"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion({
                        type: "doctor",
                        slug: d.slug,
                        label: d.name,
                        sub: d.specialty,
                      });
                    }}
                  >
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{d.name}</span>
                    {d.specialty && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {d.specialty}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* GP fallback (mobile) */}
            {showGpFallback && (
              <div className="p-1">
                <div className="mx-2 border-t" />
                {renderGpFallback(-1, { mobile: true })}
              </div>
            )}
          </div>
        )}

        {/* Location — searchable combobox */}
        <LocationCombobox
          locations={locations}
          value={location}
          onValueChange={handleLocationChange}
          placeholder={t("search_location_placeholder")}
          variant="bordered"
          geoSupported={geo.supported}
          geoLoading={geo.loading}
          onUseMyLocation={handleLocateClick}
          useMyLocationLabel={t("use_my_location")}
          detectingLabel={t("detecting_location") || "Detecting..."}
          onEnterKey={handleSearch}
        />

        {/* Consultation type toggle — mobile */}
        <div className="flex justify-center gap-1">
          {(["all", "in_person", "video"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setConsultationType(type)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                consultationType === type
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {type === "in_person" && <Building2 className="h-3.5 w-3.5" />}
              {type === "video" && <Video className="h-3.5 w-3.5" />}
              {type === "all" && t("all_consultation_types")}
              {type === "in_person" && t("in_person_consultation")}
              {type === "video" && t("video_consultation")}
            </button>
          ))}
        </div>

        {/* Search button */}
        <Button className="h-11 w-full rounded-lg" onClick={handleSearch}>
          <Search className="mr-2 h-4 w-4" />
          {t("search_button")}
        </Button>
      </div>
    </div>
  );
}
