import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatAppointmentWindow } from "@/lib/utils/appointment-window";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

/** Argument text of each `callee(` call, with strings and template braces ignored. */
function callArgs(src: string, callee: string): string[] {
  const args: string[] = [];
  let from = 0;
  while (from < src.length) {
    const at = src.indexOf(callee, from);
    if (at < 0) break;
    const paren = src.indexOf("(", at + callee.length);
    if (paren < 0) break;
    if (paren - (at + callee.length) > 5) {
      from = at + callee.length;
      continue;
    }
    args.push(sliceBalanced(src, paren));
    from = paren + 1;
  }
  return args;
}

function sliceBalanced(src: string, openIndex: number): string {
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  const openCh = src[openIndex];
  const closeCh = pairs[openCh];
  let depth = 0;
  let i = openIndex;
  let quote: "'" | '"' | "`" | null = null;
  while (i < src.length) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (quote === "`" && ch === "$" && src[i + 1] === "{") {
        const inner = sliceBalanced(src, i + 1);
        i += 2 + inner.length;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === openCh) depth += 1;
    if (ch === closeCh) {
      depth -= 1;
      if (depth === 0) return src.slice(openIndex + 1, i);
    }
    i += 1;
  }
  throw new Error(`unbalanced ${openCh} at ${openIndex}`);
}

describe("formatAppointmentWindow", () => {
  it("converts a BST slot from UTC into a London window", () => {
    expect(
      formatAppointmentWindow(
        "2026-09-27T09:30:00Z",
        "2026-09-27T10:00:00Z"
      )
    ).toBe("Sunday 27 September, 10:30 to 11:00 (UK time)");
    expect(
      formatAppointmentWindow(
        new Date("2026-09-27T09:30:00Z"),
        new Date("2026-09-27T10:00:00Z")
      )
    ).toBe("Sunday 27 September, 10:30 to 11:00 (UK time)");
  });

  it("keeps GMT wall time after the clocks change", () => {
    expect(
      formatAppointmentWindow(
        "2026-11-02T10:30:00Z",
        "2026-11-02T11:00:00Z"
      )
    ).toBe("Monday 2 November, 10:30 to 11:00 (UK time)");
  });

  it("labels midnight in London, including a start that is still the previous UTC date", () => {
    expect(
      formatAppointmentWindow(
        "2026-09-26T23:00:00Z",
        "2026-09-26T23:30:00Z"
      )
    ).toBe("Sunday 27 September, 00:00 to 00:30 (UK time)");
    expect(formatAppointmentWindow("2026-11-02T00:00:00Z")).toBe(
      "Monday 2 November, 00:00 (UK time)"
    );
  });

  it("shows only the start when the end is missing, or derives the end from duration", () => {
    expect(formatAppointmentWindow("2026-09-27T09:30:00Z")).toBe(
      "Sunday 27 September, 10:30 (UK time)"
    );
    expect(formatAppointmentWindow("2026-09-27T09:30:00Z", null)).toBe(
      "Sunday 27 September, 10:30 (UK time)"
    );
    expect(formatAppointmentWindow("2026-09-27T09:30:00Z", null, 30)).toBe(
      "Sunday 27 September, 10:30 to 11:00 (UK time)"
    );
    expect(
      formatAppointmentWindow("10:30", null, {
        durationMinutes: 30,
        appointmentDate: "2026-09-27",
      })
    ).toBe("Sunday 27 September, 10:30 to 11:00 (UK time)");
  });
});

describe("booking notification copy", () => {
  it("formats new-booking and confirmation copy with the London window", () => {
    for (const rel of [
      "src/lib/email/templates.ts",
      "src/lib/sms/templates.ts",
      "src/lib/notifications/doctor-new-booking.ts",
      "src/app/api/webhooks/stripe/route.ts",
    ]) {
      expect(read(rel), rel).toContain("formatAppointmentWindow(");
    }

    const email = read("src/lib/email/templates.ts");
    const confirmAt = email.indexOf("export function bookingConfirmationEmail");
    const doctorAt = email.indexOf("export function doctorNewBookingEmail");
    const cancelAt = email.indexOf("export function bookingCancellationEmail");
    const reminderAt = email.indexOf("export function bookingReminderEmail");
    expect(email.slice(0, confirmAt)).toContain("formatAppointmentWindow(");
    expect(email.slice(confirmAt, doctorAt)).toContain("consultWindow(");
    expect(email.slice(doctorAt, cancelAt)).toContain("consultWindow(");
    expect(email.slice(cancelAt, reminderAt)).not.toContain("consultWindow(");
    expect(email.slice(cancelAt, reminderAt)).not.toContain(
      "formatAppointmentWindow("
    );
  });
});

describe("consult Checkout description", () => {
  it("uses the formatter for every consult Checkout line-item description", () => {
    const window = formatAppointmentWindow(
      "2026-09-27T10:00:00+00:00",
      "2026-09-27T10:30:00+00:00"
    );
    expect(window).toBe("Sunday 27 September, 11:00 to 11:30 (UK time)");
    expect(window).not.toContain("2026-09-27T");

    const booking = read("src/actions/booking.ts");
    const bookingCreates = callArgs(booking, "checkout.sessions.create");
    expect(bookingCreates).toHaveLength(1);
    expect(bookingCreates[0]).toContain("formatAppointmentWindow(");
    expect(bookingCreates[0]).toContain("parsed.data.start_time");
    expect(bookingCreates[0]).toContain("parsed.data.end_time");
    expect(bookingCreates[0]).toContain(
      "payment_method_types: CONSULT_PAYMENT_METHOD_TYPES"
    );
    expect(bookingCreates[0]).toContain("on_behalf_of: doctor.stripe_account_id");
    expect(bookingCreates[0]).not.toContain(
      "${parsed.data.appointment_date} at ${parsed.data.start_time}"
    );

    const followUp = read("src/actions/follow-up.ts");
    const followUpCreates = callArgs(followUp, "checkout.sessions.create");
    expect(followUpCreates).toHaveLength(1);
    expect(followUpCreates[0]).toContain("formatAppointmentWindow(");
    expect(followUpCreates[0]).toContain(
      "payment_method_types: CONSULT_PAYMENT_METHOD_TYPES"
    );
    expect(followUpCreates[0]).toContain("on_behalf_of: doctor.stripe_account_id");
    expect(followUpCreates[0]).not.toContain("${appointmentDate} at ${startTime}");

    const admin = read("src/actions/admin.ts");
    const adminCreates = callArgs(admin, "checkout.sessions.create");
    expect(adminCreates).toHaveLength(2);
    for (const arg of adminCreates) {
      expect(arg).toContain("formatAppointmentWindow(");
      expect(arg).toContain(
        "payment_method_types: CONSULT_PAYMENT_METHOD_TYPES"
      );
      expect(arg).toContain("on_behalf_of: doctor.stripe_account_id");
      expect(arg).not.toMatch(/\$\{[^}]+appointment_date\} at \$\{/);
    }
  });
});
