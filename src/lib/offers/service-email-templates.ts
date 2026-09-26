import { EMAIL_APP_URL } from "@/lib/email/app-url";
import { formatOfferDate } from "@/lib/offers/dates";
import { formatGbpFromPence } from "@/lib/offers/money";
const BRAND = "#0284c7";

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;">
        <tr><td style="background:${BRAND};padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;">MyDoctors360</h1>
        </td></tr>
        <tr><td style="padding:32px;">${content}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function trialChargeReminderEmail(input: {
  planLabel: string;
  amountPence: number;
  chargeOn: Date;
  billingUrl?: string;
}): { subject: string; html: string } {
  const when = formatOfferDate(input.chargeOn);
  const amount = formatGbpFromPence(input.amountPence);
  const billingUrl =
    input.billingUrl || `${EMAIL_APP_URL}/en/doctor-dashboard/organization/billing`;
  const subject = `Your MyDoctors360 trial ends on ${when}`;
  const html = layout(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Your free period ends in 7 days</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
      We'll charge <strong>${amount}</strong> for annual ${input.planLabel} on <strong>${when}</strong> unless you cancel before then.
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
      Cancel any time in your account. If you cancel during the trial you won't be charged.
    </p>
    <p style="margin:0;font-size:14px;">
      <a href="${billingUrl}" style="color:${BRAND};">Review your subscription</a>
    </p>
  `);
  return { subject, html };
}

export function priceChangeNoticeEmail(input: {
  planLabel: string;
  fromPence: number;
  toPence: number;
  renewsOn: Date;
  billingUrl?: string;
}): { subject: string; html: string } {
  const when = formatOfferDate(input.renewsOn);
  const from = formatGbpFromPence(input.fromPence);
  const to = formatGbpFromPence(input.toPence);
  const billingUrl =
    input.billingUrl || `${EMAIL_APP_URL}/en/doctor-dashboard/organization/billing`;
  const subject = `Your MyDoctors360 ${input.planLabel} price changes on ${when}`;
  const html = layout(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Your plan price is changing</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
      From <strong>${when}</strong>, annual ${input.planLabel} renews at <strong>${to}</strong> a year instead of ${from}.
      This applies at renewal. You keep the current price until then.
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
      You can cancel before ${when}. Access continues until that date and there is no refund for time already paid.
    </p>
    <p style="margin:0;font-size:14px;">
      <a href="${billingUrl}" style="color:${BRAND};">Review your subscription</a>
    </p>
  `);
  return { subject, html };
}
