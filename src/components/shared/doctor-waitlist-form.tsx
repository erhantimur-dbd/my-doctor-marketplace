"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle, Globe, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { joinDoctorWaitlist } from "@/actions/waitlist";
import { COUNTRIES } from "@/lib/constants/countries";
import { SPECIALTIES } from "@/lib/constants/specialties";
import { LAUNCH_REGIONS } from "@/lib/constants/launch-regions";

interface Props {
  preselectedCountry?: string;
}

export function DoctorWaitlistForm({ preselectedCountry }: Props) {
  const t = useTranslations("registerDoctor");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState(preselectedCountry || "");
  const [specialty, setSpecialty] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("country", country);
    formData.set("specialty", specialty);

    const result = await joinDoctorWaitlist(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <Card className="mx-auto max-w-lg border-emerald-200 bg-emerald-50/50">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold text-emerald-900">
            {t("waitlist_success_title")}
          </h3>
          <p className="text-sm text-emerald-700">
            {t("waitlist_success_description")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const launchRegionNames = LAUNCH_REGIONS.map(
    (r) => `${r.flag} ${r.name}`
  ).join(", ");

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Globe className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-xl">{t("waitlist_title")}</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("waitlist_description")}
        </p>
        <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Stethoscope className="mr-1 inline-block h-3 w-3" />
          {t("waitlist_current_regions")}: {launchRegionNames}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              name="name"
              placeholder={t("full_name")}
              required
              className="h-11"
            />
          </div>
          <div>
            <Input
              name="email"
              type="email"
              placeholder={t("email_address")}
              required
              className="h-11"
            />
          </div>
          <div>
            <Select value={specialty} onValueChange={setSpecialty} required>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t("select_specialty")} />
              </SelectTrigger>
              <SelectContent>
                {SPECIALTIES.map((s) => (
                  <SelectItem key={s.slug} value={s.slug}>
                    {s.nameKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={country} onValueChange={setCountry} required>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={t("select_country")} />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="h-11 w-full" disabled={loading}>
            {loading ? t("submitting") : t("join_waitlist")}
          </Button>
          {error && <p className="text-center text-sm text-red-600">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
