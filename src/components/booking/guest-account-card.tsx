"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { createGuestAccount } from "@/actions/guest-account";
import {
  EXISTING_ACCOUNT_MESSAGE,
  GUEST_SIGNUP_CARD_TITLE,
} from "@/lib/booking/guest-account-link";

export function GuestAccountCard({
  mode,
  bookingId,
  firstName,
  lastName,
  email,
  locale,
}: {
  mode: "create" | "login";
  bookingId: string;
  firstName: string;
  lastName: string;
  email: string;
  locale: string;
}) {
  const [view, setView] = useState(mode);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (view === "login") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{EXISTING_ACCOUNT_MESSAGE}</CardTitle>
          <CardDescription>
            An account with this email already exists. Sign in to see this
            booking in your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" asChild>
            <Link href={`/login?redirect=/${locale}/dashboard/bookings`}>
              {EXISTING_ACCOUNT_MESSAGE}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{GUEST_SIGNUP_CARD_TITLE}</CardTitle>
        <CardDescription>
          Optional. Your confirmation above stays as it is. Choose a password
          and we will attach bookings made with this email to your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            const form = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await createGuestAccount({
                bookingId,
                email: String(form.get("email") || email),
                password,
                firstName: String(form.get("first_name") || firstName),
                lastName: String(form.get("last_name") || lastName),
                locale,
              });
              if (result && !result.ok) {
                if (result.existingAccount) {
                  setView("login");
                  return;
                }
                setError(result.error);
              }
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="guest-first-name">First name</Label>
              <Input
                id="guest-first-name"
                name="first_name"
                defaultValue={firstName}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-last-name">Last name</Label>
              <Input
                id="guest-last-name"
                name="last_name"
                defaultValue={lastName}
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="guest-email">Email</Label>
            <Input
              id="guest-email"
              name="email"
              type="email"
              defaultValue={email}
              readOnly
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guest-password">Password</Label>
            <Input
              id="guest-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            We only attach bookings whose email matches this verified address.
          </p>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating account…" : GUEST_SIGNUP_CARD_TITLE}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
