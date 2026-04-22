"use client";

import { useMemo } from "react";
import type { UIMessage } from "ai";
import { X, Filter } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { getSkill } from "@/lib/constants/skills";

export interface AppliedFilters {
  specialty: string | null;
  locationSlug: string | null;
  language: string | null;
  consultationType: "in_person" | "video" | null;
  skill: string | null;
}

interface ChatFilterBarProps {
  messages: UIMessage[];
  onApply: (filters: AppliedFilters) => void;
  variant?: "compact" | "expanded";
}

/**
 * Reads the most recent successful `searchDoctors` tool call from the message
 * history and surfaces its inputs as removable chips. Removing a chip triggers
 * a fresh search with the updated filter set — no re-typing required.
 */
export function ChatFilterBar({
  messages,
  onApply,
  variant = "compact",
}: ChatFilterBarProps) {
  const t = useTranslations("chat.filters");

  const filters = useMemo<AppliedFilters | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      for (let j = m.parts.length - 1; j >= 0; j--) {
        const part = m.parts[j] as {
          type?: string;
          state?: string;
          input?: {
            specialty?: string | null;
            locationSlug?: string | null;
            language?: string | null;
            consultationType?: "in_person" | "video" | null;
            skill?: string | null;
          };
          output?: { ok?: boolean };
        };
        if (
          part.type === "tool-searchDoctors" &&
          part.state === "output-available" &&
          part.output?.ok &&
          part.input
        ) {
          return {
            specialty: part.input.specialty ?? null,
            locationSlug: part.input.locationSlug ?? null,
            language: part.input.language ?? null,
            consultationType: part.input.consultationType ?? null,
            skill: part.input.skill ?? null,
          };
        }
      }
    }
    return null;
  }, [messages]);

  if (!filters) return null;

  const chips: {
    key: keyof AppliedFilters;
    label: string;
    value: string;
  }[] = [];
  if (filters.specialty)
    chips.push({
      key: "specialty",
      label: t("specialty"),
      value: humanize(filters.specialty),
    });
  if (filters.locationSlug)
    chips.push({
      key: "locationSlug",
      label: t("location"),
      value: humanize(filters.locationSlug),
    });
  if (filters.language)
    chips.push({ key: "language", label: t("language"), value: filters.language });
  if (filters.consultationType)
    chips.push({
      key: "consultationType",
      label: t("type"),
      value:
        filters.consultationType === "video"
          ? t("video")
          : t("in_person"),
    });
  if (filters.skill) {
    const skillMeta = getSkill(filters.skill);
    chips.push({
      key: "skill",
      label: t("skill"),
      value: skillMeta?.label ?? humanize(filters.skill),
    });
  }

  if (chips.length === 0) return null;

  const handleRemove = (key: keyof AppliedFilters) => {
    onApply({ ...filters, [key]: null });
  };

  return (
    <div
      className={cn(
        "border-t border-border bg-background",
        variant === "expanded" ? "px-6 py-2.5" : "px-3 py-2"
      )}
    >
      <div className="flex items-center gap-2">
        <Filter
          className={cn(
            "shrink-0 text-muted-foreground",
            variant === "expanded" ? "h-3.5 w-3.5" : "h-3 w-3"
          )}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span
              key={c.key}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/5 text-primary",
                variant === "expanded"
                  ? "px-2.5 py-1 text-xs"
                  : "px-2 py-0.5 text-[11px]"
              )}
            >
              <span className="font-medium">{c.value}</span>
              <button
                type="button"
                onClick={() => handleRemove(c.key)}
                aria-label={t("remove_filter", { name: c.value })}
                className="rounded-full p-0.5 hover:bg-primary/15"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function humanize(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ")
    .replace(/\b(Uk|Us|Eu)\b/g, (m) => m.toUpperCase());
}
