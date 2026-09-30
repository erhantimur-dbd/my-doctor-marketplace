import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bookingConfirmationEmail } from "@/lib/email/templates";
import { evaluateCalendarDownloadAccess } from "@/lib/booking/calendar-download";
import {
  buildPatientCalendarEvent,
  patientCalendarSequence,
  patientCalendarUid,
} from "@/lib/booking/patient-calendar";

const APP = "https://mydoctors360.com";
const BOOKING_ID = "11111111-1111-4111-8111-111111111111";

function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, "");
}

function line(ics: string, name: string): string {
  const match = unfold(ics)
    .split("\r\n")
    .find((row) => row.startsWith(`${name}:`) || row.startsWith(`${name};`));
  return match ?? "";
}

describe("patient calendar invites", () => {
  it("converts a BST booking to UTC in the ics and the calendar links", () => {
    const event = buildPatientCalendarEvent({
      bookingId: BOOKING_ID,
      doctorName: "Ada Lovelace",
      consultationType: "video",
      appointmentDate: "2026-10-02",
      startTime: "10:00",
      endTime: "10:30",
      bookingNumber: "BK-BST",
      appUrl: APP,
      dtstamp: new Date("2026-09-30T12:00:00Z"),
    });
    expect(event).not.toBeNull();
    const ics = unfold(event!.ics);
    expect(ics).toContain("DTSTART:20261002T090000Z");
    expect(ics).toContain("DTEND:20261002T093000Z");
    expect(ics).toContain("METHOD:REQUEST");
    expect(event!.links.google).toContain(
      encodeURIComponent("20261002T090000Z/20261002T093000Z")
    );
    expect(event!.links.outlook).toContain(
      encodeURIComponent("2026-10-02T09:00:00Z")
    );
    expect(event!.links.office365).toContain(
      encodeURIComponent("2026-10-02T09:30:00Z")
    );
    expect(event!.links.yahoo).toContain(encodeURIComponent("20261002T090000Z"));
    expect(decodeURIComponent(event!.links.google)).toContain("10:00 to 10:30 (UK time)");
    expect(decodeURIComponent(event!.links.outlook)).toContain("10:00 to 10:30 (UK time)");
  });

  it("keeps a GMT booking at the same UTC clock time", () => {
    const event = buildPatientCalendarEvent({
      bookingId: BOOKING_ID,
      doctorName: "Ada Lovelace",
      consultationType: "in_person",
      appointmentDate: "2026-11-10",
      startTime: "10:00",
      endTime: "10:30",
      address: "1 Quiet Street, London",
      appUrl: APP,
      dtstamp: new Date("2026-09-30T12:00:00Z"),
    });
    const ics = unfold(event!.ics);
    expect(ics).toContain("DTSTART:20261110T100000Z");
    expect(ics).toContain("DTEND:20261110T103000Z");
    expect(event!.links.google).toContain(
      encodeURIComponent("20261110T100000Z/20261110T103000Z")
    );
    expect(event!.links.yahoo).toContain(encodeURIComponent("20261110T100000Z"));
    expect(event!.links.office365).toContain(
      encodeURIComponent("2026-11-10T10:00:00Z")
    );
    expect(decodeURIComponent(event!.links.outlook)).toContain("10:00 to 10:30 (UK time)");
  });

  it("encodes doctor names and addresses in every calendar link", () => {
    const doctorName = "O'Brien, Ann & Sons";
    const address = "12 King's Road; Suite 2, London";
    const event = buildPatientCalendarEvent({
      bookingId: BOOKING_ID,
      doctorName,
      consultationType: "in_person",
      appointmentDate: "2026-11-10",
      startTime: "10:00",
      endTime: "10:30",
      address,
      appUrl: APP,
    })!;
    const title = event.title;
    expect(title).toContain("O'Brien, Ann & Sons");
    for (const href of Object.values(event.links)) {
      expect(href).toContain(encodeURIComponent(title));
      expect(href).toContain(encodeURIComponent(address));
      expect(href).not.toContain("Ann & Sons");
    }
    expect(event.links.google).toContain("https://calendar.google.com/calendar/render?");
    expect(event.links.outlook).toContain("https://outlook.live.com/calendar/");
    expect(event.links.office365).toContain("https://outlook.office.com/calendar/");
    expect(event.links.yahoo).toContain("https://calendar.yahoo.com/?");
  });

  it("uses the waiting-room join URL for video and the practice address for in-person", () => {
    const join = `${APP}/en/dashboard/bookings/${BOOKING_ID}/video-room`;
    const video = buildPatientCalendarEvent({
      bookingId: BOOKING_ID,
      doctorName: "Ada Lovelace",
      consultationType: "video",
      appointmentDate: "2026-10-02",
      startTime: "10:00",
      endTime: "10:30",
      address: "Should not be the video location",
      appUrl: APP,
    })!;
    const unfoldedVideo = unfold(video.ics);
    expect(line(video.ics, "LOCATION")).toBe(`LOCATION:${join}`);
    expect(unfoldedVideo).toContain(`Join video call: ${join}`);
    expect(unfoldedVideo).not.toContain("daily.co");
    expect(line(video.ics, "URL")).toContain(`/dashboard/bookings/${BOOKING_ID}`);
    expect(line(video.ics, "URL")).not.toContain("video-room");

    const inPerson = buildPatientCalendarEvent({
      bookingId: BOOKING_ID,
      doctorName: "Ada Lovelace",
      consultationType: "in_person",
      appointmentDate: "2026-11-10",
      startTime: "10:00",
      endTime: "10:30",
      clinicName: "Harley Street Clinic",
      address: "12 King's Road",
      appUrl: APP,
    })!;
    expect(line(inPerson.ics, "LOCATION")).toBe(
      "LOCATION:Harley Street Clinic\\, 12 King's Road"
    );
    expect(unfold(inPerson.ics)).not.toContain("video-room");
    expect(inPerson.links.google).not.toContain("daily.co");
  });

  it("keeps one UID and raises SEQUENCE on reschedule, then cancels that UID", () => {
    const createdAt = "2026-10-01T08:00:00.000Z";
    const original = buildPatientCalendarEvent({
      bookingId: BOOKING_ID,
      doctorName: "Ada Lovelace",
      consultationType: "video",
      appointmentDate: "2026-10-02",
      startTime: "10:00",
      endTime: "10:30",
      createdAt,
      updatedAt: createdAt,
      appUrl: APP,
    })!;
    const moved = buildPatientCalendarEvent({
      bookingId: BOOKING_ID,
      doctorName: "Ada Lovelace",
      consultationType: "video",
      appointmentDate: "2026-10-05",
      startTime: "11:00",
      endTime: "11:30",
      createdAt,
      updatedAt: "2026-10-03T08:00:00.000Z",
      kind: "reschedule",
      appUrl: APP,
    })!;
    const cancelled = buildPatientCalendarEvent({
      bookingId: BOOKING_ID,
      doctorName: "Ada Lovelace",
      consultationType: "video",
      appointmentDate: "2026-10-05",
      startTime: "11:00",
      endTime: "11:30",
      createdAt,
      updatedAt: "2026-10-04T08:00:00.000Z",
      method: "CANCEL",
      appUrl: APP,
    })!;

    expect(original.uid).toBe(patientCalendarUid(BOOKING_ID));
    expect(moved.uid).toBe(original.uid);
    expect(cancelled.uid).toBe(original.uid);
    expect(original.sequence).toBe(0);
    expect(moved.sequence).toBeGreaterThan(original.sequence);
    expect(cancelled.sequence).toBeGreaterThan(moved.sequence);
    expect(patientCalendarSequence({ createdAt, updatedAt: createdAt })).toBe(0);
    expect(unfold(moved.ics)).toContain(`SEQUENCE:${moved.sequence}`);
    expect(unfold(moved.ics)).toContain("METHOD:REQUEST");
    expect(unfold(cancelled.ics)).toContain("METHOD:CANCEL");
    expect(unfold(cancelled.ics)).toContain("STATUS:CANCELLED");
    expect(cancelled.attachment.contentType).toContain("method=CANCEL");
    expect(moved.attachment.contentType).toContain("method=REQUEST");
  });

  it("escapes commas, semicolons, and newlines, and folds at 75 octets", () => {
    const event = buildPatientCalendarEvent({
      bookingId: BOOKING_ID,
      doctorName: "Smith, Ann; Jr",
      consultationType: "in_person",
      appointmentDate: "2026-11-10",
      startTime: "10:00",
      endTime: "10:30",
      address: "Flat 2; High Street\nLondon",
      bookingNumber: "BK,1;2",
      appUrl: APP,
    })!;
    const unfolded = unfold(event.ics);
    expect(unfolded).toContain("SUMMARY:Dr. Smith\\, Ann\\; Jr");
    expect(line(event.ics, "LOCATION")).toContain("Flat 2\\; High Street\\nLondon");
    expect(unfolded).toContain("Booking BK\\,1\\;2");
    expect(unfolded).toContain("\\n");

    const physical = event.ics.split("\r\n").filter((row) => row.length > 0);
    expect(physical.some((row) => row.startsWith(" "))).toBe(true);
    for (const row of physical) {
      expect(Buffer.byteLength(row, "utf8")).toBeLessThanOrEqual(75);
    }
  });

  it("adds the four calendar buttons and a REQUEST attachment to the confirmation email", () => {
    const mail = bookingConfirmationEmail({
      patientName: "John",
      doctorName: "Ada Lovelace",
      date: "2026-10-02",
      time: "10:00",
      end: "10:30",
      consultationType: "Video Consultation",
      bookingNumber: "BK-1",
      amount: 80,
      currency: "GBP",
      bookingId: BOOKING_ID,
    });
    expect(mail.html).toContain("https://calendar.google.com/calendar/render?");
    expect(mail.html).toContain("https://outlook.live.com/calendar/");
    expect(mail.html).toContain("https://outlook.office.com/calendar/");
    expect(mail.html).toContain("https://calendar.yahoo.com/?");
    expect(mail.html).toContain("Google Calendar");
    expect(mail.html).toContain("Outlook.com");
    expect(mail.html).toContain("Office 365");
    expect(mail.html).toContain("Yahoo Calendar");
    const ics = Buffer.from(mail.attachments![0].content, "base64").toString("utf8");
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).not.toContain("METHOD:CANCEL");
    expect(mail.attachments![0].contentType).toContain("text/calendar");
    expect(mail.attachments![0].contentType).toContain("method=REQUEST");
    expect(unfold(ics)).toContain(`UID:${patientCalendarUid(BOOKING_ID)}`);
  });
});

describe("calendar download authorisation", () => {
  const bookingId = BOOKING_ID;

  it("lets a guest with the confirmation link download, and nobody else", () => {
    expect(
      evaluateCalendarDownloadAccess({
        pathBookingId: bookingId,
        query: { booking_id: bookingId, confirm: "1" },
        userId: null,
      })
    ).toEqual({ ok: true, adminFallback: true, requireOwner: false });

    expect(
      evaluateCalendarDownloadAccess({
        pathBookingId: bookingId,
        query: { session_id: "cs_test", booking_id: bookingId },
        userId: null,
        stripeBookingId: bookingId,
      }).ok
    ).toBe(true);

    expect(
      evaluateCalendarDownloadAccess({
        pathBookingId: bookingId,
        query: {},
        userId: null,
      })
    ).toEqual({ ok: false, status: 401 });

    expect(
      evaluateCalendarDownloadAccess({
        pathBookingId: bookingId,
        query: { booking_id: bookingId, wallet: "true" },
        userId: null,
      }).ok
    ).toBe(false);

    expect(
      evaluateCalendarDownloadAccess({
        pathBookingId: bookingId,
        query: { booking_id: "someone-else", confirm: "1" },
        userId: null,
      })
    ).toEqual({ ok: false, status: 403 });

    expect(
      evaluateCalendarDownloadAccess({
        pathBookingId: bookingId,
        query: { session_id: "cs_test" },
        userId: null,
        stripeBookingId: "other-booking",
      })
    ).toEqual({ ok: false, status: 403 });
  });

  it("allows the signed-in owner on the wallet return", () => {
    expect(
      evaluateCalendarDownloadAccess({
        pathBookingId: bookingId,
        query: { booking_id: bookingId, wallet: "true" },
        userId: "patient-1",
      })
    ).toEqual({ ok: true, adminFallback: false, requireOwner: true });
  });
});

describe("confirmation page wiring", () => {
  it("renders AddToCalendar without rewriting the time or cancellation blocks", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/[locale]/(public)/booking-confirmation/page.tsx"),
      "utf8"
    );
    expect(page).toContain("AddToCalendar");
    expect(page).toContain("calendarDownloadPath");
    expect(page).toContain("formatConfirmationAppointmentWindow");
    expect(page).toContain("confirmationCancellationNotice");
  });
});
