"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES } from "@/lib/constants/countries";
import {
  registerDoctorWithAnnualOffer,
  resumeAnnualOfferCheckout,
} from "@/actions/auth";

type OfferPreview = {
  token: string;
  email: string;
  specialtyLabel: string;
  offerName: string;
  plans: { id: string; label: string }[];
  copy: {
    emphasis: string;
    body: string;
    redeemLine: string;
    smallPrint: string;
  };
};

export function OfferSignupForm({ preview }: { preview: OfferPreview }) {
  const [tier, setTier] = useState(
    preview.plans[0]?.id === "professional_annual" ? "professional" : "starter"
  );
  const [country, setCountry] = useState("GB");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <div>
        <p className="text-sm text-muted-foreground">{preview.specialtyLabel}</p>
        <h1 className="mt-1 text-2xl font-bold">{preview.offerName}</h1>
      </div>
      <div className="space-y-2 rounded-lg border p-4">
        <p className="font-semibold">{preview.copy.emphasis}</p>
        <p className="text-sm">{preview.copy.body}</p>
        <p className="text-sm">{preview.copy.redeemLine}</p>
        <p className="text-xs text-muted-foreground">{preview.copy.smallPrint}</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("invite", preview.token);
          formData.set("tier", tier);
          formData.set("country", country);
          formData.set("email", preview.email);
          formData.set("locale", "en");
          if (country === "GB") formData.set("practising_country", "GB");
          startTransition(async () => {
            const result = await registerDoctorWithAnnualOffer(formData);
            if ("error" in result && result.error) {
              setError(result.error);
              return;
            }
            if ("checkoutUrl" in result && result.checkoutUrl) {
              window.location.href = result.checkoutUrl;
            }
          });
        }}
      >
        <div className="space-y-2">
          <Label>Plan</Label>
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {preview.plans.map((plan) => (
                <SelectItem
                  key={plan.id}
                  value={plan.id === "starter_annual" ? "starter" : "professional"}
                >
                  Annual {plan.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="first-name">First name</Label>
            <Input id="first-name" name="first_name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-name">Last name</Label>
            <Input id="last-name" name="last_name" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={preview.email} readOnly />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required minLength={8} />
        </div>
        <div className="space-y-2">
          <Label>Country</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((item) => (
                <SelectItem key={item.code} value={item.code}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" required />
        </div>
        {country === "GB" ? (
          <div className="space-y-2">
            <Label htmlFor="gmc">GMC number</Label>
            <Input id="gmc" name="gmc_number" inputMode="numeric" pattern="\d{7}" required />
          </div>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Starting checkout…" : "Continue to payment"}
        </Button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          const selected = tier;
          startTransition(async () => {
            const result = await resumeAnnualOfferCheckout(preview.token, selected);
            if ("error" in result && result.error) {
              setError(result.error);
              return;
            }
            if ("checkoutUrl" in result && result.checkoutUrl) {
              window.location.href = result.checkoutUrl;
            }
          });
        }}
      >
        Already registered? Continue checkout
      </Button>
    </div>
  );
}
