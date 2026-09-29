const CODE_MESSAGES: Record<string, string> = {
  passkey_disabled:
    "Passkeys are not enabled for this environment yet. Please sign in with email.",
  too_many_passkeys: "You have reached the maximum number of passkeys for this account.",
  webauthn_credential_exists: "This device or authenticator is already registered.",
  webauthn_credential_not_found:
    "That passkey is not registered on this account. Try another sign-in method.",
  webauthn_challenge_not_found: "The passkey prompt expired. Please try again.",
  webauthn_challenge_expired: "The passkey prompt expired. Please try again.",
  webauthn_verification_failed:
    "We could not verify this passkey. Please try again or use another method.",
  email_not_confirmed: "Please verify your email address before signing in.",
  phone_not_confirmed: "Please verify your phone number before signing in.",
  user_banned: "This account is not allowed to sign in.",
};

export function passkeyErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  const obj = err as {
    code?: string;
    message?: string;
    name?: string;
  };
  const code = typeof obj.code === "string" ? obj.code : "";
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  const message = typeof obj.message === "string" ? obj.message : String(err);
  const lower = message.toLowerCase();
  if (
    lower.includes("not allowed") ||
    lower.includes("abort") ||
    lower.includes("cancel") ||
    obj.name === "NotAllowedError" ||
    obj.name === "AbortError"
  ) {
    return "Passkey sign-in was cancelled.";
  }
  if (
    lower.includes("not supported") ||
    obj.name === "NotSupportedError" ||
    lower.includes("publickeycredential")
  ) {
    return "This browser or device does not support passkeys.";
  }
  if (lower.includes("passkey_disabled") || lower.includes("passkeys are not enabled")) {
    return CODE_MESSAGES.passkey_disabled;
  }
  return fallback;
}

export function isUserCancelledPasskey(err: unknown): boolean {
  const obj = err as { name?: string; message?: string } | null;
  const name = obj?.name || "";
  const message = (obj?.message || "").toLowerCase();
  return (
    name === "NotAllowedError" ||
    name === "AbortError" ||
    message.includes("abort") ||
    message.includes("cancel")
  );
}
