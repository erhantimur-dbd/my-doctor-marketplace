/**
 * Account-security transactional emails.
 *
 * Deliberately monochrome and minimal (Tesla-style security notice), separate
 * from the marketing gradient layout in templates.ts.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";
const BRAND_NAME = "MyDoctors360";
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, Helvetica, sans-serif";

/** Display name for Resend / inbox — mirrors "Tesla Account Security". */
export const SECURITY_EMAIL_FROM =
  process.env.EMAIL_SECURITY_FROM ||
  "MyDoctors360 Account Security <noreply@mydoctors360.com>";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Small grey shield mark — matches the product logo, sized like Tesla's "T". */
function brandMark(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      <tr>
        <td style="line-height:0; font-size:0;">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M16 2 L28 7 L28 16 C28 23 22.5 28.5 16 30 C9.5 28.5 4 23 4 16 L4 7 Z" stroke="#9ca3af" stroke-width="2" stroke-linejoin="round" fill="none"/>
            <circle cx="12.5" cy="10" r="1.2" fill="#9ca3af"/>
            <circle cx="19.5" cy="10" r="1.2" fill="#9ca3af"/>
            <path d="M12.5 11.2 L12.5 13 Q12.5 15 16 15 Q19.5 15 19.5 13 L19.5 11.2" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            <line x1="16" y1="15" x2="16" y2="20" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="16" cy="22" r="2.2" fill="#9ca3af"/>
          </svg>
        </td>
      </tr>
    </table>`;
}

function securityLink(label: string, href: string): string {
  return `<a href="${escapeHtml(href)}" target="_blank" style="color:#171717; text-decoration:underline;">${escapeHtml(label)}</a>`;
}

/**
 * Tesla-style security shell: white canvas, left-aligned body, hairline footer.
 */
export function securityLayout(content: string): string {
  const year = new Date().getFullYear();
  const privacyUrl = `${APP_URL}/en/privacy`;
  const helpUrl = `${APP_URL}/en/help-center`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${BRAND_NAME} Account Security</title>
</head>
<body style="margin:0; padding:0; background-color:#ffffff; font-family:${FONT}; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background-color:#ffffff;">
          <tr>
            <td style="padding:40px 32px 8px; text-align:left;">
              ${brandMark()}
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #e5e5e5; padding-top:28px;">
                    <p style="margin:0 0 12px; font-size:13px; font-weight:600; color:#171717; letter-spacing:0.28em; text-transform:uppercase; font-family:${FONT};">
                      ${BRAND_NAME}
                    </p>
                    <p style="margin:0 0 10px; font-size:13px; font-weight:600; color:#525252; font-family:${FONT};">
                      ${year} ${BRAND_NAME}
                    </p>
                    <p style="margin:0; font-size:12px; color:#a3a3a3; font-family:${FONT};">
                      ${securityLink("Privacy & Legal", privacyUrl)}
                      &nbsp;|&nbsp;
                      ${securityLink("Help Center", helpUrl)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export interface PasskeyAddedEmailParams {
  /** Absolute URL to account settings (passkey management). */
  settingsUrl?: string;
  /** Absolute URL for support / help. */
  supportUrl?: string;
}

/**
 * Security notice when a new passkey is enrolled — subject matches Tesla:
 * "You Have Added A Passkey".
 */
export function passkeyAddedEmail({
  settingsUrl = `${APP_URL}/en/dashboard/settings`,
  supportUrl = `${APP_URL}/en/help-center`,
}: PasskeyAddedEmailParams = {}): { subject: string; html: string } {
  const subject = "You Have Added A Passkey";

  const content = `
    <h1 style="margin:0 0 16px; font-size:22px; font-weight:700; color:#000000; line-height:1.3; font-family:${FONT};">
      Passkey added
    </h1>
    <p style="margin:0 0 16px; font-size:15px; color:#404040; line-height:1.6; font-family:${FONT};">
      A new passkey was added to your ${BRAND_NAME} account. Enjoy a quicker, more secure way to sign in.
    </p>
    <p style="margin:0 0 16px; font-size:15px; color:#404040; line-height:1.6; font-family:${FONT};">
      If you did not make this change, go to ${securityLink("settings", settingsUrl)} to remove the unrecognized passkey and reset your password to secure your account.
    </p>
    <p style="margin:0; font-size:15px; color:#404040; line-height:1.6; font-family:${FONT};">
      Questions? Visit ${securityLink("Support", supportUrl)}.
    </p>
  `;

  return { subject, html: securityLayout(content) };
}
