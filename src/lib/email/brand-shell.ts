/**
 * Agreed patient-mail header: blue-to-teal gradient, wordmark, tagline,
 * hairline. No specialty emoji strip.
 */

import { patientFacingEmailOrigin } from "@/lib/http/email-origin";

const FONT =
  "Arial, Helvetica, sans-serif";

export function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function brandEmailDocument(bodyHtml: string): string {
  const origin = patientFacingEmailOrigin();
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>MyDoctors360</title>
</head>
<body style="margin-top:0; margin-right:0; margin-bottom:0; margin-left:0; padding-top:0; padding-right:0; padding-bottom:0; padding-left:0; background-color:#f7f5f0; font-family:${FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f5f0;">
    <tr>
      <td align="center" style="padding-top:32px; padding-right:16px; padding-bottom:32px; padding-left:16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background-color:#ffffff; border-radius:8px;">
          <tr>
            <td align="center" bgcolor="#0B6BCB" style="background-color:#0B6BCB; background:linear-gradient(90deg, #0B6BCB 0%, #14B8A6 100%); padding-top:28px; padding-right:32px; padding-bottom:10px; padding-left:32px;">
              <h1 style="margin-top:0; margin-right:0; margin-bottom:0; margin-left:0; color:#ffffff; font-size:24px; line-height:32px; font-weight:700; font-family:${FONT}; letter-spacing:normal;">MyDoctors360</h1>
              <p style="margin-top:6px; margin-right:0; margin-bottom:0; margin-left:0; color:#ffffff; font-size:13px; line-height:18px; font-weight:400; font-family:${FONT}; letter-spacing:normal;">Where Patients Meet the Right Doctor</p>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#0B6BCB" style="background-color:#0B6BCB; background:linear-gradient(90deg, #0B6BCB 0%, #14B8A6 100%); padding-top:8px; padding-right:32px; padding-bottom:22px; padding-left:32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td width="120" height="1" style="width:120px; height:1px; max-height:1px; font-size:0; line-height:0; background-color:rgba(255,255,255,0.40);">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top:32px; padding-right:32px; padding-bottom:8px; padding-left:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px; padding-right:32px; padding-bottom:28px; padding-left:32px; background-color:#f9fafb; border-top:1px solid #e5e7eb;">
              <p style="margin-top:0; margin-right:0; margin-bottom:0; margin-left:0; font-size:12px; line-height:18px; color:#5c5c5c; font-family:${FONT};">This email was sent by MyDoctors360. If you have questions, please contact our support team.</p>
              <p style="margin-top:8px; margin-right:0; margin-bottom:0; margin-left:0; font-size:12px; line-height:18px; color:#9ca3af; font-family:${FONT};">
                <a href="${origin}/en/dashboard/settings" style="color:#6b7280; text-decoration:underline;">Manage email preferences</a>
                &nbsp;&middot;&nbsp;
                <a href="${origin}/en/privacy" style="color:#6b7280; text-decoration:underline;">Privacy Policy</a>
              </p>
              <p style="margin-top:8px; margin-right:0; margin-bottom:0; margin-left:0; font-size:12px; line-height:18px; color:#9ca3af; font-family:${FONT};">&copy; ${year} MyDoctors360. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function brandPrimaryButton(label: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px; margin-bottom:24px;">
      <tr>
        <td align="center" bgcolor="#0B6BCB" style="background-color:#0B6BCB; border-radius:6px;">
          <a href="${escapeEmailHtml(href)}" target="_blank" style="display:inline-block; padding-top:12px; padding-right:24px; padding-bottom:12px; padding-left:24px; color:#ffffff; font-size:14px; line-height:20px; font-weight:600; text-decoration:none; font-family:${FONT}; letter-spacing:normal;">${escapeEmailHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}
