"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin, Bell, CheckCircle, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeToLaunchNotification } from "@/actions/waitlist";

interface Props {
  regionName: string;
  regionCode: string;
}

export function RegionNotAvailableBanner({ regionName, regionCode }: Props) {
  const t = useTranslations("search");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("region", regionCode);

    const result = await subscribeToLaunchNotification(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSubmitted(true);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <MapPin className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900">
            {t("region_not_available_title", { region: regionName })}
          </h3>
          <p className="mt-1 text-sm text-amber-700">
            {t("region_not_available_description")}
          </p>

          {/* Video consultation note */}
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2 text-sm text-emerald-700">
            <Video className="h-4 w-4 shrink-0" />
            <span>{t("video_available_globally")}</span>
          </div>

          {/* Notification sign-up */}
          {submitted ? (
            <div className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle className="h-4 w-4" />
              {t("region_notify_success")}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-2">
              <p className="text-xs font-medium text-amber-800">
                <Bell className="mr-1 inline-block h-3 w-3" />
                {t("region_notify_prompt")}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  name="name"
                  placeholder={t("your_name")}
                  required
                  className="h-9 bg-white text-sm"
                />
                <Input
                  name="email"
                  type="email"
                  placeholder={t("your_email")}
                  required
                  className="h-9 bg-white text-sm"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading}
                  className="h-9 whitespace-nowrap"
                >
                  {loading ? t("submitting") : t("notify_me")}
                </Button>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
