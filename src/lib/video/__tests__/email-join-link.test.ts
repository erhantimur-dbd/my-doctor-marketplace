import { beforeEach, describe, expect, it } from "vitest";
import { bookingConfirmationEmail, bookingReminderEmail } from "@/lib/email/templates";
import { resolvePatientConfirmationEmail } from "@/lib/email/softsmoke-send";
import {
  softsmokePatientConfirmEmail,
  softsmokePatientReminderEmail,
} from "@/lib/email/softsmoke-templates";
import {
  confirmationIncludeGuestSignature,
  consultJoinPagePath,
  consultJoinPageUrl,
  signGuestConsultJoin,
  verifyGuestConsultJoin,
} from "@/lib/video/guest-join-link";

const DAILY = "https://md360.daily.co/md-bk-1";
const TOKEN = "forwarded-meeting-token";
const TOKEN_URL = `${DAILY}?t=${TOKEN}`;
const JOIN_SECRET = "consult-join-link-secret-32-bytes!!";
const BOOKING_ID = "11111111-1111-4111-8111-111111111111";
const TIMES = {
  appointmentDate: "2026-09-26",
  startTime: "2026-09-26T09:00:00.000Z",
  endTime: "2026-09-26T09:30:00.000Z",
};

beforeEach(() => {
  process.env.CONSULT_JOIN_LINK_SECRET = JOIN_SECRET;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
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
      date: TIMES.appointmentDate,
      time: TIMES.startTime,
      end: TIMES.endTime,
      consultationType: "Video Consultation",
      bookingNumber: "MD-7K3Q9X",
      amount: 40,
      currency: "GBP",
      videoRoomUrl: DAILY,
      bookingId: BOOKING_ID,
      locale: "fr",
      doctor: { id: "not-the-tester" },
    });
    expect(mail.html).toContain("/fr/join/11111111-1111-4111-8111-111111111111");
    expect(mail.html).toContain("src=email");
    expect(mail.html).toContain("sig=");
    expect(mail.html).toContain("exp=");
    expectNoDailyToken(mail.html);
  });

  it("builds a guest join link without a Daily token", () => {
    const url = consultJoinPageUrl({
      bookingId: BOOKING_ID,
      bookingNumber: "MD-7K3Q9X",
      source: "email",
      locale: "de",
      times: TIMES,
    });
    expect(url).toContain("/de/join/");
    expect(url).toContain("sig=");
    expect(url).toContain("exp=");
    expect(url).not.toContain("daily.co");
    expect(url).not.toMatch(/[?&]t=/);
  });

  it("emits no signature and rejects verification when the secret is unset or short", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "x".repeat(48);
    delete process.env.CONSULT_JOIN_LINK_SECRET;

    const unsigned = consultJoinPageUrl({
      bookingId: BOOKING_ID,
      bookingNumber: "MD-7K3Q9X",
      source: "email",
      times: TIMES,
    });
    expect(unsigned).not.toContain("sig=");
    expect(signGuestConsultJoin(BOOKING_ID, "MD-7K3Q9X", TIMES)).toBeNull();
    expect(
      verifyGuestConsultJoin({
        bookingId: BOOKING_ID,
        bookingNumber: "MD-7K3Q9X",
        signature: "anything",
        exp: 1,
        times: TIMES,
        now: new Date("2026-09-26T09:05:00.000Z"),
      })
    ).toBe(false);

    process.env.CONSULT_JOIN_LINK_SECRET = "too-short";
    expect(signGuestConsultJoin(BOOKING_ID, "MD-7K3Q9X", TIMES)).toBeNull();
    expect(consultJoinPageUrl({
      bookingId: BOOKING_ID,
      bookingNumber: "MD-7K3Q9X",
      times: TIMES,
    })).not.toContain("sig=");
  });

  it("rejects an expired link and a link from before a reschedule", () => {
    const signed = signGuestConsultJoin(BOOKING_ID, "MD-7K3Q9X", TIMES);
    expect(signed).toBeTruthy();
    const during = new Date("2026-09-26T09:05:00.000Z");
    expect(
      verifyGuestConsultJoin({
        bookingId: BOOKING_ID,
        bookingNumber: "MD-7K3Q9X",
        signature: signed!.sig,
        exp: signed!.exp,
        times: TIMES,
        now: during,
      })
    ).toBe(true);
    expect(
      verifyGuestConsultJoin({
        bookingId: BOOKING_ID,
        bookingNumber: "MD-7K3Q9X",
        signature: signed!.sig,
        exp: signed!.exp,
        times: TIMES,
        now: new Date(signed!.exp * 1000),
      })
    ).toBe(false);

    const rescheduled = {
      ...TIMES,
      endTime: "2026-09-26T11:00:00.000Z",
    };
    expect(
      verifyGuestConsultJoin({
        bookingId: BOOKING_ID,
        bookingNumber: "MD-7K3Q9X",
        signature: signed!.sig,
        exp: signed!.exp,
        times: rescheduled,
        now: during,
      })
    ).toBe(false);
    const fresh = signGuestConsultJoin(BOOKING_ID, "MD-7K3Q9X", rescheduled);
    expect(fresh?.exp).not.toBe(signed!.exp);
    expect(
      verifyGuestConsultJoin({
        bookingId: BOOKING_ID,
        bookingNumber: "MD-7K3Q9X",
        signature: fresh!.sig,
        exp: fresh!.exp,
        times: rescheduled,
        now: during,
      })
    ).toBe(true);
  });

  it("does not sign a direct_confirm link for a signed-out visitor", () => {
    const includeSignature = confirmationIncludeGuestSignature({
      lookupMode: "direct_confirm",
      userId: null,
      patientId: "patient-user",
    });
    expect(includeSignature).toBe(false);
    const path = consultJoinPagePath({
      bookingId: BOOKING_ID,
      bookingNumber: "MD-7K3Q9X",
      source: "confirm",
      times: TIMES,
      includeSignature,
    });
    expect(path).toBe(`/join/${BOOKING_ID}?src=confirm`);
    expect(path).not.toContain("sig=");
    expect(path).not.toContain("exp=");
  });

  it("signs a confirmation link after Stripe checkout or for the signed-in patient", () => {
    for (const includeSignature of [
      confirmationIncludeGuestSignature({
        lookupMode: "stripe_session",
        userId: null,
        patientId: "patient-user",
      }),
      confirmationIncludeGuestSignature({
        lookupMode: "wallet_booking",
        userId: "patient-user",
        patientId: "patient-user",
      }),
    ]) {
      const path = consultJoinPagePath({
        bookingId: BOOKING_ID,
        bookingNumber: "MD-7K3Q9X",
        source: "confirm",
        times: TIMES,
        includeSignature,
      });
      expect(path).toContain("sig=");
      expect(path).toContain("exp=");
    }
    expect(
      confirmationIncludeGuestSignature({
        lookupMode: "direct_confirm",
        userId: "someone-else",
        patientId: "patient-user",
      })
    ).toBe(false);
  });
});
