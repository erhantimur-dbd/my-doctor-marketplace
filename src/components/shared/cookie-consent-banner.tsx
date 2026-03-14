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
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 md:p-6">
      <div className="mx-auto max-w-3xl rounded-xl border bg-background/95 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="p-4 md:p-6">
          {/* Header */}
          <div className="mb-3 flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Cookie className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold">{t("title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {t("description")}
              </p>
            </div>
          </div>

          {/* Customize section */}
          {showCustomize && (
            <div className="mb-4 mt-4 space-y-3 rounded-lg border bg-muted/30 p-4">
              {/* Necessary cookies (always on) */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">
                    {t("necessary_label")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("necessary_desc")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium text-green-600">
                    {t("always_on")}
                  </span>
                </div>
              </div>

              {/* Analytics cookies */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="analytics-toggle" className="text-sm font-medium">
                    {t("analytics_label")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("analytics_desc")}
                  </p>
                </div>
                <Switch
                  id="analytics-toggle"
                  checked={analytics}
                  onCheckedChange={setAnalytics}
                />
              </div>

              {/* Marketing cookies */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="marketing-toggle" className="text-sm font-medium">
                    {t("marketing_label")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("marketing_desc")}
                  </p>
                </div>
                <Switch
                  id="marketing-toggle"
                  checked={marketing}
                  onCheckedChange={setMarketing}
                />
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={() => setShowCustomize(!showCustomize)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showCustomize ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {t("customize")}
            </button>

            <div className="flex gap-2">
              {showCustomize ? (
                <Button
                  onClick={handleSavePreferences}
                  disabled={saving}
                  variant="default"
                  size="sm"
                >
                  {t("save_preferences")}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleRejectAll}
                    disabled={saving}
                    variant="outline"
                    size="sm"
                  >
                    {t("reject_all")}
                  </Button>
                  <Button
                    onClick={handleAcceptAll}
                    disabled={saving}
                    variant="default"
                    size="sm"
                  >
                    {t("accept_all")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
