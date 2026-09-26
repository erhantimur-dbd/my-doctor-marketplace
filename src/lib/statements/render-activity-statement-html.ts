import {
  ACTIVITY_STATEMENT_TITLE,
  formatStatementMoney,
  type ActivityStatement,
  type ActivityStatementLine,
  type ActivityStatementTotals,
} from "@/lib/statements/activity-statement";

/**
 * Softsmoke activity-statement sheet. Screen and download share this CSS
 * and markup. No web fonts. The action cell stays empty.
 *
 * The band and the closing note are divs. The app print stylesheet hides
 * every header and footer element, which removed both of these blocks.
 */
const ACTIVITY_STATEMENT_CSS = `
:root {
  --md-blue: #0B6BCB;
  --md-teal: #14B8A6;
  --paper: #f7f5f0;
  --card: #ffffff;
  --ink: #1a1a1a;
  --muted: #5c5c5c;
  --faint: #9ca3af;
  --soft: #f3f4f6;
  --soft-2: #f9fafb;
  --line: #e5e7eb;
  --card-edge: #e8e6e1;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
.md360-statement-page, .md360-statement-page *, .md360-statement-page *::before, .md360-statement-page *::after { box-sizing: border-box; letter-spacing: normal; }
html { -webkit-text-size-adjust: 100%; }
.md360-statement-page {
  margin: 0; padding: 32px 16px; background: var(--paper);
  font-family: var(--font); color: var(--ink); font-size: 14px; line-height: 1.5; letter-spacing: normal;
}
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.sheet {
  max-width: 960px; margin: 0 auto; background: var(--card);
  border: 1px solid var(--card-edge); border-radius: 8px; overflow: hidden;
}
.brand {
  background-color: var(--md-blue);
  background: linear-gradient(90deg, var(--md-blue) 0%, var(--md-teal) 100%);
  padding: 28px 32px 22px; text-align: center; color: #fff;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.brand__wordmark { margin: 0; font-size: 24px; font-weight: 700; line-height: 1.2; color: #fff; }
.brand__tagline { margin: 6px 0 0; font-size: 13px; font-weight: 400; color: rgba(255,255,255,0.90); }
.brand__hairline { width: 120px; height: 1px; margin: 18px auto 0; background: rgba(255,255,255,0.40); }
.content { padding: 28px 32px 24px; }
.section-title { margin: 0 0 10px; font-size: 13px; font-weight: 600; color: var(--ink); line-height: 1.3; }
.title-block { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 16px 32px; padding-bottom: 20px; margin-bottom: 24px; border-bottom: 1px solid var(--line); }
.title-block h1 { margin: 0; font-size: 22px; font-weight: 700; line-height: 1.25; color: var(--ink); }
.title-block__period { margin: 4px 0 0; font-size: 15px; color: var(--muted); }
.meta { display: grid; grid-template-columns: repeat(3, auto); gap: 4px 28px; margin: 0; }
.meta div { min-width: 0; }
.meta dt { font-size: 12px; color: var(--muted); }
.meta dd { margin: 2px 0 0; font-size: 13px; font-weight: 600; color: var(--ink); }
.notice { margin: 0 0 20px; padding: 12px 16px; background: var(--soft-2); border: 1px solid var(--line); border-radius: 8px; font-size: 13px; color: var(--ink); }
.empty { margin: 0; padding: 24px 16px; text-align: center; font-size: 14px; color: var(--muted); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.totals { margin-bottom: 28px; }
.totals__grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin: 0; background: var(--soft); border-radius: 8px; }
.totals__grid div { padding: 14px 16px; border-left: 1px solid var(--line); }
.totals__grid div:first-child { border-left: 0; }
.totals__grid dt { font-size: 12px; color: var(--muted); line-height: 1.35; }
.totals__grid dd { margin: 4px 0 0; font-size: 18px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
.totals__grid .is-net dd { font-weight: 700; }
.totals__grid .is-net dt { color: var(--ink); font-weight: 600; }
.totals__grid dd.is-zero { color: var(--faint); font-weight: 500; }
.totals__grid dd.is-negative { color: var(--muted); }
.lines__table { width: 100%; border-collapse: collapse; font-size: 13px; line-height: 1.4; }
.lines__table th {
  background: var(--soft-2); color: var(--muted); font-size: 12px; font-weight: 600; text-align: left;
  vertical-align: bottom; padding: 9px 8px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.lines__table td { padding: 11px 8px; border-bottom: 1px solid var(--line); vertical-align: top; color: var(--ink); }
.lines__table .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.lines__table th.num { white-space: normal; }
.lines__table td.is-zero { color: var(--faint); }
.lines__table td.is-negative { color: var(--muted); }
.col-date .d, .col-date .t, .col-service .svc, .col-service .sub, .num .sub { display: block; }
.col-date .t, .col-service .sub { color: var(--muted); margin-top: 1px; }
.num .sub { margin-top: 2px; font-size: 12px; color: var(--muted); white-space: normal; max-width: 160px; margin-left: auto; }
.col-ref { font-variant-numeric: tabular-nums; white-space: nowrap; }
.lines__table td.col-date { min-width: 116px; }
.lines__table td.col-service { min-width: 150px; }
.line--refund .col-status { color: var(--muted); }
.lines__table .col-action { width: 1%; white-space: nowrap; text-align: right; padding-left: 4px; padding-right: 0; }
.lines__table td.col-action:empty { padding: 0; }
.btn-report {
  display: inline-block; font-family: var(--font); font-size: 12px; font-weight: 600; line-height: 1;
  color: var(--md-blue); background: #fff; border: 1px solid var(--md-blue); border-radius: 6px;
  padding: 6px 10px; min-height: 28px; white-space: nowrap; cursor: pointer; letter-spacing: normal;
}
.btn-report:hover { background: #eef5fc; }
.btn-report:focus-visible { outline: 2px solid var(--md-blue); outline-offset: 2px; }
.foot { padding: 20px 32px 24px; background: var(--soft-2); border-top: 1px solid var(--line); }
.foot p { margin: 0 0 8px; font-size: 12px; line-height: 1.55; color: var(--muted); }
.foot p:last-child { margin-bottom: 0; }
.foot__legal { color: var(--ink) !important; }
@media screen and (max-width: 760px) {
  .meta { grid-template-columns: repeat(2, auto); }
  .totals__grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .totals__grid div:nth-child(4) { border-left: 0; }
  .totals__grid div:nth-child(n+4) { border-top: 1px solid var(--line); }
}
@media screen and (max-width: 860px) {
  .lines__table, .lines__table tbody, .lines__table tr, .lines__table td { display: block; width: 100%; }
  .lines__table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .lines__table tr { border: 1px solid var(--line); border-radius: 8px; padding: 2px 12px; margin: 0 0 12px; background: #fff; }
  .lines__table td {
    display: grid; grid-template-columns: max-content minmax(0, 1fr); column-gap: 12px; align-items: start;
    padding: 8px 0; border-bottom: 1px solid var(--line); text-align: right; white-space: normal;
  }
  .lines__table td:last-child, .lines__table td:nth-last-child(2):has(+ td.col-action:empty) { border-bottom: 0; }
  .lines__table td::before {
    content: attr(data-label); grid-column: 1; grid-row: 1 / span 3; text-align: left;
    font-size: 12px; font-weight: 500; color: var(--muted); padding-top: 1px;
  }
  .lines__table td > span { grid-column: 2; }
  .num .sub { max-width: none; margin-left: 0; }
  .lines__table td.col-action { display: block; text-align: left; padding: 10px 0 6px; }
  .lines__table td.col-action::before { content: none; }
  .lines__table td.col-action:empty { display: none; }
}
@media screen and (max-width: 1023px) {
  .lines__table.has-actions, .lines__table.has-actions tbody, .lines__table.has-actions tr, .lines__table.has-actions td { display: block; width: 100%; }
  .lines__table.has-actions thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .lines__table.has-actions tr { border: 1px solid var(--line); border-radius: 8px; padding: 2px 12px; margin: 0 0 12px; background: #fff; }
  .lines__table.has-actions td {
    display: grid; grid-template-columns: max-content minmax(0, 1fr); column-gap: 12px; align-items: start;
    padding: 8px 0; border-bottom: 1px solid var(--line); text-align: right; white-space: normal;
  }
  .lines__table.has-actions td:last-child, .lines__table.has-actions td:nth-last-child(2):has(+ td.col-action:empty) { border-bottom: 0; }
  .lines__table.has-actions td::before {
    content: attr(data-label); grid-column: 1; grid-row: 1 / span 3; text-align: left;
    font-size: 12px; font-weight: 500; color: var(--muted); padding-top: 1px;
  }
  .lines__table.has-actions td > span { grid-column: 2; }
  .num .sub { max-width: none; margin-left: 0; }
  .lines__table.has-actions td.col-action { display: block; text-align: left; padding: 10px 0 6px; }
  .lines__table.has-actions td.col-action::before { content: none; }
  .lines__table.has-actions td.col-action:empty { display: none; }
}
@media screen and (max-width: 480px) {
  .md360-statement-page { padding: 12px 8px; }
  .brand { padding: 22px 16px 18px; }
  .brand__wordmark { font-size: 22px; }
  .brand__hairline { margin-top: 14px; }
  .content { padding: 20px 16px 16px; }
  .title-block { display: block; padding-bottom: 16px; margin-bottom: 20px; }
  .meta { grid-template-columns: 1fr; gap: 8px; margin-top: 14px; }
  .totals { margin-bottom: 24px; }
  .totals__grid { display: block; padding: 4px 16px; }
  .totals__grid div { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 10px 0; border-left: 0; border-top: 0 !important; border-bottom: 1px solid var(--line); }
  .totals__grid div:last-child { border-bottom: 0; }
  .totals__grid dt { font-size: 13px; }
  .totals__grid dd { margin: 0; font-size: 15px; }
  .foot { padding: 16px; }
}
@page { size: A4; margin: 12mm; }
@media print {
  html, body, .md360-statement-page { background: #fff !important; }
  .md360-statement-page, .md360-statement-page * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .brand, .foot { display: block !important; }
  .brand {
    background-color: #0B6BCB !important;
    background-image: linear-gradient(90deg, #0B6BCB 0%, #14B8A6 100%) !important;
    color: #fff !important;
  }
  .brand__wordmark, .brand__tagline { color: #fff !important; }
  .brand__tagline { color: rgba(255,255,255,0.90) !important; }
  .totals__grid { background-color: #f3f4f6 !important; }
  .lines__table th { background-color: #f9fafb !important; }
  .foot { background-color: #f9fafb !important; }
  body, .md360-statement-page { padding: 0; font-size: 10px; line-height: 1.3; }
  .sheet { max-width: none; border: 0; border-radius: 0; overflow: visible; }
  .brand { padding: 12px 16px 11px; border-radius: 6px; }
  .brand__wordmark { font-size: 19px; }
  .brand__tagline { margin-top: 3px; font-size: 10.5px; }
  .brand__hairline { margin-top: 9px; }
  .content { padding: 12px 0 0; }
  .title-block { padding-bottom: 8px; margin-bottom: 10px; gap: 8px 20px; }
  .title-block h1 { font-size: 17px; }
  .title-block__period { margin-top: 1px; font-size: 11.5px; }
  .meta { gap: 2px 20px; }
  .meta dt { font-size: 9px; }
  .meta dd { font-size: 10px; margin-top: 1px; }
  .section-title { font-size: 10.5px; margin-bottom: 6px; }
  .totals { margin-bottom: 12px; break-inside: avoid; }
  .totals__grid { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .totals__grid div { padding: 7px 10px; }
  .totals__grid dt { font-size: 9px; }
  .totals__grid dd { font-size: 12.5px; margin-top: 1px; }
  .lines__table { font-size: 9.5px; line-height: 1.25; }
  .lines__table thead { display: table-header-group; }
  .lines__table th { font-size: 8.5px; padding: 4px 5px; }
  .lines__table td { padding: 4px 5px; }
  .col-date .d, .col-date .t, .col-service .svc, .col-service .sub, .col-patient { white-space: nowrap; }
  .lines__table td.col-date, .lines__table td.col-service { min-width: 0; }
  .lines__table tr { break-inside: avoid; page-break-inside: avoid; }
  .num .sub { font-size: 8.5px; max-width: 110px; }
  .lines__table .col-action { display: none !important; }
  .foot { margin-top: 10px; padding: 8px 10px; border-radius: 6px; -webkit-print-color-adjust: exact; print-color-adjust: exact; break-inside: avoid; }
  .foot p { font-size: 8.5px; line-height: 1.4; margin-bottom: 4px; }
}
`.trim();

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

function amountTone(cents: number): string {
  if (cents < 0) return "is-negative";
  if (cents === 0) return "is-zero";
  return "";
}

function splitDateLabel(label: string): { date: string; time: string | null } {
  const index = label.lastIndexOf(", ");
  if (index <= 0) return { date: label, time: null };
  return { date: label.slice(0, index), time: label.slice(index + 2) };
}

function dateCell(label: string): string {
  const parts = splitDateLabel(label);
  const time = parts.time ? `<span class="t">${esc(parts.time)}</span>` : "";
  return `<td data-label="Date" class="col-date"><span class="d">${esc(parts.date)}</span>${time}</td>`;
}

function moneyCell(label: string, cents: number, currency: string, note: string | null): string {
  const tone = amountTone(cents);
  const classes = ["num", tone].filter(Boolean).join(" ");
  const sub = note ? `<span class="sub">${esc(note)}</span>` : "";
  return `<td data-label="${esc(label)}" class="${classes}">${money(cents, currency)}${sub}</td>`;
}

function totalsBlock(totals: ActivityStatementTotals, headingId: string): string {
  const cells: Array<{ label: string; value: string; cents: number | null; net?: boolean }> = [
    { label: "Bookings", value: String(totals.bookingsCount), cents: totals.bookingsCount === 0 ? 0 : null },
    { label: "Gross consult", value: money(totals.grossConsultCents, totals.currency), cents: totals.grossConsultCents },
    { label: "Refunds", value: money(totals.refundsCents, totals.currency), cents: totals.refundsCents },
    { label: "Platform fees", value: money(totals.platformFeeCents, totals.currency), cents: totals.platformFeeCents },
    {
      label: "Net to Connected Account",
      value: money(totals.netConnectedAccountCents, totals.currency),
      cents: totals.netConnectedAccountCents,
      net: true,
    },
  ];
  const items = cells
    .map((cell) => {
      const tone = cell.cents == null ? "" : amountTone(cell.cents);
      const ddClass = tone ? ` class="${tone}"` : "";
      const wrap = cell.net ? ` class="is-net"` : "";
      return `<div${wrap}><dt>${esc(cell.label)}</dt><dd${ddClass}>${cell.value}</dd></div>`;
    })
    .join("");
  return `<section class="totals" aria-labelledby="${esc(headingId)}">
      <h2 id="${esc(headingId)}" class="section-title">Month totals (${esc(totals.currency)})</h2>
      <dl class="totals__grid">${items}</dl>
    </section>`;
}

function lineRow(line: ActivityStatementLine): string {
  const kind = line.kind === "refund" ? "line line--refund" : "line line--booking";
  const appointment = line.appointmentLabel
    ? `<span class="sub">${esc(line.appointmentLabel)}</span>`
    : "";
  return `<tr class="${kind}">
          ${dateCell(line.dateLabel)}
          <td data-label="Booking reference" class="col-ref">${esc(line.bookingNumber)}</td>
          <td data-label="Patient" class="col-patient">${esc(line.patientLabel)}</td>
          <td data-label="Consultation" class="col-service"><span class="svc">${esc(line.serviceLabel)}</span>${appointment}</td>
          <td data-label="Status" class="col-status">${esc(line.statusLabel)}</td>
          ${moneyCell("Connected Account", line.connectedAccountCents, line.currency, line.settlementLabel)}
          ${moneyCell("Platform fee", line.platformFeeCents, line.currency, null)}
          ${moneyCell("Refund", line.refundAmountCents, line.currency, null)}
          <td class="col-action" data-label="Actions"></td>
        </tr>`;
}

function statementArticle(statement: ActivityStatement): string {
  const totals = statement.totals
    .map((block, index) => totalsBlock(block, index === 0 ? "st-totals" : `st-totals-${index}`))
    .join("");
  const truncated = statement.truncated
    ? `<p class="notice">This month has more rows than this statement could include. Contact support if you need the rest.</p>`
    : "";
  const table =
    statement.lines.length === 0
      ? `<p class="empty">No bookings or refunds in this month.</p>`
      : `<table class="lines__table">
        <thead>
          <tr>
            <th scope="col" class="col-date">Date</th>
            <th scope="col" class="col-ref">Booking reference</th>
            <th scope="col" class="col-patient">Patient</th>
            <th scope="col" class="col-service">Consultation</th>
            <th scope="col" class="col-status">Status</th>
            <th scope="col" class="num">Connected Account</th>
            <th scope="col" class="num">Platform fee</th>
            <th scope="col" class="num">Refund</th>
            <th scope="col" class="col-action"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
        ${statement.lines.map(lineRow).join("")}
        </tbody>
      </table>`;
  const clinicNote =
    statement.scopeLabel === "This clinic"
      ? `<p class="foot__note">Patient names are shown for your own bookings. Bookings with other clinicians in the clinic are listed by booking reference.</p>`
      : "";

  return `<article class="sheet" data-testid="activity-statement">
  <div class="brand">
    <p class="brand__wordmark">MyDoctors360</p>
    <p class="brand__tagline">Where Patients Meet the Right Doctor</p>
    <div class="brand__hairline" aria-hidden="true"></div>
  </div>
  <div class="content">
    <section class="title-block" aria-labelledby="st-title">
      <div class="title-block__main">
        <h1 id="st-title">Activity statement</h1>
        <p class="title-block__period">${esc(statement.periodLabel)}</p>
      </div>
      <dl class="meta">
        <div><dt>Prepared for</dt><dd>${esc(statement.payeeName)}</dd></div>
        <div><dt>Statement for</dt><dd>${esc(statement.scopeLabel)}</dd></div>
        <div><dt>Generated</dt><dd>${esc(statement.generatedLabel)}</dd></div>
      </dl>
    </section>
    ${truncated}
    ${totals}
    <section class="lines" aria-labelledby="st-lines">
      <h2 id="st-lines" class="section-title">Bookings and refunds</h2>
      ${table}
    </section>
  </div>
  <div class="foot">
    <p class="foot__note">${esc(statement.figuresNote)}</p>
    ${clinicNote}
    <p class="foot__legal">${esc(statement.footer)}</p>
  </div>
</article>`;
}

/** On-screen sheet. The style block travels with the markup so the dashboard matches the download. */
export function renderActivityStatementBody(statement: ActivityStatement): string {
  return `<div class="md360-statement-page"><style>${ACTIVITY_STATEMENT_CSS}</style>${statementArticle(statement)}</div>`;
}

export function renderActivityStatementHtml(statement: ActivityStatement): string {
  const title = `${ACTIVITY_STATEMENT_TITLE}, ${statement.periodLabel}`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${esc(title)}</title><style>${ACTIVITY_STATEMENT_CSS}</style></head><body class="md360-statement-page">${statementArticle(statement)}</body></html>`;
}
