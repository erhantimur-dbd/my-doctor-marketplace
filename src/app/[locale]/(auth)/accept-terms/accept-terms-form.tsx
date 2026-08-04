"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { acceptTerms } from "./actions";

interface AcceptTermsFormProps {
  locale: string;
  next: string;
  firstName?: string;
}

export function AcceptTermsForm({
  locale,
  next,
  firstName,
}: AcceptTermsFormProps) {
  const t = useTranslations("auth");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    formData.set("locale", locale);
    formData.set("next", next);
    formData.set("accepted", accepted ? "true" : "false");
    const result = await acceptTerms(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          {t("accept_terms_title")}
        </CardTitle>
        <CardDescription>
          {firstName
            ? t("accept_terms_subtitle_named", { name: firstName })
            : t("accept_terms_subtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <p className="mb-4 text-sm text-muted-foreground">
          {t("accept_terms_body")}
        </p>

        <form action={handleSubmit} className="space-y-6">
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <Checkbox
              id="accept-terms"
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="accept-terms"
              className="text-sm font-normal leading-relaxed cursor-pointer"
            >
              {t.rich("accept_terms_checkbox", {
                terms: (chunks) => (
                  <Link
                    href="/terms"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    target="_blank"
                  >
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link
                    href="/privacy"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    target="_blank"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </Label>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!accepted || loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("accept_terms_continue")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
