import {
  brandEmailDocument,
  brandPrimaryButton,
  escapeEmailHtml,
} from "@/lib/email/brand-shell";

export function passwordResetEmail(input: {
  confirmUrl: string;
}): { subject: string; html: string } {
  const href = input.confirmUrl;
  const html = brandEmailDocument(`
    <h2 style="margin-top:0; margin-right:0; margin-bottom:8px; margin-left:0; font-size:20px; line-height:28px; font-weight:700; color:#1a1a1a; letter-spacing:normal;">Reset Your Password</h2>
    <p style="margin-top:0; margin-right:0; margin-bottom:0; margin-left:0; font-size:15px; line-height:24px; color:#5c5c5c;">We received a request to reset the password for your MyDoctors360 account. Click the button below to choose a new password.</p>
    ${brandPrimaryButton("Reset Password", href)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb; border-radius:6px; margin-bottom:16px;">
      <tr>
        <td style="padding-top:16px; padding-right:16px; padding-bottom:16px; padding-left:16px;">
          <p style="margin-top:0; margin-right:0; margin-bottom:8px; margin-left:0; font-size:13px; line-height:20px; color:#1a1a1a;"><strong>Password tips:</strong></p>
          <p style="margin-top:0; margin-right:0; margin-bottom:4px; margin-left:0; font-size:13px; line-height:20px; color:#5c5c5c;">Use at least 8 characters</p>
          <p style="margin-top:0; margin-right:0; margin-bottom:4px; margin-left:0; font-size:13px; line-height:20px; color:#5c5c5c;">Include a mix of letters, numbers, and symbols</p>
          <p style="margin-top:0; margin-right:0; margin-bottom:0; margin-left:0; font-size:13px; line-height:20px; color:#5c5c5c;">Avoid reusing passwords from other sites</p>
        </td>
      </tr>
    </table>
    <p style="margin-top:0; margin-right:0; margin-bottom:8px; margin-left:0; font-size:13px; line-height:20px; color:#5c5c5c;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.</p>
    <p style="margin-top:16px; margin-right:0; margin-bottom:0; margin-left:0; padding-top:16px; font-size:12px; line-height:18px; color:#9ca3af; border-top:1px solid #e5e7eb;">If the button doesn't work, copy and paste this link into your browser:<br />
      <a href="${escapeEmailHtml(href)}" style="color:#0B6BCB; text-decoration:underline; word-break:break-all;">${escapeEmailHtml(href)}</a>
    </p>
  `);
  return { subject: "Reset Your Password", html };
}
