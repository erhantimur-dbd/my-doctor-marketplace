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
import { createOfferInvite } from "@/actions/subscription-offers";
import { SPECIALTIES } from "@/lib/constants/specialties";
import { formatSpecialtyName } from "@/lib/utils";

type OfferOption = { id: string; name: string };

export function InviteForm({ offers }: { offers: OfferOption[] }) {
  const [specialty, setSpecialty] = useState("");
  const [offerId, setOfferId] = useState(offers[0]?.id || "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    url: string;
    qrSvg: string;
    emphasis: string;
    body: string;
    redeemLine: string;
    smallPrint: string;
  } | null>(null);

  const specialties = SPECIALTIES.filter((item) => item.category !== "testing");

  return (
    <div className="space-y-6">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("specialty_slug", specialty);
          formData.set("offer_id", offerId);
          startTransition(async () => {
            const created = await createOfferInvite(formData);
            if (created.error || !created.url || !created.qrSvg || !created.copy) {
              setError(created.error || "Could not create the link.");
              setResult(null);
              return;
            }
            setError("");
            setResult({
              url: created.url,
              qrSvg: created.qrSvg,
              emphasis: created.copy.emphasis,
              body: created.copy.body,
              redeemLine: created.copy.redeemLine,
              smallPrint: created.copy.smallPrint,
            });
          });
        }}
      >
        <div className="space-y-2">
          <Label>Specialty</Label>
          <Select value={specialty} onValueChange={setSpecialty}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a specialty" />
            </SelectTrigger>
            <SelectContent>
              {specialties.map((item) => (
                <SelectItem key={item.slug} value={item.slug}>
                  {formatSpecialtyName(item.nameKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Live offer</Label>
          <Select value={offerId} onValueChange={setOfferId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose an offer" />
            </SelectTrigger>
            <SelectContent>
              {offers.map((offer) => (
                <SelectItem key={offer.id} value={offer.id}>
                  {offer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="doctor-email">Doctor email</Label>
          <Input id="doctor-email" name="doctor_email" type="email" required />
        </div>
        <Button type="submit" disabled={pending || !specialty || !offerId}>
          {pending ? "Creating link…" : "Create signup link"}
        </Button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>

      {result ? (
        <div className="space-y-4 rounded-lg border p-4">
          <p className="text-sm font-semibold">{result.emphasis}</p>
          <p className="text-sm">{result.body}</p>
          <p className="text-sm">{result.redeemLine}</p>
          <p className="text-xs text-muted-foreground">{result.smallPrint}</p>
          <p className="break-all text-sm">
            <a href={result.url}>{result.url}</a>
          </p>
          <div
            className="h-[280px] w-[280px]"
            aria-label="Signup QR code"
            dangerouslySetInnerHTML={{ __html: result.qrSvg }}
          />
        </div>
      ) : null}
    </div>
  );
}
