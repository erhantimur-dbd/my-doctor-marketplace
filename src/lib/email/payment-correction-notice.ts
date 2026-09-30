import { formatCurrency } from "@/lib/utils/currency";

export function paymentCorrectionNoticeEmail(input: {
  party: "patient" | "doctor";
  reason: string;
  amountCents: number;
  currency: string;
  method: string;
  clearRisk: boolean;
  clearRiskReason: string | null;
}): { subject: string; html: string } {
  const amount = formatCurrency(input.amountCents, input.currency);
  const reasonBlock =
    input.clearRisk && input.clearRiskReason
      ? `<p>We are acting before the usual 14 days because: ${escapeHtml(input.clearRiskReason)}</p>`
      : "";
  if (input.clearRisk && !input.clearRiskReason?.trim()) {
    throw new Error("A clear-risk notice must state the reason");
  }
  const subject = "Payment correction from MyDoctors360";
  const html = `
    <p>We need to correct a payment.</p>
    <p><strong>What happened:</strong> ${escapeHtml(input.reason)}</p>
    <p><strong>Amount:</strong> ${escapeHtml(amount)}</p>
    <p><strong>Method:</strong> ${escapeHtml(input.method)}</p>
    ${reasonBlock}
    <p>Reply to this email if you want to dispute it. A dispute pauses the correction.</p>
  `;
  return { subject, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
