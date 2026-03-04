"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal, FlaskConical, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/constants/payment-methods";

/** Language names as stored in doctors.languages TEXT[] column */
const DOCTOR_LANGUAGES = [
  "English",
  "German",
  "Turkish",
  "French",
  "Dutch",
  "Spanish",
  "Italian",
  "Arabic",
  "Russian",
  "Hindi",
  "Japanese",
  "Welsh",
  "Scottish Gaelic",
  "Gujarati",
  "Punjabi",
] as const;

interface MoreFiltersDialogProps {
  currentFilters: Record<string, string | undefined>;
  updateFilter: (key: string, value: string | undefined) => void;
  moreFilterCount: number;
  clearMoreFilters: () => void;
}

export function MoreFiltersDialog({
  currentFilters,
  updateFilter,
  moreFilterCount,
  clearMoreFilters,
}: MoreFiltersDialogProps) {
  const t = useTranslations("search");
  const [open, setOpen] = useState(false);

  // Local state for price inputs with debounce
  const [localMinPrice, setLocalMinPrice] = useState(
    currentFilters.minPrice || ""
  );
  const [localMaxPrice, setLocalMaxPrice] = useState(
    currentFilters.maxPrice || ""
  );

  // Sync from URL params when they change externally
  useEffect(() => {
    setLocalMinPrice(currentFilters.minPrice || "");
  }, [currentFilters.minPrice]);
  useEffect(() => {
    setLocalMaxPrice(currentFilters.maxPrice || "");
  }, [currentFilters.maxPrice]);

  // Debounce min price → URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = currentFilters.minPrice || "";
      if (localMinPrice !== current) {
        updateFilter("minPrice", localMinPrice || undefined);
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localMinPrice]);

  // Debounce max price → URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = currentFilters.maxPrice || "";
      if (localMaxPrice !== current) {
        updateFilter("maxPrice", localMaxPrice || undefined);
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localMaxPrice]);

  const handleClear = useCallback(() => {
    setLocalMinPrice("");
    setLocalMaxPrice("");
    clearMoreFilters();
  }, [clearMoreFilters]);

  const chipBase =
    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer";

  return (
    <>
      {/* Trigger button — matches existing pill styling */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          chipBase,
          moreFilterCount > 0
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-background hover:bg-accent"
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {t("more_filters")}
        {moreFilterCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {moreFilterCount}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("more_filters")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Provider Type */}
            <div className="space-y-2">
              <Label className="text-sm">{t("provider_type")}</Label>
              <Select
                value={currentFilters.providerType || "all"}
                onValueChange={(v) => updateFilter("providerType", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("all_providers")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_providers")}</SelectItem>
                  <SelectItem value="doctor">{t("doctors_only")}</SelectItem>
                  <SelectItem value="testing_service">
                    <span className="flex items-center gap-1.5">
                      <FlaskConical className="h-3.5 w-3.5" />
                      {t("testing_services")}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label className="text-sm">{t("language")}</Label>
              <Select
                value={currentFilters.language || "all"}
                onValueChange={(v) => updateFilter("language", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("any_language")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("any_language")}</SelectItem>
                  {DOCTOR_LANGUAGES.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payments Accepted */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <CreditCard className="h-3.5 w-3.5" />
                {t("payments_accepted")}
              </Label>
              <Select
                value={currentFilters.acceptedPayment || "all"}
                onValueChange={(v) => updateFilter("acceptedPayment", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("all_payments")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_payments")}</SelectItem>
                  {PAYMENT_METHODS.map((pm) => (
                    <SelectItem key={pm.value} value={pm.value}>
                      {t(pm.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Minimum Rating */}
            <div className="space-y-2">
              <Label className="text-sm">{t("min_rating")}</Label>
              <Select
                value={currentFilters.minRating || "all"}
                onValueChange={(v) => updateFilter("minRating", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("min_rating")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("min_rating")}</SelectItem>
                  <SelectItem value="4.5">4.5+</SelectItem>
                  <SelectItem value="4">4.0+</SelectItem>
                  <SelectItem value="3.5">3.5+</SelectItem>
                  <SelectItem value="3">3.0+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Range */}
            <div className="space-y-2">
              <Label className="text-sm">{t("price_range_label")}</Label>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    type="number"
                    min={0}
                    placeholder={t("price_min")}
                    value={localMinPrice}
                    onChange={(e) => setLocalMinPrice(e.target.value)}
                  />
                </div>
                <span className="text-muted-foreground">–</span>
                <div className="flex-1">
                  <Input
                    type="number"
                    min={0}
                    placeholder={t("price_max")}
                    value={localMaxPrice}
                    onChange={(e) => setLocalMaxPrice(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClear}
            >
              {t("clear_these_filters")}
            </Button>
            <DialogClose asChild>
              <Button className="flex-1">{t("apply_filters")}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
