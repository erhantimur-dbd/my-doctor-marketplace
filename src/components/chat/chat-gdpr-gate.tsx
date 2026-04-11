"use client";

import { Link } from "@/i18n/navigation";
import { Shield } from "lucide-react";
import { useTranslations } from "next-intl";

interface ChatGdprGateProps {
  onAccept: () => void;
}

/**
 * First-run disclosure shown inside the chat window before any messages
 * can be sent. Tells the user their text is processed by OpenAI and that
 * messages are not stored beyond the current browser session.
 *
 * This complements the global cookie consent banner — the banner covers
 * site-wide tracking, this gate covers the specific AI data flow.
 */
export function ChatGdprGate({ onAccept }: ChatGdprGateProps) {
  const t = useTranslations("chat.gdpr");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Shield className="h-5 w-5" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-foreground">
          {t("title")}
        </h3>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          {t("body")}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {t.rich("privacy_link", {
            privacy: (chunks) => (
              <Link
                href="/privacy"
                className="text-primary underline-offset-2 hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
      <button
        type="button"
        onClick={onAccept}
        className="w-full rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        {t("accept")}
      </button>
    </div>
  );
}
