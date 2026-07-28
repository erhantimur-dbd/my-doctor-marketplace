"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import {
  subscribeToAvailability,
  subscribeAsGuest,
  unsubscribeFromAvailability,
  getAvailabilityAlert,
} from "@/actions/availability-alerts";

interface NotifyMeButtonProps {
  doctorId: string;
}

export function NotifyMeButton({ doctorId }: NotifyMeButtonProps) {
  const [subscribed, setSubscribed] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    getAvailabilityAlert(doctorId)
      .then((result) => {
        setSubscribed(result.subscribed);
        setIsLoggedIn(result.isLoggedIn);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [doctorId]);

  function handleLoggedInToggle() {
    startTransition(async () => {
      try {
        if (subscribed) {
          const result = await unsubscribeFromAvailability(doctorId);
          if (result.error) {
            toast.error(result.error);
          } else {
            setSubscribed(false);
            toast.success(
              "You will no longer receive availability notifications."
            );
          }
        } else {
          const result = await subscribeToAvailability(doctorId);
          if (result.error === "login_required") {
            setIsLoggedIn(false);
            setDialogOpen(true);
            return;
          }
          if (result.error) {
            toast.error(result.error);
          } else {
            setSubscribed(true);
            toast.success(
              "We'll notify you when this doctor has new availability!"
            );
          }
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  function submitGuest(form: HTMLFormElement) {
    setFormError(null);

    // Prefer FormData so browser autofill values are included even when
    // React onChange never fired (common for password-manager yellow fields).
    const fd = new FormData(form);
    const emailValue = String(fd.get("email") || email || "").trim();
    const nameValue = String(fd.get("name") || name || "").trim();
    // Honeypot: only treat as bot if the trap field is non-empty
    const honeypotValue = String(fd.get("website_url_hp") || "").trim();

    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setFormError("Please enter a valid email address.");
      return;
    }
    if (!consent) {
      setFormError("Please agree to receive availability emails.");
      return;
    }
    if (!doctorId) {
      setFormError("Missing doctor. Please refresh and try again.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await subscribeAsGuest({
          doctorId,
          email: emailValue,
          name: nameValue || null,
          consent: true,
          source: "doctor_card",
          honeypot: honeypotValue,
        });
        if (result.error) {
          setFormError(result.error);
          toast.error(result.error);
          return;
        }
        setDialogOpen(false);
        setSubscribed(true);
        setFormError(null);
        toast.success(
          "Thanks — we'll email you when this doctor has new openings."
        );
      } catch {
        const msg = "Something went wrong. Please try again.";
        setFormError(msg);
        toast.error(msg);
      }
    });
  }

  function handleGuestSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submitGuest(e.currentTarget);
  }

  function handleClick() {
    if (isLoggedIn) {
      handleLoggedInToggle();
    } else {
      if (subscribed) {
        toast.message(
          "Check your email for an unsubscribe link, or use the same form to re-subscribe."
        );
        setDialogOpen(true);
        return;
      }
      setFormError(null);
      setDialogOpen(true);
    }
  }

  if (!loaded) {
    return (
      <Button variant="secondary" className="w-full gap-2" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={subscribed ? "outline" : "secondary"}
        onClick={handleClick}
        disabled={isPending}
        className="w-full gap-2"
        size="sm"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : subscribed ? (
          <BellOff className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        {subscribed
          ? isLoggedIn
            ? "Subscribed — Tap to Unsubscribe"
            : "You're on the waitlist"
          : "Notify Me When Available"}
      </Button>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setFormError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Get notified when slots open</DialogTitle>
            <DialogDescription>
              Leave your email and we&apos;ll message you as soon as this doctor
              has new appointments. No account required.
            </DialogDescription>
          </DialogHeader>

          <form
            ref={formRef}
            onSubmit={handleGuestSubmit}
            className="space-y-4"
            noValidate
          >
            {/* Honeypot — obscure name so password managers don't autofill it */}
            <div
              className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
              aria-hidden
            >
              <label htmlFor="website_url_hp">Website</label>
              <input
                id="website_url_hp"
                type="text"
                name="website_url_hp"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="waitlist-name">Name (optional)</Label>
              <Input
                id="waitlist-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                maxLength={120}
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="waitlist-email">Email</Label>
              <Input
                id="waitlist-email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div className="flex items-start gap-2.5">
              <Checkbox
                id="waitlist-consent"
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5 shrink-0"
              />
              <label
                htmlFor="waitlist-consent"
                className="text-sm font-normal leading-relaxed text-muted-foreground"
              >
                I agree to receive an email when this doctor has availability.
                See our{" "}
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

            {formError && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {formError}
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !consent}
                onClick={(e) => {
                  // Belt-and-suspenders: some browsers / autofill combos skip form onSubmit
                  if (!formRef.current) return;
                  // Let native submit handle it unless we're sure we need manual path
                  // Only force if the click would otherwise no-op
                  if (isPending || !consent) {
                    e.preventDefault();
                    if (!consent) {
                      setFormError(
                        "Please agree to receive availability emails."
                      );
                    }
                  }
                }}
              >
                {isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Notify me
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
