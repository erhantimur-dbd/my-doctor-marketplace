"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { notifyPasskeyAdded } from "@/actions/passkeys";

type PasskeyItem = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

function browserSupportsPasskeys(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}

function formatPasskeyDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function passkeyErrorMessage(
  error: { message?: string; code?: string } | null | undefined,
  t: ReturnType<typeof useTranslations>
): string {
  const code = error?.code || "";
  const message = (error?.message || "").toLowerCase();
  if (code === "passkey_disabled" || message.includes("passkey_disabled")) {
    return t("error_not_enabled");
  }
  if (code === "too_many_passkeys" || message.includes("too_many_passkeys")) {
    return t("error_too_many");
  }
  if (
    code === "webauthn_credential_exists" ||
    message.includes("already been registered") ||
    message.includes("credential_exists")
  ) {
    return t("error_already_registered");
  }
  if (
    message.includes("not allowed") ||
    message.includes("abort") ||
    message.includes("cancel")
  ) {
    return t("error_cancelled");
  }
  return t("error_generic");
}

export function PasskeySection({
  settingsPath,
}: {
  /** Absolute path for the security email settings link, e.g. /en/dashboard/settings */
  settingsPath: string;
}) {
  const t = useTranslations("passkeys");
  const locale = useLocale();

  const [loading, setLoading] = useState(true);
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const supported = browserSupportsPasskeys();

  const refresh = useCallback(async () => {
    const client = createClient();
    try {
      const { data, error } = await client.auth.passkey.list();
      if (error) {
        // Project may not have passkeys enabled yet — show empty, not a hard fail.
        console.error("Passkey list error:", error);
        setPasskeys([]);
        return;
      }
      setPasskeys(data ?? []);
    } catch (err) {
      console.error("Passkey list failed:", err);
      setPasskeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate() {
    if (!supported) {
      toast.error(t("error_unsupported"));
      return;
    }

    setCreating(true);
    try {
      const client = createClient();
      const { data, error } = await client.auth.registerPasskey();
      if (error || !data) {
        toast.error(passkeyErrorMessage(error, t));
        return;
      }

      toast.success(t("success_created"));
      await refresh();

      const notify = await notifyPasskeyAdded({ settingsPath });
      if (notify.error) {
        // Passkey was created — email is best-effort.
        console.error("Passkey notify failed:", notify.error);
      }
    } catch (err) {
      console.error("Passkey create failed:", err);
      toast.error(t("error_generic"));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(passkeyId: string) {
    setDeletingId(passkeyId);
    try {
      const client = createClient();
      const { error } = await client.auth.passkey.delete({ passkeyId });
      if (error) {
        toast.error(passkeyErrorMessage(error, t));
        return;
      }
      toast.success(t("success_removed"));
      setPasskeys((prev) => prev.filter((p) => p.id !== passkeyId));
    } catch (err) {
      console.error("Passkey delete failed:", err);
      toast.error(t("error_generic"));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!supported && (
          <p className="text-sm text-muted-foreground">{t("unsupported_hint")}</p>
        )}

        {passkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-3">
            {passkeys.map((pk) => (
              <li
                key={pk.id}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {pk.friendly_name || t("unnamed")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("added_on", {
                      date: formatPasskeyDate(pk.created_at, locale),
                    })}
                    {pk.last_used_at
                      ? ` · ${t("last_used", {
                          date: formatPasskeyDate(pk.last_used_at, locale),
                        })}`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deletingId === pk.id}
                  onClick={() => handleDelete(pk.id)}
                  aria-label={t("remove")}
                >
                  {deletingId === pk.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Button
          type="button"
          onClick={handleCreate}
          disabled={!supported || creating}
        >
          {creating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {t("add")}
        </Button>
      </CardContent>
    </Card>
  );
}
