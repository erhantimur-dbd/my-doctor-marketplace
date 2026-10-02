/**
 * Customer-facing links in booking confirmation and refund mail.
 * A Vercel alias is not a production host. Apex .com becomes www.
 * Localhost and the other brand TLDs stay as configured.
 */

const PRODUCTION_COM = "https://www.mydoctors360.com";

export function patientFacingEmailOrigin(candidate?: string | null): string {
  const raw = (
    candidate ||
    process.env.NEXT_PUBLIC_APP_URL ||
    PRODUCTION_COM
  )
    .trim()
    .replace(/\/$/, "");

  let host = "";
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return PRODUCTION_COM;
  }

  if (
    host === "localhost" ||
    host.startsWith("127.") ||
    host.startsWith("0.0.0.0")
  ) {
    return raw;
  }
  if (host.endsWith(".vercel.app")) return PRODUCTION_COM;
  if (host === "mydoctors360.com" || host === "www.mydoctors360.com") {
    return PRODUCTION_COM;
  }
  if (host === "mydoctors360.co.uk" || host === "www.mydoctors360.co.uk") {
    return "https://www.mydoctors360.co.uk";
  }
  if (host === "mydoctors360.eu" || host === "www.mydoctors360.eu") {
    return "https://www.mydoctors360.eu";
  }
  return PRODUCTION_COM;
}
