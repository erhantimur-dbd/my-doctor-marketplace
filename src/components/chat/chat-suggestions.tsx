"use client";

import { useTranslations } from "next-intl";
import { Stethoscope, MapPin, Globe, Video } from "lucide-react";

interface ChatSuggestionsProps {
  onPick: (text: string) => void;
}

/**
 * Empty-state prompt chips shown when the chat opens for the first time.
 * Kept short and actionable so the user gets a running start without
 * having to think about what to type.
 */
export function ChatSuggestions({ onPick }: ChatSuggestionsProps) {
  const t = useTranslations("chat.suggestions");

  const items: { key: string; icon: React.ReactNode }[] = [
    { key: "headaches", icon: <Stethoscope className="h-3.5 w-3.5" /> },
    { key: "dermatologist_london", icon: <MapPin className="h-3.5 w-3.5" /> },
    { key: "turkish_gp", icon: <Globe className="h-3.5 w-3.5" /> },
    { key: "video_consult", icon: <Video className="h-3.5 w-3.5" /> },
  ];

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
              {item.icon}
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
