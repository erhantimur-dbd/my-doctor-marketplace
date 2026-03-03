"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import type { NLSearchFilters } from "@/lib/ai/schemas";

interface NLSearchIndicatorProps {
  filters: NLSearchFilters;
  onClear: () => void;
}

export function NLSearchIndicator({
  filters,
  onClear,
}: NLSearchIndicatorProps) {
  const t = useTranslations("ai");
  const ts = useTranslations("specialty");

  const chips: { label: string; key: string }[] = [];

  if (filters.specialty) {
    const specKey = filters.specialty.replace(/-/g, "_");
    try {
      chips.push({ label: ts(specKey), key: "specialty" });
    } catch {
      chips.push({
        label: filters.specialty.replace(/-/g, " "),
        key: "specialty",
      });
    }
  }
  if (filters.location) {
    chips.push({ label: filters.location.replace(/-/g, " "), key: "location" });
  }
  if (filters.language) {
    chips.push({ label: filters.language, key: "language" });
  }
  if (filters.maxPrice) {
    chips.push({
      label: `≤ €${(filters.maxPrice / 100).toFixed(0)}`,
      key: "price",
    });
  }
  if (filters.minRating) {
    chips.push({ label: `${filters.minRating}+ ★`, key: "rating" });
  }
  if (filters.consultationType) {
    chips.push({
      label: filters.consultationType === "video" ? "Video" : "In-person",
      key: "type",
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        <span className="font-medium">{t("search_parsed")}</span>
      </div>

      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="text-xs capitalize"
        >
          {chip.label}
        </Badge>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="ml-auto h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <X className="mr-1 h-3 w-3" />
        {t("clear_ai_filters")}
      </Button>
    </div>
  );
}
