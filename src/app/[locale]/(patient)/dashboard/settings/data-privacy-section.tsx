"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Shield, Download, Loader2, Cookie } from "lucide-react";
import { toast } from "sonner";
import { exportPatientData } from "@/actions/patient";
import { saveCookieConsent } from "@/actions/consent";
import { AccountErasureSection } from "@/components/settings/account-erasure-section";

export function DataPrivacySection() {
  const [isExporting, startExportTransition] = useTransition();
  const [isSavingCookies, startCookieTransition] = useTransition();
  const [cookieAnalytics, setCookieAnalytics] = useState(false);
  const [cookieMarketing, setCookieMarketing] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cookie_consent");
      if (stored) {
        const parsed = JSON.parse(stored);
        setCookieAnalytics(!!parsed.analytics);
        setCookieMarketing(!!parsed.marketing);
      }
    } catch {
      // localStorage unavailable or invalid JSON
    }
  }, []);

  function handleSaveCookiePreferences() {
    startCookieTransition(async () => {
      const consent = {
        analytics: cookieAnalytics,
        marketing: cookieMarketing,
        timestamp: new Date().toISOString(),
      };

      try {
        localStorage.setItem("cookie_consent", JSON.stringify(consent));
      } catch {
        // localStorage write failed
      }

      const result = await saveCookieConsent({
        analytics: cookieAnalytics,
        marketing: cookieMarketing,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      window.dispatchEvent(
        new CustomEvent("cookie-consent-updated", {
          detail: consent,
        })
      );

      toast.success("Cookie preferences saved successfully.");
    });
  }

  function handleExport() {
    startExportTransition(async () => {
      const result = await exportPatientData();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        const json = JSON.stringify(result.data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const date = new Date().toISOString().split("T")[0];

        const a = document.createElement("a");
        a.href = url;
        a.download = `my-data-export-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success("Your data has been exported successfully.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />
          Data &amp; Privacy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Under GDPR, you have the right to access and delete your personal
          data. Use the options below to manage your data.
        </p>

        {/* Cookie Preferences */}
        <div className="rounded-lg border p-4 space-y-4">
          <div className="space-y-1">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Cookie className="h-4 w-4" />
              Cookie Preferences
            </h4>
            <p className="text-xs text-muted-foreground">
              Manage which cookies you allow. Necessary cookies cannot be
              disabled.
            </p>
          </div>

          {/* Necessary */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label className="text-sm font-medium">Necessary</Label>
              <p className="text-xs text-muted-foreground">
                Required for authentication and basic functionality
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-green-600" />
              <span className="text-xs font-medium text-green-600">
                Always on
              </span>
            </div>
          </div>

          {/* Analytics */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label
                htmlFor="settings-analytics-toggle"
                className="text-sm font-medium"
              >
                Analytics
              </Label>
              <p className="text-xs text-muted-foreground">
                Help us understand how visitors use the site
              </p>
            </div>
            <Switch
              id="settings-analytics-toggle"
              checked={cookieAnalytics}
              onCheckedChange={setCookieAnalytics}
            />
          </div>

          {/* Marketing */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label
                htmlFor="settings-marketing-toggle"
                className="text-sm font-medium"
              >
                Marketing
              </Label>
              <p className="text-xs text-muted-foreground">
                Used for relevant advertisements and campaigns
              </p>
            </div>
            <Switch
              id="settings-marketing-toggle"
              checked={cookieMarketing}
              onCheckedChange={setCookieMarketing}
            />
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveCookiePreferences}
              disabled={isSavingCookies}
            >
              {isSavingCookies ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isSavingCookies ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </div>

        {/* Export Data */}
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <h4 className="text-sm font-medium">Download My Data</h4>
            <p className="text-xs text-muted-foreground">
              Export all your personal data, bookings, reviews, and more as a
              JSON file.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        </div>

        <AccountErasureSection />
      </CardContent>
    </Card>
  );
}
