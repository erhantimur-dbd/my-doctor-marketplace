/** Cheap shape check before calling setSession with client-supplied tokens. */
export function looksLikeJwt(token: unknown): token is string {
  if (typeof token !== "string") return false;
  if (token.length < 40 || token.length > 8192) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  return parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part));
}

export function looksLikeRefreshToken(token: unknown): token is string {
  if (typeof token !== "string") return false;
  if (token.length < 20 || token.length > 8192) return false;
  return /^[A-Za-z0-9._~+/-]+$/.test(token);
}
