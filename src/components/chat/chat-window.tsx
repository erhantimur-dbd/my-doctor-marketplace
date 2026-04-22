"use client";

import { useCallback, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Minimize2, X, Loader2, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useChatStore } from "@/stores/chat-store";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./chat-message";
import { ChatComposer } from "./chat-composer";
import { ChatSuggestions } from "./chat-suggestions";
import { ChatGdprGate } from "./chat-gdpr-gate";
import { ChatFilterBar, type AppliedFilters } from "./chat-filter-bar";
import { ChatShortlistStrip } from "./chat-shortlist-strip";
import { ChatCompareView } from "./chat-compare-view";

/**
 * The chat panel has two sizes, controlled by a single toggle in the header:
 *   - compact:    360×540 corner widget (default)
 *   - fullscreen: centered 720×720 modal with backdrop (desktop) /
 *                 covers the whole viewport on mobile
 *
 * Auto-grows to fullscreen on the first user message. State persists via the
 * chat store (sessionStorage).
 */
export function ChatWindow() {
  const locale = useLocale();
  const t = useTranslations("chat.window");
  const {
    size,
    hasAcceptedGdpr,
    hasAutoExpanded,
    messages: storedMessages,
    compareOpen,
    close,
    toggleSize,
    setSize,
    markAutoExpanded,
    acceptGdpr,
    setMessages,
    setCompareOpen,
  } = useChatStore();

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { locale },
    }),
    messages: storedMessages as UIMessage[],
  });

  useEffect(() => {
    setMessages(messages as UIMessage[]);
  }, [messages, setMessages]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // If the latest assistant message returned 2+ doctor cards, anchor the
    // first card near the top of the viewport instead of auto-scrolling to
    // the bottom — which would push earlier cards off-screen.
    const lastMsg = messages[messages.length - 1];
    const hasMultipleDoctorResults = lastMsg?.parts?.some((p) => {
      if (p.type !== "tool-searchDoctors") return false;
      const tp = p as {
        state?: string;
        output?: { ok?: boolean; doctors?: unknown[] };
      };
      return (
        tp.state === "output-available" &&
        tp.output?.ok === true &&
        (tp.output?.doctors?.length ?? 0) >= 2
      );
    });
    if (hasMultipleDoctorResults) {
      const blocks = el.querySelectorAll<HTMLElement>(
        "[data-chat-doctor-results]"
      );
      const last = blocks[blocks.length - 1];
      if (last) {
        const rect = last.getBoundingClientRect();
        const containerRect = el.getBoundingClientRect();
        el.scrollTop = el.scrollTop + (rect.top - containerRect.top) - 12;
        return;
      }
    }
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const handleBook = useCallback(() => {
    close();
  }, [close]);

  const handleSend = (text: string) => {
    if (!hasAutoExpanded && size === "compact") {
      setSize("fullscreen");
      markAutoExpanded();
    }
    sendMessage({ text });
  };

  const handleRefine = (filters: AppliedFilters) => {
    const parts: string[] = [];
    if (filters.specialty) parts.push(`specialty ${humanize(filters.specialty)}`);
    if (filters.locationSlug) parts.push(`in ${humanize(filters.locationSlug)}`);
    if (filters.language) parts.push(`speaking ${filters.language}`);
    if (filters.consultationType)
      parts.push(
        filters.consultationType === "video" ? "video only" : "in person only"
      );
    if (filters.skill) parts.push(`skill ${humanize(filters.skill)}`);
    const msg = parts.length
      ? `Re-run the search with only these filters: ${parts.join(", ")}. Drop any other filters.`
      : "Search without any filters — show the most popular doctors.";
    sendMessage({ text: msg });
  };

  const isBusy = status === "submitted" || status === "streaming";
  const isFullscreen = size === "fullscreen";

  const sizeClass = isFullscreen ? "chat-window-fullscreen" : "chat-window-compact";
  const toggleLabel = isFullscreen ? t("shrink") : t("expand");
  const ToggleIcon = isFullscreen ? Minimize2 : Maximize2;

  return (
    <AnimatePresence>
      <style>{`
        .chat-window-base {
          position: fixed;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid var(--border);
          background: var(--background);
          border-radius: 1rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        .chat-window-compact {
          bottom: 1rem; left: 1rem; right: 1rem;
          max-width: 360px;
          height: min(540px, calc(100dvh - 3rem));
        }
        @media (min-width: 640px) {
          .chat-window-compact {
            bottom: 1.5rem; left: auto; right: 1.5rem;
            width: 360px;
            height: min(540px, calc(100dvh - 3rem));
          }
        }
        .chat-window-fullscreen {
          top: 0; left: 0; right: 0; bottom: 0;
          width: 100%; height: 100%;
          border-radius: 0;
          border: 0;
        }
        @media (min-width: 768px) {
          .chat-window-fullscreen {
            inset: 0;
            margin: auto;
            width: min(720px, calc(100vw - 3rem));
            height: min(720px, calc(100dvh - 3rem));
            border-radius: 1.25rem;
            border: 1px solid var(--border);
          }
        }
        .chat-window-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          z-index: 9998;
        }
      `}</style>

      {isFullscreen && (
        <motion.div
          key="chat-backdrop"
          className="chat-window-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={close}
        />
      )}

      <motion.div
        key="chat-window"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn("chat-window-base", sizeClass)}
        style={{ zIndex: 9999 }}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between gap-2 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
            isFullscreen ? "px-5 py-3.5" : "px-3 py-2.5"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-white/40",
                isFullscreen ? "h-10 w-10" : "h-8 w-8"
              )}
            >
              <Logo
                className={cn("text-primary", isFullscreen ? "h-6 w-6" : "h-[18px] w-[18px]")}
              />
            </div>
            <div className="min-w-0">
              <p
                className={cn(
                  "truncate font-semibold leading-tight",
                  isFullscreen ? "text-base" : "text-[13px]"
                )}
              >
                {t("title")}
              </p>
              <p
                className={cn(
                  "truncate leading-tight text-white/80",
                  isFullscreen ? "text-xs" : "text-[10px]"
                )}
              >
                {t("subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleSize}
              aria-label={toggleLabel}
              title={toggleLabel}
              className="rounded-full p-1.5 hover:bg-white/15"
            >
              <ToggleIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={close}
              aria-label={t("close")}
              className="rounded-full p-1.5 hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {!hasAcceptedGdpr ? (
          <ChatGdprGate onAccept={acceptGdpr} />
        ) : compareOpen ? (
          <ChatCompareView
            locale={locale}
            onClose={() => setCompareOpen(false)}
            onBook={handleBook}
            variant={isFullscreen ? "expanded" : "compact"}
          />
        ) : (
          <>
            <div
              ref={scrollRef}
              className={cn(
                "flex-1 overflow-y-auto bg-muted/10",
                isFullscreen ? "px-6 py-5" : "px-3 py-3"
              )}
            >
              {messages.length === 0 ? (
                <div
                  className={cn(
                    "flex flex-col",
                    isFullscreen ? "gap-4" : "gap-2"
                  )}
                >
                  {isFullscreen && (
                    <div className="flex flex-col items-center gap-2 pt-2 pb-1 text-center">
                      <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        {t("hero_title")}
                      </h2>
                      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                        {t("hero_body")}
                      </p>
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl bg-muted leading-relaxed text-foreground",
                      isFullscreen
                        ? "px-4 py-3 text-sm"
                        : "px-3 py-2 text-[13px] mb-2"
                    )}
                  >
                    {t("greeting")}
                  </div>
                  {isFullscreen && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-background px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{t("disclaimer")}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={cn(
                    "flex flex-col",
                    isFullscreen ? "gap-3.5" : "gap-2.5"
                  )}
                >
                  {messages.map((m) => (
                    <ChatMessage
                      key={m.id}
                      message={m as UIMessage}
                      locale={locale}
                      onBook={handleBook}
                    />
                  ))}
                  {status === "submitted" && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t("thinking")}
                    </div>
                  )}
                </div>
              )}
            </div>

            {messages.length === 0 && (
              <ChatSuggestions
                onPick={handleSend}
                variant={isFullscreen ? "expanded" : "compact"}
              />
            )}

            {messages.length > 0 && (
              <ChatFilterBar
                messages={messages as UIMessage[]}
                onApply={handleRefine}
                variant={isFullscreen ? "expanded" : "compact"}
              />
            )}

            <ChatShortlistStrip
              variant={isFullscreen ? "expanded" : "compact"}
            />

            {error && (
              <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {t("error")}
              </div>
            )}

            <ChatComposer onSend={handleSend} disabled={isBusy} />
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function humanize(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ")
    .replace(/\b(Uk|Us|Eu)\b/g, (m) => m.toUpperCase());
}
