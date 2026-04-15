"use client";

import type { UIMessage } from "ai";
import { AlertTriangle, BookOpen, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ChatDoctorCard } from "./chat-doctor-card";
import type { ChatDoctor } from "@/lib/chat/tools";

interface ChatMessageProps {
  message: UIMessage;
  locale: string;
  onBook?: () => void;
}

/**
 * Renders a single chat message from the AI SDK `useChat` hook.
 *
 * UIMessage shape (AI SDK v6):
 *   { id, role, parts: UIMessagePart[] }
 * where each part is either:
 *   { type: 'text', text: string, state?: 'streaming' | 'done' }
 *   { type: `tool-${name}`, toolCallId, state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error', input?, output?, errorText? }
 *
 * We iterate parts in order so the chat renders text, then tool results,
 * then more text — matching the natural assistant flow.
 */
export function ChatMessage({ message, locale, onBook }: ChatMessageProps) {
  const t = useTranslations("chat.message");
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "flex max-w-[90%] flex-col gap-2",
          isUser ? "items-end" : "items-start"
        )}
      >
        {message.parts.map((part, idx) => {
          // ── Text part ─────────────────────────────
          if (part.type === "text") {
            const text = (part as { text: string }).text;
            if (!text) return null;
            return (
              <div
                key={idx}
                className={cn(
                  "whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {text}
              </div>
            );
          }

          // ── Tool: analyzeSymptoms ─────────────────
          if (part.type === "tool-analyzeSymptoms") {
            const tp = part as {
              state: string;
              output?: {
                ok?: boolean;
                urgency?: "emergency" | "routine";
                urgencyReason?: string | null;
              };
            };

            if (tp.state === "input-streaming" || tp.state === "input-available") {
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-xs text-muted-foreground"
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("analyzing_symptoms")}
                </div>
              );
            }

            if (tp.state === "output-available" && tp.output?.ok && tp.output.urgency === "emergency") {
              return (
                <div
                  key={idx}
                  className="flex max-w-full items-start gap-2 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">{t("emergency_title")}</p>
                    <p className="mt-1 text-xs leading-relaxed">
                      {tp.output.urgencyReason || t("emergency_default_reason")}
                    </p>
                    <p className="mt-2 text-xs font-semibold">
                      {t("emergency_numbers")}
                    </p>
                  </div>
                </div>
              );
            }
            // routine analyzeSymptoms results are silent — searchDoctors follows
            return null;
          }

          // ── Tool: searchDoctors ───────────────────
          if (part.type === "tool-searchDoctors") {
            const tp = part as {
              state: string;
              output?: {
                ok?: boolean;
                doctors?: ChatDoctor[];
                total?: number;
                fallbackApplied?: string | null;
              };
            };

            if (tp.state === "input-streaming" || tp.state === "input-available") {
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-xs text-muted-foreground"
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("searching_doctors")}
                </div>
              );
            }

            if (tp.state === "output-available" && tp.output?.ok) {
              const doctors = tp.output.doctors ?? [];
              if (doctors.length === 0) {
                return (
                  <div
                    key={idx}
                    className="rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground"
                  >
                    {t("no_results")}
                  </div>
                );
              }

              return (
                <div key={idx} className="flex w-full flex-col gap-2.5">
                  {tp.output.fallbackApplied && (
                    <p className="text-[11px] italic text-muted-foreground">
                      {tp.output.fallbackApplied}
                    </p>
                  )}
                  {doctors.map((doctor) => (
                    <ChatDoctorCard
                      key={doctor.id}
                      doctor={doctor}
                      locale={locale}
                      onBook={onBook}
                    />
                  ))}
                </div>
              );
            }

            if (tp.state === "output-error") {
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-muted px-4 py-2.5 text-xs text-muted-foreground"
                >
                  {t("search_error")}
                </div>
              );
            }
            return null;
          }

          // ── Tool: answerFaq ──────────────────────
          if (part.type === "tool-answerFaq") {
            const tp = part as {
              state: string;
              output?: {
                ok?: boolean;
                articleId?: string;
                categoryId?: string;
                questionKey?: string;
                answerKey?: string;
                relatedArticles?: {
                  articleId: string;
                  categoryId: string;
                  questionKey: string;
                }[];
              };
            };

            if (tp.state === "input-streaming" || tp.state === "input-available") {
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-xs text-muted-foreground"
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("looking_up")}
                </div>
              );
            }

            if (tp.state === "output-available" && tp.output?.ok) {
              return (
                <FaqCard
                  key={idx}
                  articleId={tp.output.articleId!}
                  questionKey={tp.output.questionKey!}
                  answerKey={tp.output.answerKey!}
                />
              );
            }
            // If no match found, the LLM will respond in text — render nothing
            return null;
          }

          return null;
        })}
      </div>
    </div>
  );
}

/** Styled FAQ answer card rendered inline in chat. */
function FaqCard({
  articleId,
  questionKey,
  answerKey,
}: {
  articleId: string;
  questionKey: string;
  answerKey: string;
}) {
  const t = useTranslations("helpArticles");

  let question: string;
  let answer: string;
  try {
    question = t(questionKey);
    answer = t(answerKey);
  } catch {
    // Fallback if i18n key is missing
    question = articleId.replace(/-/g, " ");
    answer = "";
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <div className="flex items-start gap-2.5 border-b border-border bg-primary/5 px-3.5 py-2.5">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm font-semibold text-foreground">{question}</p>
      </div>
      <div className="px-3.5 py-3">
        <p className="text-[13px] leading-relaxed text-foreground/85">
          {answer}
        </p>
        <Link
          href="/support"
          className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <BookOpen className="h-3 w-3" />
          Visit Help Centre
        </Link>
      </div>
    </div>
  );
}
