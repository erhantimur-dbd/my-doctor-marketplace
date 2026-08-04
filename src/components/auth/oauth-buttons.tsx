"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { signInWithOAuthProvider } from "@/actions/auth";
import {
  getEnabledOAuthProviders,
  type OAuthProviderId,
} from "@/lib/auth/oauth-providers";

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#00a4ef" d="M1 13h10v10H1z" />
      <path fill="#7fba00" d="M13 1h10v10H13z" />
      <path fill="#ffb900" d="M13 13h10v10H13z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const ICONS: Record<OAuthProviderId, () => ReactNode> = {
  google: GoogleIcon,
  apple: AppleIcon,
  facebook: FacebookIcon,
  azure: MicrosoftIcon,
  twitter: XIcon,
};

interface OAuthButtonsProps {
  locale: string;
  redirectTo?: string;
  onError?: (message: string) => void;
  /** Show the "or continue with" separator below the buttons (default true) */
  showSeparator?: boolean;
}

/**
 * Renders only providers enabled via env / oauth-providers config.
 * Returns null when none are enabled (email/password form stands alone).
 */
export function OAuthButtons({
  locale,
  redirectTo,
  onError,
  showSeparator = true,
}: OAuthButtonsProps) {
  const t = useTranslations("auth");
  const providers = getEnabledOAuthProviders();
  const [pendingId, setPendingId] = useState<OAuthProviderId | null>(null);

  if (providers.length === 0) return null;

  return (
    <>
      <div className="space-y-3">
        {providers.map((provider) => {
          const Icon = ICONS[provider.id];
          return (
            <form
              key={provider.id}
              action={async () => {
                setPendingId(provider.id);
                const result = await signInWithOAuthProvider(
                  provider.id,
                  locale,
                  redirectTo || undefined
                );
                if (result?.error) {
                  onError?.(result.error);
                  setPendingId(null);
                }
              }}
            >
              <Button
                variant="outline"
                className="h-11 w-full"
                type="submit"
                disabled={pendingId !== null}
              >
                <Icon />
                {t(provider.labelKey)}
              </Button>
            </form>
          );
        })}
      </div>

      {showSeparator && (
        <div className="my-6 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">
            {t("or_continue_with")}
          </span>
          <Separator className="flex-1" />
        </div>
      )}
    </>
  );
}
