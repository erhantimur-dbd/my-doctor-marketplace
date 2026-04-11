"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { Minimize2, X, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useChatStore } from "@/stores/chat-store";
import { Logo } from "@/components/brand/logo";
import { ChatMessage } from "./chat-message";
import { ChatComposer } from "./chat-composer";
import { ChatSuggestions } from "./chat-suggestions";
import { ChatGdprGate } from "./chat-gdpr-gate";

/**
 * The expanded chat panel. Mounted conditionally by <ChatWidget> when the
 * store's `isOpen` is true. Handles:
 *   - useChat hook setup (AI SDK v6 with DefaultChatTransport)
 *   - Zustand <-> useChat message sync (initial load + ongoing persistence)
 *   - GDPR gate on first-ever open in the session
 *   - Empty-state suggestions
 *   - Auto-scroll to the newest message
 *   - Header with minimize + close
 */
export function ChatWindow() {
  const locale = useLocale();
  const t = useTranslations("chat.window");
  const {
    isMinimized,
    hasAcceptedGdpr,
    messages: storedMessages,
    close,
    toggleMinimized,
    acceptGdpr,
    setMessages,
  } = useChatStore();

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { locale },
    }),
    messages: storedMessages as UIMessage[],
  });

  // Persist every message update to Zustand so the conversation survives
  // page navigation within the session.
  useEffect(() => {
    setMessages(messages as UIMessage[]);
  }, [messages, setMessages]);

  // Auto-scroll to the bottom whenever a new message or streaming chunk arrives
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const handleSend = (text: string) => {
    sendMessage({ text });
  };

  const isBusy = status === "submitted" || status === "streaming";

  return (
    <AnimatePresence>
      <motion.div
        key="chat-window"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          height: isMinimized ? 56 : undefined,
        }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed bottom-4 right-4 flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:bottom-6 sm:right-6"
        style={{
          zIndex: 9999,
          width: "min(360px, calc(100vw - 2rem))",
          maxWidth: "360px",
          height: isMinimized ? 56 : "min(540px, calc(100vh - 3rem))",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 bg-gradient-to-br from-primary to-primary/80 px-3 py-2.5 text-primary-foreground">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-white/40">
              <Logo className="h-[18px] w-[18px] text-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold leading-tight">
                {t("title")}
              </p>
              <p className="truncate text-[10px] leading-tight text-white/80">
                {t("subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleMinimized}
              aria-label={t("minimize")}
              className="rounded-full p-1.5 hover:bg-white/15"
            >
              <Minimize2 className="h-4 w-4" />
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

        {/* Body — hidden when minimized */}
        {!isMinimized && (
          <>
            {!hasAcceptedGdpr ? (
              <ChatGdprGate onAccept={acceptGdpr} />
            ) : (
              <>
                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto bg-muted/10 px-3 py-3"
                >
                  {messages.length === 0 ? (
                    <div className="flex h-full flex-col justify-start">
                      <div className="mb-2 rounded-2xl bg-muted px-3 py-2 text-[13px] leading-relaxed text-foreground">
                        {t("greeting")}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {messages.map((m) => (
                        <ChatMessage
                          key={m.id}
                          message={m as UIMessage}
                          locale={locale}
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
                  <ChatSuggestions onPick={handleSend} />
                )}

                {error && (
                  <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    {t("error")}
                  </div>
                )}

                <ChatComposer onSend={handleSend} disabled={isBusy} />
              </>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
