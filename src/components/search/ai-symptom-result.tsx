"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, Video, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SymptomAnalysis } from "@/lib/ai/schemas";

interface AISymptomResultProps {
  analysis: SymptomAnalysis;
  specialtyLabel: string;
  onSelect: () => void;
}

const urgencyConfig = {
  routine: {
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    key: "urgency_routine" as const,
  },
  urgent: {
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    key: "urgency_urgent" as const,
  },
  emergency: {
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    key: "urgency_emergency" as const,
  },
};

const consultationIcons = {
  in_person: MapPin,
  video: Video,
  either: ArrowRight,
};

export function AISymptomResult({
  analysis,
  specialtyLabel,
  onSelect,
}: AISymptomResultProps) {
  const t = useTranslations("ai");
  const urgency = urgencyConfig[analysis.urgency];
  const ConsultIcon =
    consultationIcons[analysis.suggestedConsultationType] || ArrowRight;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{specialtyLabel}</span>
          <Badge
            variant="secondary"
            className={cn("text-[10px] px-1.5 py-0", urgency.color)}
          >
            {t(urgency.key)}
          </Badge>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ConsultIcon className="h-3 w-3" />
          <span>
            {analysis.suggestedConsultationType === "in_person"
              ? t("in_person_recommended")
              : analysis.suggestedConsultationType === "video"
                ? t("video_ok")
                : t("either_works")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
          {t("suggestion")}
        </Badge>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}
