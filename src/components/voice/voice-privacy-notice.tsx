"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mic } from "lucide-react";

interface VoicePrivacyNoticeProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function VoicePrivacyNotice({
  onAccept,
  onDecline,
}: VoicePrivacyNoticeProps) {
  const t = useTranslations("voice");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-privacy-title"
    >
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle
            id="voice-privacy-title"
            className="flex items-center gap-2 text-lg"
          >
            <Mic className="h-5 w-5 text-primary" />
            {t("privacy_title")}
          </CardTitle>
          <CardDescription>{t("privacy_body")}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {/* Reinforces GDPR: process, do not store */}
          <p>{t("privacy_body")}</p>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onDecline}>
            {t("privacy_decline")}
          </Button>
          <Button type="button" onClick={onAccept}>
            {t("privacy_accept")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
