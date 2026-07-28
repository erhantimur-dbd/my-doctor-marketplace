"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Bell, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { joinSpecialtyWaitlist } from "@/actions/availability-alerts";
import { createClient } from "@/lib/supabase/client";
import { specialtySlugToLabel } from "@/lib/constants/related-specialties";

interface SpecialtyWaitlistCtaProps {
  specialtySlug: string;
  /** Optional country filter for the alert (e.g. GB) */
  countryCode?: string | null;
  className?: string;
}

/**
 * Empty-state CTA: "Notify me when a dermatologist has openings".
 * Guests provide name + email; logged-in users one-click join.
 */
export function SpecialtyWaitlistCta({
  specialtySlug,
  countryCode,
  className,
}: SpecialtyWaitlistCtaProps) {
  const label = specialtySlugToLabel(specialtySlug);
  const [open, setOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setIsLoggedIn(!!data.user);
        if (data.user?.email) setEmail(data.user.email);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function doJoin(opts?: { name?: string; email?: string }) {
    startTransition(async () => {
      const result = await joinSpecialtyWaitlist({
        specialtySlug,
        name: opts?.name,
        email: opts?.email,
        countryCode: countryCode || undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setJoined(true);
      toast.success(
        `You're on the ${label} waitlist — we'll email you when specialists open slots.`
      );
      setTimeout(() => setOpen(false), 1500);
    });
  }

  if (!loaded) return null;

  if (joined) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 ${className || ""}`}
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>
          You&apos;re on the {label} waitlist — we&apos;ll email you when new
          appointments open.
        </span>
      </div>
    );
  }

  if (isLoggedIn) {
    return (
      <div
        className={`flex flex-col items-stretch gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${className || ""}`}
      >
        <p className="text-sm text-amber-900">
          No {label} specialists match right now. Get notified when one opens
          new appointments.
        </p>
        <Button
          size="sm"
          onClick={() => doJoin()}
          disabled={isPending}
          className="shrink-0 gap-2"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          Notify me when a {label} opens slots
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-stretch gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${className || ""}`}
    >
      <p className="text-sm text-amber-900">
        No {label} specialists match right now. Get notified when one opens new
        appointments.
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="shrink-0 gap-2">
            <Bell className="h-4 w-4" />
            Notify me when a {label} opens slots
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join the {label} waitlist</DialogTitle>
            <DialogDescription>
              We&apos;ll email you when a {label} specialist opens new
              appointment slots. No account needed.
            </DialogDescription>
          </DialogHeader>
          {joined ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p className="font-medium">You&apos;re on the list</p>
              <p className="text-sm text-muted-foreground">
                Check your inbox for a confirmation.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                doJoin({ name: name.trim(), email: email.trim() });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="specialty-waitlist-name">Name</Label>
                <Input
                  id="specialty-waitlist-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialty-waitlist-email">Email</Label>
                <Input
                  id="specialty-waitlist-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                Join waitlist
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                No account needed. Unsubscribe anytime from the email.
              </p>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
