"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  SendHorizonal,
} from "lucide-react";
import { sendTestEmail, sendAllTestEmails } from "@/actions/test-emails";
import { TEMPLATE_LIST, type TemplateKey } from "@/lib/email/template-list";

type Status = "idle" | "sending" | "success" | "error";

export function EmailTestPanel({ userEmail }: { userEmail: string }) {
  const [email, setEmail] = useState(userEmail);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sendingAll, setSendingAll] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Group templates by category
  const categories = TEMPLATE_LIST.reduce(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, typeof TEMPLATE_LIST>
  );

  const handleSendOne = (key: TemplateKey) => {
    if (!email) return;
    setStatuses((s) => ({ ...s, [key]: "sending" }));
    setErrors((e) => ({ ...e, [key]: "" }));

    startTransition(async () => {
      const result = await sendTestEmail(key, email);
      const err = "error" in result ? String(result.error) : "";
      if (err) {
        setStatuses((s) => ({ ...s, [key]: "error" }));
        setErrors((e) => ({ ...e, [key]: err }));
      } else {
        setStatuses((s) => ({ ...s, [key]: "success" }));
      }
    });
  };

  const handleSendAll = () => {
    if (!email) return;
    setSendingAll(true);
    setAllDone(false);
    // Mark all as sending
    const sending: Record<string, Status> = {};
    TEMPLATE_LIST.forEach(({ key }) => (sending[key] = "sending"));
    setStatuses(sending);
    setErrors({});

    startTransition(async () => {
      const result = await sendAllTestEmails(email);
      if (result.error) {
        const errStatuses: Record<string, Status> = {};
        TEMPLATE_LIST.forEach(({ key }) => (errStatuses[key] = "error"));
        setStatuses(errStatuses);
        setSendingAll(false);
        return;
      }
      const newStatuses: Record<string, Status> = {};
      const newErrors: Record<string, string> = {};
      result.results?.forEach((r) => {
        newStatuses[r.key] = r.success ? "success" : "error";
        if (r.error) newErrors[r.key] = r.error;
      });
      setStatuses(newStatuses);
      setErrors(newErrors);
      setSendingAll(false);
      setAllDone(true);
    });
  };

  const successCount = Object.values(statuses).filter(
    (s) => s === "success"
  ).length;
  const errorCount = Object.values(statuses).filter(
    (s) => s === "error"
  ).length;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                type="email"
                placeholder="Recipient email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
              />
            </div>
            <Button
              onClick={handleSendAll}
              disabled={!email || sendingAll || isPending}
              className="shrink-0"
            >
              {sendingAll ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SendHorizonal className="mr-2 h-4 w-4" />
              )}
              Send All 24 Templates
            </Button>
          </div>

          {/* Summary bar */}
          {(successCount > 0 || errorCount > 0) && (
            <div className="mt-3 flex items-center gap-4 text-sm">
              {successCount > 0 && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {successCount} sent
                </span>
              )}
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="h-4 w-4" />
                  {errorCount} failed
                </span>
              )}
              {allDone && (
                <Badge variant="outline" className="text-xs">
                  Batch complete
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Templates by category */}
      {Object.entries(categories).map(([category, items]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {category}
              <Badge variant="secondary" className="text-xs font-normal">
                {items.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {items.map(({ key, label }) => {
                const status = statuses[key] || "idle";
                const error = errors[key];

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {status === "success" && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      )}
                      {status === "error" && (
                        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                      {status === "sending" && (
                        <Loader2 className="h-4 w-4 text-sky-500 animate-spin shrink-0" />
                      )}
                      {status === "idle" && (
                        <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {key}
                        </span>
                        {error && (
                          <p className="text-xs text-red-500 truncate">
                            {error}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSendOne(key)}
                      disabled={
                        !email || status === "sending" || sendingAll || isPending
                      }
                      className="shrink-0 ml-2"
                    >
                      {status === "sending" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
