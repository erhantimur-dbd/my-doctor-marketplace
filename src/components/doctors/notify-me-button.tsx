"use client";

import { useState, useEffect, useTransition } from "react";
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
  const [honeypot, setHoneypot] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getAvailabilityAlert(doctorId).then((result) => {
      setSubscribed(result.subscribed);
      setIsLoggedIn(result.isLoggedIn);
      setLoaded(true);
    });
  }, [doctorId]);

  function handleLoggedInToggle() {
    startTransition(async () => {
      if (subscribed) {
        const result = await unsubscribeFromAvailability(doctorId);
        if (result.error) {
          toast.error(result.error);
        } else {
          setSubscribed(false);
          toast.success("You will no longer receive availability notifications.");
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
    });
  }

  function handleGuestSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await subscribeAsGuest({
        doctorId,
        email,
        name: name.trim() || null,
        consent,
        source: "doctor_card",
        honeypot,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setDialogOpen(false);
      setSubscribed(true);
      toast.success(
        "Thanks — we'll email you when this doctor has new openings."
      );
    });
  }

  function handleClick() {
    if (isLoggedIn) {
      handleLoggedInToggle();
    } else {
      // Guest or unknown — open email capture
      if (subscribed) {
        // Guest can't easily unsubscribe without token; open dialog again with note
        toast.message(
          "Check your email for an unsubscribe link, or use the same form to re-subscribe."
        );
        setDialogOpen(true);
        return;
      }
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Get notified when slots open</DialogTitle>
            <DialogDescription>
              Leave your email and we&apos;ll message you as soon as this doctor
              has new appointments. No account required.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGuestSubmit} className="space-y-4">
            {/* Honeypot — hidden from users */}
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

            <div className="space-y-2">
              <Label htmlFor="waitlist-name">Name (optional)</Label>
              <Input
                id="waitlist-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="waitlist-email">Email</Label>
              <Input
                id="waitlist-email"
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
              {/* Native label — ui/Label is flex and breaks inline Privacy Policy link */}
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

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !consent}>
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
