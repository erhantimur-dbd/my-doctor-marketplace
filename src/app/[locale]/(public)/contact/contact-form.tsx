"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, Send } from "lucide-react";
import { submitContactInquiry } from "@/actions/contact";

const INQUIRY_TYPES = [
  { value: "doctor_onboarding", labelKey: "type_doctor_onboarding" },
  { value: "partnership", labelKey: "type_partnership" },
  { value: "press", labelKey: "type_press" },
  { value: "general", labelKey: "type_general" },
] as const;

export function ContactForm() {
  const t = useTranslations("contact");
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [inquiryType, setInquiryType] = useState("");

  function handleSubmit(formData: FormData) {
    setError("");

    // Set the inquiry_type from the Select (which doesn't use native form)
    formData.set("inquiry_type", inquiryType);

    startTransition(async () => {
      const result = await submitContactInquiry(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSubmitted(true);
      }
    });
  }

  if (submitted) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold">{t("thanks_title")}</h3>
          <p className="max-w-md text-muted-foreground">
            {t("thanks_desc")}
          </p>
          <Button
            variant="outline"
            className="mt-2 rounded-full"
            onClick={() => {
              setSubmitted(false);
              setInquiryType("");
            }}
          >
            {t("send_another")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <div className="flex flex-col items-center gap-2 bg-slate-50 px-6 py-6 dark:bg-slate-950/30">
        <Send className="h-7 w-7 text-slate-600" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("form_title")}
        </h3>
        <p className="text-center text-sm text-slate-600/70 dark:text-slate-400">
          {t("form_subtitle")}
        </p>
      </div>

      <CardContent className="pt-6">
        <form action={handleSubmit} className="space-y-5">
          {/* Honeypot — hidden from users, visible to bots */}
          <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              type="text"
              id="website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t("label_name")}</Label>
              <Input
                id="name"
                name="name"
                placeholder={t("placeholder_name")}
                required
                maxLength={100}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("label_email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t("placeholder_email")}
                required
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("label_type")}</Label>
            <Select
              value={inquiryType}
              onValueChange={setInquiryType}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("placeholder_type")} />
              </SelectTrigger>
              <SelectContent>
                {INQUIRY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {t(type.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">{t("label_message")}</Label>
            <Textarea
              id="message"
              name="message"
              placeholder={t("placeholder_message")}
              rows={5}
              required
              minLength={10}
              maxLength={2000}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              {t("message_hint")}
            </p>
          </div>

          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={isPending || !inquiryType}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("sending")}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {t("send_message")}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
