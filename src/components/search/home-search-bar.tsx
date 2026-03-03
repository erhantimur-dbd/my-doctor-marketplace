"use client";

import { useState, useEffect, useRef, useCallback, useTransition, useMemo } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
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
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGeolocation } from "@/hooks/use-geolocation";
import { findNearestLocation } from "@/lib/utils/geo";
import { searchSuggestions } from "@/actions/search";
import type { DoctorSuggestion } from "@/actions/search";
import { analyzeSymptoms, parseNaturalLanguageSearch } from "@/actions/ai";
import type { SymptomAnalysis } from "@/lib/ai/schemas";
import { getSpecialtyColor } from "@/lib/constants/specialty-colors";
import { SYMPTOMS } from "@/lib/constants/symptoms";
import { MEDICAL_TESTS } from "@/lib/constants/medical-tests";
import { matchSymptoms, matchTests } from "@/lib/utils/search-matcher";
import type { SearchMatch } from "@/lib/utils/search-matcher";
import { shouldUseNLSearch, countWords } from "@/lib/utils/nl-search-detector";
import { AISymptomResult } from "@/components/search/ai-symptom-result";
import { EmergencyWarning } from "@/components/shared/emergency-warning";

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
  initialQuery?: string;
  initialLocation?: string;
  initialConsultationType?: "all" | "in_person" | "video";
  compact?: boolean;
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
  | { type: "gp_fallback" }
  | { type: "ai_symptom"; analysis: SymptomAnalysis }
  | { type: "nl_search" };

export function HomeSearchBar({
  specialties,
  locations,
  initialQuery = "",
  initialLocation = "",
  initialConsultationType = "all",
  compact = false,
}: HomeSearchBarProps) {
  const t = useTranslations("home");
  const tSpec = useTranslations("specialty");
  const tSymptom = useTranslations("symptom");
  const tTest = useTranslations("test");
  const tAi = useTranslations("ai");
  const locale = useLocale();
  const router = useRouter();

  const [query, setQuery] = useState(initialQuery);
  const [location, setLocation] = useState(initialLocation);
  const [consultationType, setConsultationType] = useState<"all" | "in_person" | "video">(initialConsultationType);
  const [hasManuallySelected, setHasManuallySelected] = useState(!!initialLocation);

  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [doctorResults, setDoctorResults] = useState<DoctorSuggestion[]>([]);
  const [isPending, startTransition] = useTransition();
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // AI state
  const [aiSymptomResult, setAiSymptomResult] = useState<SymptomAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showNLOption, setShowNLOption] = useState(false);
  const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // AI: detect NL search queries and trigger symptom analysis fallback
  useEffect(() => {
    if (!isSearchMode) {
      setAiSymptomResult(null);
      setShowNLOption(false);
      setAiLoading(false);
      return;
    }

    const trimmed = query.trim();

    // Check if this looks like a natural language search
    setShowNLOption(shouldUseNLSearch(trimmed));

    // Trigger AI symptom analysis when keyword matcher finds nothing
    // and the input looks like a symptom description (3+ words).
    // NL search option can coexist — user sees both the AI symptom result
    // and the "Search with AI" button, letting them choose.
    const hasKeywordMatches = symptomMatches.length > 0 || testMatches.length > 0;
    const wordCount = countWords(trimmed);
    const shouldTryAI = !hasKeywordMatches && wordCount >= 3;

    if (!shouldTryAI) {
      setAiSymptomResult(null);
      setAiLoading(false);
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
      return;
    }

    // Debounce AI calls (800ms)
    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    setAiLoading(true);
    aiDebounceRef.current = setTimeout(async () => {
      try {
        const result = await analyzeSymptoms(trimmed, locale);
        if (result.data) {
          setAiSymptomResult(result.data);
        } else {
          setAiSymptomResult(null);
        }
      } catch {
        setAiSymptomResult(null);
      } finally {
        setAiLoading(false);
      }
    }, 800);

    return () => {
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    };
  }, [query, isSearchMode, symptomMatches.length, testMatches.length, locale]);

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
        // Populate search field so user can pick consultation type before searching
        setQuery(
          item.label
            .replace("specialty.", "")
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l: string) => l.toUpperCase())
        );
        break;
      case "doctor":
        // Doctor links still navigate directly to their profile
        router.push(`/doctors/${item.slug}`);
        break;
      case "symptom":
      case "test": {
        const label =
          item.type === "symptom"
            ? tSymptom(item.labelKey.replace("symptom.", ""))
            : tTest(item.labelKey.replace("test.", ""));
        setQuery(label);
        break;
      }
      case "gp_fallback":
        setQuery("General Practice");
        break;
      case "ai_symptom": {
        // Navigate to search with AI-suggested specialty and consultation type
        setShowSuggestions(false);
        const params = new URLSearchParams();
        params.set("specialty", item.analysis.primarySpecialty);
        if (item.analysis.suggestedConsultationType !== "either") {
          params.set("consultationType", item.analysis.suggestedConsultationType);
        }
        if (location && location !== "all") params.set("location", location);
        router.push(`/doctors?${params.toString()}`);
        break;
      }
      case "nl_search": {
        // Trigger NL search parsing
        setShowSuggestions(false);
        handleNLSearch();
        break;
      }
    }
  };

  // Handle Natural Language Search
  const handleNLSearch = useCallback(async () => {
    setAiLoading(true);
    try {
      const result = await parseNaturalLanguageSearch(query.trim(), locale);
      if (result.data) {
        const params = new URLSearchParams();
        if (result.data.specialty) params.set("specialty", result.data.specialty);
        if (result.data.location) params.set("location", result.data.location);
        if (result.data.language) params.set("language", result.data.language);
        if (result.data.maxPrice) params.set("maxPrice", String(result.data.maxPrice / 100));
        if (result.data.minRating) params.set("minRating", String(result.data.minRating));
        if (result.data.consultationType) params.set("consultationType", result.data.consultationType);
        if (result.data.query) params.set("query", result.data.query);
        if (location && location !== "all" && !result.data.location) params.set("location", location);
        params.set("aiParsed", "true");
        router.push(`/doctors?${params.toString()}`);
      } else {
        // Fallback to regular search
        handleSearch();
      }
    } catch {
      handleSearch();
    } finally {
      setAiLoading(false);
    }
  }, [query, locale, location, router, handleSearch]);

  // Smart search: use NL parser when AI detects natural language, otherwise basic search
  const handleSmartSearch = useCallback(() => {
    if (showNLOption) {
      handleNLSearch();
    } else {
      handleSearch();
    }
  }, [showNLOption, handleNLSearch, handleSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || allSuggestions.length === 0) {
      if (e.key === "Enter") handleSmartSearch();
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
          handleSmartSearch();
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
      showGpFallback ||
      aiLoading ||
      aiSymptomResult !== null ||
      showNLOption);

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
                  <span>{tSpec(slugToSpecialtyKey(s.slug))}</span>
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
        {showGpFallback && !aiSymptomResult && !aiLoading && (
          <div className="p-1">
            <div className="mx-2 border-t" />
            {(() => {
              itemIndex++;
              return renderGpFallback(itemIndex);
            })()}
          </div>
        )}

        {/* AI Symptom Analysis */}
        {(aiLoading || aiSymptomResult) && (
          <div className="p-1">
            <div className="mx-2 border-t" />
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              {tAi("suggestion")}
            </div>
            {aiLoading && !aiSymptomResult && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tAi("analyzing")}
              </div>
            )}
            {aiSymptomResult && aiSymptomResult.urgency === "emergency" && (
              <div className="px-2 pb-2">
                <EmergencyWarning locale={locale} reason={aiSymptomResult.urgencyReason} />
              </div>
            )}
            {aiSymptomResult && (() => {
              const AiSpecIcon = specialtyIconMap[aiSymptomResult.primarySpecialty] || Stethoscope;
              const aiSc = getSpecialtyColor(aiSymptomResult.primarySpecialty);
              return (
                <div className="px-2 pb-1">
                  <AISymptomResult
                    analysis={aiSymptomResult}
                    specialtyLabel={tSpec(slugToSpecialtyKey(aiSymptomResult.primarySpecialty))}
                    onSelect={() =>
                      handleSelectSuggestion({ type: "ai_symptom", analysis: aiSymptomResult })
                    }
                    icon={AiSpecIcon}
                    iconBg={aiSc.bg}
                    iconColor={aiSc.text}
                  />
                </div>
              );
            })()}
          </div>
        )}

        {/* NL Search option */}
        {showNLOption && !aiLoading && (
          <div className="px-3 pb-2 pt-1">
            <div className="mb-2 border-t" />
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-full border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm transition-colors hover:bg-primary/10 hover:border-primary/30"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectSuggestion({ type: "nl_search" });
              }}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </span>
                <span className="font-medium text-primary">{tAi("try_ai_search")}</span>
              </div>
              <span className="text-xs text-muted-foreground">{tAi("powered_by_ai")}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("mx-auto", compact ? "max-w-full" : "max-w-3xl")} ref={wrapperRef}>
      {/* Desktop layout */}
      <div className="relative hidden md:block">
        <div className={cn("flex items-center gap-0 rounded-full border bg-background overflow-hidden", compact ? "shadow-md" : "shadow-lg transition-shadow hover:shadow-xl")}>
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
              className={cn("flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground", compact ? "h-12" : "h-14")}
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
              onEnterKey={handleSmartSearch}
            />
          </div>

          {/* Search button */}
          <div className="pr-2">
            <Button
              size="lg"
              className="rounded-full px-6"
              onClick={handleSmartSearch}
            >
              <Search className="mr-2 h-4 w-4" />
              {t("search_button")}
            </Button>
          </div>
        </div>

        {!compact && (
          <>
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

            {/* AI search hint — desktop */}
            <p className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70">
              <Sparkles className="h-3 w-3 shrink-0" />
              <span>{t("ai_search_hint")}</span>
            </p>
          </>
        )}

        {/* Autocomplete dropdown — desktop */}
        {renderDropdown()}
      </div>

      {/* Mobile layout */}
      <div className={cn("relative flex md:hidden flex-col gap-3 rounded-2xl border bg-background", compact ? "p-3 shadow-md" : "p-4 shadow-lg")}>
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
                      <span>{tSpec(slugToSpecialtyKey(s.slug))}</span>
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
            {showGpFallback && !aiSymptomResult && !aiLoading && (
              <div className="p-1">
                <div className="mx-2 border-t" />
                {renderGpFallback(-1, { mobile: true })}
              </div>
            )}

            {/* AI Symptom Analysis (mobile) */}
            {(aiLoading || aiSymptomResult) && (
              <div className="p-1">
                <div className="mx-2 border-t" />
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  {tAi("suggestion")}
                </div>
                {aiLoading && !aiSymptomResult && (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tAi("analyzing")}
                  </div>
                )}
                {aiSymptomResult && aiSymptomResult.urgency === "emergency" && (
                  <div className="px-2 pb-2">
                    <EmergencyWarning locale={locale} reason={aiSymptomResult.urgencyReason} />
                  </div>
                )}
                {aiSymptomResult && (() => {
                  const AiSpecIcon = specialtyIconMap[aiSymptomResult.primarySpecialty] || Stethoscope;
                  const aiSc = getSpecialtyColor(aiSymptomResult.primarySpecialty);
                  return (
                    <div className="px-2 pb-1">
                      <AISymptomResult
                        analysis={aiSymptomResult}
                        specialtyLabel={tSpec(slugToSpecialtyKey(aiSymptomResult.primarySpecialty))}
                        onSelect={() =>
                          handleSelectSuggestion({ type: "ai_symptom", analysis: aiSymptomResult })
                        }
                        icon={AiSpecIcon}
                        iconBg={aiSc.bg}
                        iconColor={aiSc.text}
                      />
                    </div>
                  );
                })()}
              </div>
            )}

            {/* NL Search option (mobile) */}
            {showNLOption && !aiLoading && (
              <div className="px-3 pb-2 pt-1">
                <div className="mb-2 border-t" />
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-full border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm active:bg-primary/10"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion({ type: "nl_search" });
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </span>
                    <span className="font-medium text-primary">{tAi("try_ai_search")}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{tAi("powered_by_ai")}</span>
                </button>
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
          onEnterKey={handleSmartSearch}
        />

        {!compact && (
          <>
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

            {/* AI search hint — mobile */}
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70 text-center leading-snug px-2">
              <Sparkles className="h-3 w-3 shrink-0" />
              <span>{t("ai_search_hint")}</span>
            </p>
          </>
        )}

        {/* Search button */}
        <Button className="h-11 w-full rounded-lg" onClick={handleSmartSearch}>
          <Search className="mr-2 h-4 w-4" />
          {t("search_button")}
        </Button>
      </div>
    </div>
  );
}
