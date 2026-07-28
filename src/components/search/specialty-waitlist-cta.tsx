"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, Loader2, CheckCircle2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { joinSpecialtyWaitlist } from "@/actions/availability-alerts";
import { createClient } from "@/lib/supabase/client";
import { specialtySlugToLabel } from "@/lib/constants/related-specialties";

interface SpecialtyWaitlistCtaProps {
  specialtySlug: string;
  countryCode?: string | null;
  placeName?: string | null;
  placeLat?: number | null;
  placeLng?: number | null;
  /** Inline form (default) vs compact banner — always one capture surface */
  variant?: "form" | "compact";
  className?: string;
}

/**
 * Single intent-capture surface for specialty demand.
 * Guests: name + email + consent. Logged-in: one-click.
 * Feeds admin recruiting dashboard (specialty × location).
 */
export function SpecialtyWaitlistCta({
  specialtySlug,
  countryCode,
  placeName,
  placeLat,
  placeLng,
  variant = "form",
  className,
}: SpecialtyWaitlistCtaProps) {
  const label = specialtySlugToLabel(specialtySlug);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
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

  function doJoin(opts?: { name?: string; email?: string; consent?: boolean }) {
    startTransition(async () => {
      const result = await joinSpecialtyWaitlist({
        specialtySlug,
        name: opts?.name,
        email: opts?.email,
        countryCode: countryCode || undefined,
        placeName: placeName || undefined,
        placeLat: placeLat ?? undefined,
        placeLng: placeLng ?? undefined,
        source: "search_empty",
        consent: isLoggedIn ? true : opts?.consent === true,
        honeypot,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setJoined(true);
      toast.success(
        `You're on the ${label} list — we'll email you when specialists open slots.`
      );
    });
  }

  if (!loaded) {
    return (
      <div
        className={`flex h-24 items-center justify-center rounded-xl border bg-muted/30 ${className || ""}`}
      >
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (joined) {
    return (
      <div
        className={`flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-left text-green-900 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-100 ${className || ""}`}
      >
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
        <div>
          <p className="font-medium">You&apos;re on the {label} list</p>
          <p className="mt-0.5 text-sm text-green-800/80 dark:text-green-200/80">
            We&apos;ll email you when a {label} specialist opens new appointments
            {placeName ? ` near ${placeName}` : ""}.
          </p>
        </div>
      </div>
    );
  }

  // Logged-in: compact one-click
  if (isLoggedIn) {
    return (
      <div
        className={`rounded-xl border border-primary/15 bg-primary/5 px-5 py-5 text-left ${className || ""}`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">
              Get notified when {label} opens up
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              No specialists match your search right now. We&apos;ll email you as
              soon as one has openings
              {placeName ? ` near ${placeName}` : ""}.
            </p>
          </div>
          <Button
            onClick={() => doJoin()}
            disabled={isPending}
            className="shrink-0 gap-2"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            Notify me
          </Button>
        </div>
      </div>
    );
  }

  // Guest: full inline form (not a second/third banner)
  return (
    <div
      className={`rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-teal-500/[0.04] px-5 py-5 text-left shadow-sm ${className || ""}`}
    >
      <div className="mb-4">
        <p className="text-base font-semibold text-foreground">
          Tell us you&apos;re looking for {label}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Leave your details and we&apos;ll email you when appointments open. No
          account required — this also helps us recruit specialists where
          patients are waiting.
        </p>
        {placeName && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {placeName}
            {label ? ` · ${label}` : ""}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          doJoin({ name: name.trim(), email: email.trim(), consent });
        }}
        className="space-y-3"
      >
        <input
          type="text"
          name="company"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="demand-name">Name</Label>
            <Input
              id="demand-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              maxLength={120}
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="demand-email">Email</Label>
            <Input
              id="demand-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Checkbox
            id="demand-consent"
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            className="mt-0.5 shrink-0"
          />
          {/* Use native label — ui/Label is flex and breaks inline Privacy Policy link */}
          <label
            htmlFor="demand-consent"
            className="text-sm font-normal leading-relaxed text-muted-foreground"
          >
            Email me when a {label} specialist has openings. See our{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              Privacy Policy
            </Link>
            .
          </label>
        </div>

        <div className="flex justify-center pt-1">
          <Button
            type="submit"
            disabled={isPending || !consent || !email.trim()}
            className="gap-2"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            {variant === "compact" ? "Notify me" : "Notify me when slots open"}
          </Button>
        </div>
      </form>
    </div>
  );
}
