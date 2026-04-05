"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Shield, Download, Trash2, Loader2, AlertTriangle, Cookie } from "lucide-react";
import { toast } from "sonner";
import {
  exportPatientData,
  requestAccountDeletion,
} from "@/actions/patient";
import { saveCookieConsent } from "@/actions/consent";

export function DataPrivacySection() {
  const [isExporting, startExportTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isSavingCookies, startCookieTransition] = useTransition();
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cookieAnalytics, setCookieAnalytics] = useState(false);
  const [cookieMarketing, setCookieMarketing] = useState(false);
  const router = useRouter();

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

  function handleDeleteAccount() {
    if (deleteConfirmation !== "DELETE") {
      toast.error('Please type "DELETE" to confirm.');
      return;
    }

    startDeleteTransition(async () => {
      const result = await requestAccountDeletion();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        "Your account has been deleted. You will be redirected shortly."
      );
      setDeleteDialogOpen(false);

      // Redirect to home after a short delay
      setTimeout(() => {
        router.push("/");
      }, 2000);
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

        {/* Delete Account */}
        <div className="flex items-start justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-destructive">
              Delete Account
            </h4>
            <p className="text-xs text-muted-foreground">
              Permanently delete your account and all associated data. This
              action cannot be undone.
            </p>
          </div>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Delete Your Account
                </DialogTitle>
                <DialogDescription className="space-y-2 pt-2">
                  <span className="block">
                    This will permanently delete your account including:
                  </span>
                  <span className="block text-sm">
                    - Your profile and personal information
                  </span>
                  <span className="block text-sm">
                    - All booking history and records
                  </span>
                  <span className="block text-sm">
                    - Reviews you have written
                  </span>
                  <span className="block text-sm">
                    - Saved doctors and preferences
                  </span>
                  <span className="mt-2 block font-medium text-destructive">
                    This action cannot be undone.
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="delete-confirm">
                  Type <span className="font-mono font-bold">DELETE</span> to
                  confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setDeleteConfirmation("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmation !== "DELETE" || isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Permanently Delete"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
