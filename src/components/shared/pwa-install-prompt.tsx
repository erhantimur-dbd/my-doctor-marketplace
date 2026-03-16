"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Detect if running in standalone mode (already installed as PWA) */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  );
}

/** Detect iOS Safari (not Chrome/Firefox on iOS) */
function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari =
    /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (isStandalone()) return;

    // Check if already dismissed (re-show after 7 days)
    try {
      const dismissedAt = localStorage.getItem("pwa-install-dismissed-at");
      if (dismissedAt) {
        const daysSince =
          (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) {
          setDismissed(true);
          return;
        }
      }
    } catch {
      // Ignore storage errors
    }

    // Android/Desktop Chrome: listen for beforeinstallprompt
    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // iOS Safari: show manual instructions after a short delay
    if (isIOSSafari()) {
      const timer = setTimeout(() => setShowIOSPrompt(true), 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }

    return () =>
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed — ignore
      });
    }
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIOSPrompt(false);
    try {
      localStorage.setItem("pwa-install-dismissed-at", String(Date.now()));
    } catch {
      // Ignore
    }
  }

  // Nothing to show
  if (dismissed) return null;
  if (!deferredPrompt && !showIOSPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm sm:left-auto sm:right-4">
      <Card className="shadow-lg border-primary/20">
        <CardContent className="flex items-start gap-3 p-4">
          {showIOSPrompt ? (
            <>
              <Share className="mt-0.5 h-7 w-7 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Add to Home Screen</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Tap the{" "}
                  <Share className="inline h-3 w-3" />{" "}
                  share button, then{" "}
                  <strong>&quot;Add to Home Screen&quot;</strong> to install
                  MyDoctors360 as an app.
                </p>
              </div>
            </>
          ) : (
            <>
              <Download className="mt-0.5 h-7 w-7 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Install MyDoctors360</p>
                <p className="text-xs text-muted-foreground">
                  Get quick access from your home screen
                </p>
              </div>
              <Button size="sm" onClick={handleInstall}>
                Install
              </Button>
            </>
          )}
          <button
            onClick={handleDismiss}
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
