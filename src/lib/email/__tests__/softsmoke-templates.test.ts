import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "@/lib/email/client";
import {
  formatAppointmentWhen,
  formatEmailDateTime,
} from "@/lib/email/format-appointment";
import { sendSoftsmokeTransferNotice } from "@/lib/email/softsmoke-send";
import { resolvePatientConfirmationEmail } from "@/lib/email/softsmoke-send";
import { bookingConfirmationEmail } from "@/lib/email/templates";
import {
  SOFTSMOKE_BANNER_LINE,
  isSoftsmokeTransactionalDoctor,
  softsmokeDoctorCancelRescheduleEmail,
  softsmokeDoctorNewBookingEmail,
  softsmokeDoctorPayoutEmail,
  softsmokeDoctorReminderEmail,
  softsmokePatientConfirmEmail,
  softsmokePatientRefundEmail,
  softsmokePatientReminderEmail,
  softsmokePatientRescheduleEmail,
} from "@/lib/email/softsmoke-templates";
import { SOFT_LAUNCH_SOFTSMOKE_DOCTOR } from "@/lib/soft-launch/softsmoke-connect-bypass";
import { TEMPLATE_LIST } from "@/lib/email/template-list";

vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

const ISO = "2026-09-26T08:00:00+00:00";

function expectHumanChrome(html: string) {
  expect(html).toContain("rgba(255,255,255,0.40)");
  expect(html).toContain(SOFTSMOKE_BANNER_LINE);
  expect(html).toContain("letter-spacing:normal");
  expect(html).not.toMatch(/letter-spacing:\s*(?!normal|0(?:[;"'\s]|$))[^;"']+/);
  expect(html).not.toMatch(/🩺|❤|🧠|👁|👶|💊|🛡/);
  expect(html).not.toContain("SPECIALTY_ICONS_ROW");
  expect(html).not.toMatch(/\b(diagnose|prescribe|triage|symptoms|treat)\b/i);
  expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
}

describe("formatAppointmentWhen", () => {
  it("renders a London civil date and wall-clock time without an ISO dump", () => {
    const when = formatAppointmentWhen({
      date: "2026-09-26",
      time: "09:00",
      timeZone: "Europe/London",
    });
    expect(when.date).toBe("Saturday 26 September 2026");
    expect(when.time).toBe("9:00am");
    expect(when.timezone).toBe("BST");
    expect(`${when.date} ${when.time} ${when.timezone}`).not.toContain("T08:00");
  });

  it("converts an absolute UTC timestamp into 9:00am BST", () => {
    const when = formatAppointmentWhen({
      date: "2026-09-26",
      time: ISO,
      timeZone: "Europe/London",
    });
    expect(when.date).toBe("Saturday 26 September 2026");
    expect(when.time).toBe("9:00am");
    expect(when.timezone).toBe("BST");
    expect(formatEmailDateTime(ISO)).toBe(
      "Saturday 26 September 2026, 9:00am BST"
    );
  });

  it("uses GMT outside British Summer Time", () => {
    const when = formatAppointmentWhen({
      date: "2026-01-15",
      time: "09:00:00",
      timeZone: "Europe/London",
    });
    expect(when.date).toBe("Thursday 15 January 2026");
    expect(when.time).toBe("9:00am");
    expect(when.timezone).toBe("GMT");
  });
});

describe("Softsmoke transactional bodies", () => {
  const booking = {
    patientFirstName: "Darren Been",
    doctorDisplayName: "Vera Softsmoke",
    doctorFirstName: "Vera",
    appointmentDate: "2026-09-26",
    appointmentTime: ISO,
    bookingRef: "BK-20260926-TEST",
    appointmentType: "video",
    joinUrl: "https://example.daily.co/room",
    manageUrl: "https://mydoctors360.com/en/dashboard/bookings/1",
  };

  it("uses the hairline header and human time on patient confirm and reminder", () => {
    for (const mail of [
      softsmokePatientConfirmEmail(booking),
      softsmokePatientReminderEmail(booking),
    ]) {
      expectHumanChrome(mail.html);
      expect(mail.html).toContain("Saturday 26 September 2026");
      expect(mail.html).toContain("9:00am BST");
      expect(mail.html).toContain("Video consultation");
      expect(mail.html).not.toContain(ISO);
    }
    expect(softsmokePatientReminderEmail(booking).html).toContain(
      "Note down the questions you want to ask."
    );
    expect(softsmokePatientReminderEmail(booking).html).not.toMatch(/symptom/i);
  });

  it("shows old and new slots on the patient reschedule", () => {
    const mail = softsmokePatientRescheduleEmail({
      patientFirstName: "Darren",
      doctorDisplayName: "Vera Softsmoke",
      bookingRef: "BK-1",
      oldDate: "2026-09-26",
      oldTime: "09:00",
      newDate: "2026-09-28",
      newTime: "14:30",
      appointmentType: "video",
    });
    expectHumanChrome(mail.html);
    expect(mail.html).toContain("Saturday 26 September 2026");
    expect(mail.html).toContain("9:00am BST");
    expect(mail.html).toContain("Monday 28 September 2026");
    expect(mail.html).toContain("2:30pm BST");
    expect(mail.subject).toContain("Booking updated");
  });

  it("keeps doctor diary mail to the patient first name", () => {
    const created = softsmokeDoctorNewBookingEmail(booking);
    const reminder = softsmokeDoctorReminderEmail(booking);
    for (const mail of [created, reminder]) {
      expectHumanChrome(mail.html);
      expect(mail.html).toContain("Darren");
      expect(mail.html).not.toContain("Been");
      expect(mail.html).toContain("Open diary");
    }
  });

  it("switches the doctor H1 for cancel and reschedule", () => {
    const cancelled = softsmokeDoctorCancelRescheduleEmail({
      kind: "cancel",
      doctorFirstName: "Vera",
      patientFirstName: "Darren Been",
      bookingRef: "BK-1",
      oldDate: "2026-09-26",
      oldTime: "09:00",
      appointmentType: "in_person",
    });
    expect(cancelled.html).toContain("Booking cancelled");
    expect(cancelled.html).toContain("Cancelled");
    expect(cancelled.html).not.toContain("Been");
    expect(cancelled.html).toContain("In-person appointment");

    const moved = softsmokeDoctorCancelRescheduleEmail({
      kind: "reschedule",
      doctorFirstName: "Vera",
      patientFirstName: "Darren",
      bookingRef: "BK-1",
      oldDate: "2026-09-26",
      oldTime: "09:00",
      newDate: "2026-09-28",
      newTime: "14:30",
      appointmentType: "video",
    });
    expect(moved.html).toContain("Booking updated");
    expect(moved.html).toContain("Monday 28 September 2026");
    expect(moved.subject).toContain("Booking updated");
  });

  it("states Connected Account settlement and refuses earnings or payroll framing", () => {
    const mail = softsmokeDoctorPayoutEmail({
      doctorFirstName: "Vera",
      grossAmount: 80,
      platformFee: 12,
      netToConnectedAccount: 68,
      currency: "gbp",
      bookingRef: "BK-1",
      payoutOrTransferRef: "tr_123",
      periodOrDate: ISO,
    });
    expectHumanChrome(mail.html);
    expect(mail.subject).toBe("Consult fee settlement — tr_123");
    expect(mail.html).toContain("Stripe Connected Account");
    expect(mail.html).toContain("platform fee");
    expect(mail.html).toContain("Platform fee (MD360)");
    expect(mail.html).toContain("GBP 12.00");
    expect(mail.html).toContain("GBP 68.00");
    expect(mail.html).toContain(
      "not framed here as the merchant of record"
    );
    expect(mail.html).toContain("not</strong> staff pay, payroll, or salary");
    expect(mail.html).toContain("does not guarantee future earnings");
    expect(mail.html).toContain("Saturday 26 September 2026, 9:00am BST");
    expect(mail.html).not.toMatch(/\b(salary increase|guaranteed earnings)\b/i);
  });

  it("formats a refund as a marketplace receipt", () => {
    const mail = softsmokePatientRefundEmail({
      patientFirstName: "Darren",
      bookingRef: "BK-1",
      refundRef: "re_123",
      refundAmount: 49,
      currency: "GBP",
      originalPaidAt: ISO,
    });
    expectHumanChrome(mail.html);
    expect(mail.html).toContain("GBP 49.00");
    expect(mail.html).toContain("re_123");
    expect(mail.html).toContain("marketplace receipt");
    expect(mail.html).toContain("Saturday 26 September 2026, 9:00am BST");
    expect(mail.html).not.toContain(ISO);
  });
});

describe("Softsmoke tester gate", () => {
  const base = {
    patientName: "Darren",
    doctorName: "Vera Softsmoke",
    date: "2026-09-26",
    time: ISO,
    consultationType: "Video Consultation",
    bookingNumber: "BK-1",
    amount: 0,
    currency: "GBP",
  };

  it("keeps the existing header for every other doctor", () => {
    const mail = resolvePatientConfirmationEmail({
      ...base,
      doctor: { id: "22222222-2222-4222-8222-222222222222" },
    });
    expect(mail.html).toContain("🩺");
    expect(mail.html).not.toContain(SOFTSMOKE_BANNER_LINE);
    expect(mail.html).toBe(bookingConfirmationEmail(base).html);
  });

  it("switches only the allowlisted tester doctor", () => {
    expect(
      isSoftsmokeTransactionalDoctor({ id: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id })
    ).toBe(true);
    expect(
      isSoftsmokeTransactionalDoctor({
        id: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id,
        slug: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.slug,
        email: "someone-else@gmail.com",
      })
    ).toBe(false);

    const mail = resolvePatientConfirmationEmail({
      ...base,
      doctor: { id: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id },
    });
    expectHumanChrome(mail.html);
    expect(mail.html).toContain("9:00am BST");
    expect(mail.html).not.toContain(ISO);
  });

  it("does not add a Soft CTA founding template", () => {
    const keys = TEMPLATE_LIST.map((item) => item.key).join(" ");
    expect(keys).not.toMatch(/founding|softcta|soft-cta/i);
    expect(TEMPLATE_LIST.some((item) => item.key === "softsmokeDoctorPayout")).toBe(
      true
    );
    const templates = readFileSync(
      join(process.cwd(), "src/lib/email/softsmoke-templates.ts"),
      "utf8"
    );
    expect(templates).not.toMatch(/Claim My Founding|founding doctor promo/i);
    expect(templates).toContain("HOLD");
  });
});

describe("sendSoftsmokeTransferNotice", () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockClear();
  });

  function supabase(row: unknown, booking: unknown) {
    return {
      from(table: string) {
        const data = table === "doctors" ? row : table === "bookings" ? booking : null;
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          maybeSingle() {
            return Promise.resolve({ data, error: null });
          },
        };
        return builder;
      },
    };
  }

  it("does not email a connected account that is not the tester doctor", async () => {
    const result = await sendSoftsmokeTransferNotice(
      supabase(
        {
          id: "22222222-2222-4222-8222-222222222222",
          slug: "other",
          profile: { first_name: "Ada", email: "ada@example.com" },
        },
        null
      ) as never,
      {
        id: "tr_other",
        amount: 6800,
        currency: "gbp",
        destination: "acct_other",
        metadata: { booking_id: "bk_1" },
      }
    );
    expect(result.sent).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("emails the tester doctor with settlement copy", async () => {
    const result = await sendSoftsmokeTransferNotice(
      supabase(
        {
          id: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id,
          slug: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.slug,
          profile: {
            first_name: "Vera",
            email: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.email,
          },
        },
        {
          id: "bk_1",
          booking_number: "BK-1",
          consultation_fee_cents: 8000,
          platform_fee_cents: 1200,
          total_amount_cents: 8000,
          currency: "gbp",
          appointment_date: "2026-09-26",
          paid_at: ISO,
        }
      ) as never,
      {
        id: "tr_softsmoke",
        amount: 6800,
        currency: "gbp",
        destination: "acct_softsmoke",
        metadata: { booking_id: "bk_1" },
      }
    );
    expect(result.sent).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.email,
        subject: "Consult fee settlement — tr_softsmoke",
        html: expect.stringContaining("Stripe Connected Account"),
      })
    );
    const html = String(vi.mocked(sendEmail).mock.calls[0]?.[0]?.html ?? "");
    expect(html).toContain("not framed here as the merchant of record");
    expect(html).toContain("does not guarantee future earnings");
    expect(html).toContain("GBP 12.00");
    expect(html).not.toContain(ISO);
  });
});
