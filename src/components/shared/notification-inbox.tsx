"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Calendar,
  CheckCircle,
  Star,
  CreditCard,
  AlertCircle,
  CheckCheck,
} from "lucide-react";
import { markAsRead, markAllAsRead } from "@/actions/notifications";
import { EmptyState } from "@/components/shared/empty-state";
import type { Notification } from "@/types";

interface NotificationInboxProps {
  initialNotifications: Notification[];
  dashboardPath: string;
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

const typeIcons: Record<string, typeof Bell> = {
  booking_reminder: Calendar,
  booking_confirmed: CheckCircle,
  booking_cancelled: AlertCircle,
  review_posted: Star,
  review_received: Star,
  payment_received: CreditCard,
  doctor_verified: CheckCircle,
};

export function NotificationInbox({
  initialNotifications,
  dashboardPath,
}: NotificationInboxProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleMarkAsRead(id: string) {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    startTransition(async () => {
      await markAsRead(id);
    });
  }

  function handleMarkAllAsRead() {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    startTransition(async () => {
      await markAllAsRead(dashboardPath);
      router.refresh();
    });
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={Bell}
            title="No messages yet"
            description="You'll receive notifications about bookings, reminders, and updates here."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Notifications
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </CardTitle>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={isPending}
          >
            <CheckCheck className="mr-1.5 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {notifications.map((notification) => {
            const Icon = typeIcons[notification.type] || Bell;
            return (
              <button
                key={notification.id}
                onClick={() =>
                  !notification.read && handleMarkAsRead(notification.id)
                }
                className={`flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-accent/50 ${
                  !notification.read ? "bg-accent/20" : ""
                }`}
              >
                <div
                  className={`mt-0.5 rounded-full p-2 ${
                    !notification.read
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm ${
                        !notification.read ? "font-semibold" : "font-medium"
                      }`}
                    >
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  {notification.body && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {notification.body}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {timeAgo(notification.created_at)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
