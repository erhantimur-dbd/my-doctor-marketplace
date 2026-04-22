"use client";

import { Heart, Scale, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useChatStore } from "@/stores/chat-store";
import { cn } from "@/lib/utils";

interface ChatShortlistStripProps {
  variant?: "compact" | "expanded";
}

/**
 * Floating strip that appears above the composer whenever the user has
 * shortlisted at least one doctor. Shows count and actions: Compare, Clear.
 */
export function ChatShortlistStrip({ variant = "compact" }: ChatShortlistStripProps) {
  const t = useTranslations("chat.shortlist");
  const shortlist = useChatStore((s) => s.shortlist);
  const clearShortlist = useChatStore((s) => s.clearShortlist);
  const setCompareOpen = useChatStore((s) => s.setCompareOpen);

  if (shortlist.length === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-t border-border bg-primary/5",
        variant === "expanded" ? "px-6 py-2.5" : "px-3 py-2"
      )}
    >
      <div className="flex items-center gap-2 min-w-0 text-primary">
        <Heart className={cn("shrink-0 fill-current", variant === "expanded" ? "h-4 w-4" : "h-3.5 w-3.5")} />
        <span className={cn("truncate font-medium", variant === "expanded" ? "text-sm" : "text-xs")}>
          {t("count", { count: shortlist.length })}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {shortlist.length >= 2 && (
          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full bg-primary font-semibold text-primary-foreground transition-colors hover:bg-primary/90",
              variant === "expanded" ? "px-3 py-1.5 text-xs" : "px-2.5 py-1 text-[11px]"
            )}
          >
            <Scale className="h-3 w-3" />
            {t("compare")}
          </button>
        )}
        <button
          type="button"
          onClick={clearShortlist}
          aria-label={t("clear")}
          title={t("clear")}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
