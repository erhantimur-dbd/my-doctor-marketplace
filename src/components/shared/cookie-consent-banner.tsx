"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Cookie, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { saveCookieConsent } from "@/actions/consent";

const CONSENT_KEY = "cookie_consent";

interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

function generateAnonymousId(): string {
  return "anon_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export function CookieConsentBanner() {
  const t = useTranslations("cookie_consent");
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Check if consent was already given
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (!stored) {
        // Small delay so banner doesn't flash on initial load
        const timer = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage unavailable — show banner
      setVisible(true);
    }
  }, []);

  const handleSave = useCallback(
    async (acceptAnalytics: boolean, acceptMarketing: boolean) => {
      setSaving(true);

      const consent: ConsentState = {
        analytics: acceptAnalytics,
        marketing: acceptMarketing,
        timestamp: new Date().toISOString(),
      };

      // Store in localStorage immediately
      try {
        localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
      } catch {
        // localStorage write failed — still persist to DB
      }

      // Persist to database
      let anonymousId: string | undefined;
      try {
        const existingId = localStorage.getItem("anonymous_id");
        if (existingId) {
          anonymousId = existingId;
        } else {
          anonymousId = generateAnonymousId();
          localStorage.setItem("anonymous_id", anonymousId);
        }
      } catch {
        anonymousId = generateAnonymousId();
      }

      await saveCookieConsent({
        analytics: acceptAnalytics,
        marketing: acceptMarketing,
        anonymousId,
      });

      // Dispatch custom event so AnalyticsScripts can react
      window.dispatchEvent(
        new CustomEvent("cookie-consent-updated", {
          detail: consent,
        })
      );

      setSaving(false);
      setVisible(false);
    },
    []
  );

  const handleAcceptAll = () => handleSave(true, true);
  const handleRejectAll = () => handleSave(false, false);
  const handleSavePreferences = () => handleSave(analytics, marketing);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999]">
      <div className="border-t bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
        {/* Customize panel — slides open above the bar */}
        {showCustomize && (
          <div className="border-b">
            <div className="mx-auto max-w-5xl space-y-2.5 px-4 py-3 md:px-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-sm font-medium">{t("necessary_label")}</Label>
                  <p className="text-xs text-muted-foreground">{t("necessary_desc")}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-xs font-medium text-green-600">{t("always_on")}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="analytics-toggle" className="text-sm font-medium">{t("analytics_label")}</Label>
                  <p className="text-xs text-muted-foreground">{t("analytics_desc")}</p>
                </div>
                <Switch id="analytics-toggle" checked={analytics} onCheckedChange={setAnalytics} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="marketing-toggle" className="text-sm font-medium">{t("marketing_label")}</Label>
                  <p className="text-xs text-muted-foreground">{t("marketing_desc")}</p>
                </div>
                <Switch id="marketing-toggle" checked={marketing} onCheckedChange={setMarketing} />
              </div>
            </div>
          </div>
        )}

        {/* Compact bar */}
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 md:px-6">
          <Cookie className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
          <p className="flex-1 text-xs text-muted-foreground sm:text-sm">
            {t("description")}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setShowCustomize(!showCustomize)}
              className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showCustomize ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{t("customize")}</span>
            </button>
            {showCustomize ? (
              <Button onClick={handleSavePreferences} disabled={saving} size="sm" className="h-7 px-3 text-xs">
                {t("save_preferences")}
              </Button>
            ) : (
              <>
                <Button onClick={handleRejectAll} disabled={saving} variant="ghost" size="sm" className="h-7 px-2.5 text-xs">
                  {t("reject_all")}
                </Button>
                <Button onClick={handleAcceptAll} disabled={saving} size="sm" className="h-7 px-3 text-xs">
                  {t("accept_all")}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
