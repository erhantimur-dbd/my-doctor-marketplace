"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed in this session
    try {
      if (sessionStorage.getItem("pwa-install-dismissed") === "true") {
        setDismissed(true);
      }
    } catch {
      // Ignore
    }

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
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
    try {
      sessionStorage.setItem("pwa-install-dismissed", "true");
    } catch {
      // Ignore
    }
  }

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm sm:left-auto sm:right-4">
      <Card className="shadow-lg">
        <CardContent className="flex items-center gap-3 p-4">
          <Download className="h-8 w-8 shrink-0 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Install MyDoctor360</p>
            <p className="text-xs text-muted-foreground">
              Get quick access from your home screen
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={handleInstall}>
              Install
            </Button>
            <button
              onClick={handleDismiss}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
