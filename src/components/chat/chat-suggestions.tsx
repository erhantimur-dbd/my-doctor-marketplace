"use client";

import { useTranslations } from "next-intl";
import {
  Stethoscope,
  MapPin,
  Languages,
  CalendarClock,
  Video,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatSuggestionsProps {
  onPick: (text: string) => void;
  variant?: "compact" | "expanded";
}

/**
 * Empty-state prompt chips shown when the chat opens for the first time.
 *
 * All chips are LOGISTIC preferences — specialty, location, language,
 * availability, consultation type, second-opinion intent. No symptom-first
 * entry point.
 *
 * Two variants:
 *   - compact: wrapping row of pill chips (corner widget)
 *   - expanded: 2-column tile grid (larger modal, Doctify-style)
 */
export function ChatSuggestions({ onPick, variant = "compact" }: ChatSuggestionsProps) {
  const t = useTranslations("chat.suggestions");

  const items: { key: string; icon: React.ReactNode }[] = [
    { key: "specialty", icon: <Stethoscope className="h-4 w-4" /> },
    { key: "near_me", icon: <MapPin className="h-4 w-4" /> },
    { key: "language", icon: <Languages className="h-4 w-4" /> },
    { key: "this_week", icon: <CalendarClock className="h-4 w-4" /> },
    { key: "video_consult", icon: <Video className="h-4 w-4" /> },
    { key: "second_opinion", icon: <ClipboardCheck className="h-4 w-4" /> },
  ];

  if (variant === "expanded") {
    return (
      <div className="flex flex-col gap-3 px-6 pb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("try")}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const text = t(`items.${item.key}`);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onPick(text)}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left shadow-sm",
                  "transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md"
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  {item.icon}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {text}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-4 pb-2">
      <p className="text-xs text-muted-foreground">{t("try")}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const text = t(`items.${item.key}`);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onPick(text)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{item.icon}</span>
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
