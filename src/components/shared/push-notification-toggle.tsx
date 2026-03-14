"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import {
  savePushSubscription,
  removePushSubscription,
  hasPushSubscription,
} from "@/actions/push-subscriptions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setLoading(false);
        return;
      }

      const has = await hasPushSubscription();
      setEnabled(has);
      setLoading(false);
    }
    checkStatus();
  }, []);

  async function handleToggle(value: boolean) {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      toast.error("Push notifications are not supported in your browser");
      return;
    }

    if (!VAPID_PUBLIC_KEY) {
      toast.error("Push notifications are not configured");
      return;
    }

    setLoading(true);

    try {
      if (value) {
        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Notification permission denied");
          setLoading(false);
          return;
        }

        // Get service worker registration
        const registration = await navigator.serviceWorker.ready;

        // Subscribe
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        const json = subscription.toJSON();
        const result = await savePushSubscription({
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh,
          auth: json.keys!.auth,
        });

        if (result.error) {
          toast.error(result.error);
        } else {
          setEnabled(true);
          toast.success("Push notifications enabled");
        }
      } else {
        // Unsubscribe
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await subscription.unsubscribe();
          await removePushSubscription(subscription.endpoint);
        }

        setEnabled(false);
        toast.success("Push notifications disabled");
      }
    } catch (err) {
      toast.error("Failed to update notification settings");
    }

    setLoading(false);
  }

  // Don't show if push is not supported
  if (typeof window !== "undefined" && !("Notification" in window)) {
    return null;
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <Bell className="h-5 w-5 text-muted-foreground" />
        <div>
          <Label htmlFor="push-toggle" className="font-medium">
            Push Notifications
          </Label>
          <p className="text-xs text-muted-foreground">
            Receive instant notifications for bookings, messages, and reminders
          </p>
        </div>
      </div>
      <Switch
        id="push-toggle"
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={loading}
      />
    </div>
  );
}
