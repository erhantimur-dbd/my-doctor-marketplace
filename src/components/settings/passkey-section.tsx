"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale, useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Fingerprint,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  browserSupportsPasskeys,
  hostMatchesWebAuthnRp,
} from "@/lib/auth/webauthn";
import {
  isUserCancelledPasskey,
  passkeyErrorMessage,
} from "@/lib/auth/passkey-errors";
import { notifyPasskeyAdded } from "@/actions/passkeys";

type PasskeyRow = {
  id: string;
  friendly_name?: string | null;
  created_at: string;
  last_used_at?: string | null;
};

function formatWhen(iso: string | null | undefined, neverLabel: string) {
  if (!iso) return neverLabel;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return neverLabel;
  }
}

export function PasskeySection() {
  const t = useTranslations("passkeys");
  const locale = useLocale();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(false);
  const [hostOk, setHostOk] = useState(true);
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.passkey.list();
      if (error) {
        setPasskeys([]);
        return;
      }
      setPasskeys((data ?? []) as PasskeyRow[]);
    } catch {
      setPasskeys([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    setSupported(browserSupportsPasskeys());
    setHostOk(
      typeof window !== "undefined"
        ? hostMatchesWebAuthnRp(window.location.hostname)
        : true
    );
    void refresh();
  }, [refresh]);

  async function handleRegister() {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.registerPasskey();
      if (error) {
        if (!isUserCancelledPasskey(error)) {
          toast.error(passkeyErrorMessage(error, t("error_generic")));
        }
        return;
      }
      toast.success(t("success_added"));
      await refresh();

      // Best-effort Tesla-style security email; enrollment already succeeded.
      const path =
        typeof window !== "undefined" &&
        window.location.pathname.includes("/settings")
          ? window.location.pathname
          : `/${locale}/dashboard/settings`;
      const notify = await notifyPasskeyAdded({ settingsPath: path });
      if (notify.error) {
        console.error("Passkey notify failed:", notify.error);
      }
    } catch (err) {
      if (!isUserCancelledPasskey(err)) {
        toast.error(passkeyErrorMessage(err, t("error_generic")));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRename() {
    if (!renameId || !renameValue.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.passkey.update({
        passkeyId: renameId,
        friendlyName: renameValue.trim().slice(0, 120),
      });
      if (error) {
        toast.error(passkeyErrorMessage(error, t("error_generic")));
        return;
      }
      toast.success(t("success_renamed"));
      setRenameId(null);
      await refresh();
    } catch (err) {
      toast.error(passkeyErrorMessage(err, t("error_generic")));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.passkey.delete({
        passkeyId: deleteId,
      });
      if (error) {
        toast.error(passkeyErrorMessage(error, t("error_generic")));
        return;
      }
      toast.success(t("success_deleted"));
      setDeleteId(null);
      await refresh();
    } catch (err) {
      toast.error(passkeyErrorMessage(err, t("error_generic")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!supported && (
            <p className="text-sm text-muted-foreground">{t("not_available")}</p>
          )}
          {supported && !hostOk && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t("rp_mismatch")}
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : passkeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="space-y-2">
              {passkeys.map((pk) => (
                <li
                  key={pk.id}
                  className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <KeyRound className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {pk.friendly_name || t("unnamed")}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("created")}: {formatWhen(pk.created_at, "—")}
                      {" · "}
                      {t("last_used")}:{" "}
                      {formatWhen(pk.last_used_at, t("never_used"))}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setRenameValue(pk.friendly_name || "");
                        setRenameId(pk.id);
                      }}
                      aria-label={t("rename")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteId(pk.id)}
                      aria-label={t("delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Button
            onClick={handleRegister}
            disabled={!supported || !hostOk || busy}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {t("add")}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!renameId} onOpenChange={(open) => !open && setRenameId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("rename_title")}</DialogTitle>
            <DialogDescription>{t("rename_desc")}</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={120}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleRename} disabled={!renameValue.trim() || busy}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("delete_title")}</DialogTitle>
            <DialogDescription>{t("delete_desc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
