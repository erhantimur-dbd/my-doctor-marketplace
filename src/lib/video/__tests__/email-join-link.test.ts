import { beforeEach, describe, expect, it } from "vitest";
import { bookingConfirmationEmail, bookingReminderEmail } from "@/lib/email/templates";
import { resolvePatientConfirmationEmail } from "@/lib/email/softsmoke-send";
import {
  softsmokePatientConfirmEmail,
  softsmokePatientReminderEmail,
} from "@/lib/email/softsmoke-templates";
import { consultJoinPageUrl } from "@/lib/video/guest-join-link";

const DAILY = "https://md360.daily.co/md-bk-1";
const TOKEN = "forwarded-meeting-token";
const TOKEN_URL = `${DAILY}?t=${TOKEN}`;

beforeEach(() => {
  process.env.CONSULT_JOIN_LINK_SECRET = "test-join-secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://mydoctors360.com";
});

function expectNoDailyToken(html: string) {
  expect(html).not.toContain("daily.co");
  expect(html).not.toContain(TOKEN);
  expect(html).not.toMatch(/[?&]t=/);
  expect(html).not.toContain("meeting-tokens");
}

describe("consult email links", () => {
  it("drops a Daily room URL and any meeting token from confirmation and reminder templates", () => {
    for (const html of [
      bookingConfirmationEmail({
        patientName: "Ada",
        doctorName: "Kim",
        date: "2026-09-26",
        time: "09:00",
        consultationType: "Video Consultation",
        bookingNumber: "MD-7K3Q9X",
        amount: 40,
        currency: "GBP",
        videoRoomUrl: TOKEN_URL,
      }).html,
      bookingReminderEmail({
        patientName: "Ada",
        doctorName: "Kim",
        date: "2026-09-26",
        time: "09:00",
        consultationType: "Video Consultation",
        bookingNumber: "MD-7K3Q9X",
        videoRoomUrl: TOKEN_URL,
      }).html,
      softsmokePatientConfirmEmail({
        patientFirstName: "Ada",
        doctorDisplayName: "Kim",
        appointmentDate: "2026-09-26",
        appointmentTime: "09:00",
        bookingRef: "MD-7K3Q9X",
        appointmentType: "video",
        joinUrl: TOKEN_URL,
      }).html,
      softsmokePatientReminderEmail({
        patientFirstName: "Ada",
        doctorDisplayName: "Kim",
        appointmentDate: "2026-09-26",
        appointmentTime: "09:00",
        bookingRef: "MD-7K3Q9X",
        appointmentType: "video",
        joinUrl: TOKEN_URL,
      }).html,
    ]) {
      expectNoDailyToken(html);
    }
  });

  it("points confirmation mail at the join page, which mints a token on click", () => {
    const mail = resolvePatientConfirmationEmail({
      patientName: "Ada",
      doctorName: "Kim",
      date: "2026-09-26",
      time: "09:00",
      consultationType: "Video Consultation",
      bookingNumber: "MD-7K3Q9X",
      amount: 40,
      currency: "GBP",
      videoRoomUrl: DAILY,
      bookingId: "11111111-1111-4111-8111-111111111111",
      doctor: { id: "not-the-tester" },
    });
    expect(mail.html).toContain("/en/join/11111111-1111-4111-8111-111111111111");
    expect(mail.html).toContain("src=email");
    expect(mail.html).toContain("sig=");
    expectNoDailyToken(mail.html);
  });

  it("builds a guest join link without a Daily token", () => {
    const url = consultJoinPageUrl({
      bookingId: "11111111-1111-4111-8111-111111111111",
      bookingNumber: "MD-7K3Q9X",
      source: "email",
    });
    expect(url).toContain("/en/join/");
    expect(url).toContain("sig=");
    expect(url).not.toContain("daily.co");
    expect(url).not.toMatch(/[?&]t=/);
  });
});
