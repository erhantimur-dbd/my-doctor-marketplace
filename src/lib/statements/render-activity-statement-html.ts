import {
  ACTIVITY_STATEMENT_TITLE,
  formatStatementMoney,
  type ActivityStatement,
  type ActivityStatementLine,
  type ActivityStatementTotals,
} from "@/lib/statements/activity-statement";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(cents: number, currency: string): string {
  return esc(formatStatementMoney(cents, currency));
}

const cell =
  "padding:10px 8px;border-bottom:1px solid #e7e5e4;vertical-align:top;text-align:left";
const amountCell = `${cell};text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap`;

function totalsBlock(totals: ActivityStatementTotals): string {
  const items = [
    ["Bookings", String(totals.bookingsCount)],
    ["Gross consult", money(totals.grossConsultCents, totals.currency)],
    ["Refunds", money(totals.refundsCents, totals.currency)],
    ["Platform fees", money(totals.platformFeeCents, totals.currency)],
    ["Net to Connected Account", money(totals.netConnectedAccountCents, totals.currency)],
  ] as const;
  const rows = items
    .map(
      ([label, value]) => `<tr>
        <th scope="row" style="text-align:left;font-weight:500;padding:8px 12px;border-bottom:1px solid #e7e5e4;color:#44403c">${esc(label)}</th>
        <td style="text-align:right;padding:8px 12px;border-bottom:1px solid #e7e5e4;font-variant-numeric:tabular-nums;font-weight:${label === "Net to Connected Account" ? 650 : 500}">${value}</td>
      </tr>`
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 20px">
    <caption style="caption-side:top;text-align:left;font-weight:650;padding-bottom:8px">Month totals (${esc(totals.currency)})</caption>
    <tbody>${rows}</tbody>
  </table>`;
}

function lineRow(line: ActivityStatementLine): string {
  const settlement = line.settlementLabel
    ? `<div style="color:#57534e;font-weight:400;margin-top:2px">${esc(line.settlementLabel)}</div>`
    : "";
  return `<tr>
    <td style="${cell}">${esc(line.dateLabel)}</td>
    <td style="${cell}">${esc(line.bookingNumber)}</td>
    <td style="${cell}">${esc(line.patientLabel)}</td>
    <td style="${cell}"><div>${esc(line.serviceLabel)}</div><div style="color:#57534e;margin-top:2px">${esc(line.appointmentLabel)}</div></td>
    <td style="${cell}">${esc(line.statusLabel)}</td>
    <td style="${amountCell}">${money(line.connectedAccountCents, line.currency)}${settlement}</td>
    <td style="${amountCell}">${money(line.platformFeeCents, line.currency)}</td>
    <td style="${amountCell}">${money(line.refundAmountCents, line.currency)}</td>
  </tr>`;
}

const HEADINGS = [
  "Date",
  "Booking reference",
  "Patient",
  "Consultation",
  "Status",
  "Connected Account",
  "Platform fee",
  "Refund",
] as const;

export function renderActivityStatementBody(statement: ActivityStatement): string {
  const totals = statement.totals.map(totalsBlock).join("");
  const truncated = statement.truncated
    ? `<p style="border:1px solid #e7e5e4;padding:12px">This month has more rows than this statement could include. Contact support if you need the rest.</p>`
    : "";
  const table =
    statement.lines.length === 0
      ? "<p>No bookings or refunds in this month.</p>"
      : `<div style="max-width:100%;overflow-x:auto"><table style="width:max-content;min-width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr>${HEADINGS.map((heading) => {
            const align =
              heading === "Connected Account" ||
              heading === "Platform fee" ||
              heading === "Refund"
                ? "right"
                : "left";
            return `<th scope="col" style="text-align:${align};padding:8px;border-bottom:2px solid #1c1917;font-weight:650;vertical-align:bottom">${heading}</th>`;
          }).join("")}</tr></thead>
          <tbody>${statement.lines.map(lineRow).join("")}</tbody>
        </table></div>`;
  const clinicNote =
    statement.scopeLabel === "This clinic"
      ? "<p>Patient names are shown for your own bookings. Bookings with other clinicians in the clinic are listed by booking reference.</p>"
      : "";

  return `<article data-testid="activity-statement" style="background:#fff;color:#1c1917;font-family:Georgia,'Times New Roman',serif;line-height:1.45;padding:8px 4px 24px">
    <header style="border-bottom:2px solid #1c1917;margin-bottom:20px;padding-bottom:12px">
      <p style="margin:0;letter-spacing:0.04em;font-size:13px;text-transform:uppercase">MyDoctors360</p>
      <h1 style="font-size:28px;line-height:1.2;margin:6px 0 8px;font-weight:650">${esc(statement.title)}</h1>
      <p style="margin:0">${esc(statement.periodLabel)} · ${esc(statement.scopeLabel)}</p>
      <p style="margin:4px 0 0">Prepared for ${esc(statement.payeeName)}</p>
      <p style="margin:4px 0 0;color:#57534e">Generated ${esc(statement.generatedLabel)}</p>
    </header>
    ${truncated}
    ${totals}
    ${table}
    <footer style="margin-top:28px;font-size:14px">
      <p>${esc(statement.figuresNote)}</p>
      ${clinicNote}
      <p>${esc(statement.footer)}</p>
    </footer>
  </article>`;
}

export function renderActivityStatementHtml(statement: ActivityStatement): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${esc(ACTIVITY_STATEMENT_TITLE)}</title></head><body style="margin:24px;background:#fff">${renderActivityStatementBody(statement)}</body></html>`;
}
