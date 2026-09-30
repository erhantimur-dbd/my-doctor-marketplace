import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  confirmationCancellationNotice,
  formatConfirmationAppointmentWindow,
} from "@/lib/booking/confirmation-display";

const en = JSON.parse(
  readFileSync(join(process.cwd(), "messages/en.json"), "utf8")
).booking as Record<string, string>;

describe("confirmation appointment window", () => {
  it("shows a BST slot in UK time", () => {
    expect(
      formatConfirmationAppointmentWindow({
        start: "2026-09-27T09:30:00.000Z",
        end: "2026-09-27T10:00:00.000Z",
        appointmentDate: "2026-09-27",
      })
    ).toBe("Sunday 27 September, 10:30 to 11:00 (UK time)");
  });

  it("shows a GMT slot in UK time", () => {
    expect(
      formatConfirmationAppointmentWindow({
        start: "2026-11-02T10:30:00.000Z",
        end: "2026-11-02T11:00:00.000Z",
        appointmentDate: "2026-11-02",
      })
    ).toBe("Monday 2 November, 10:30 to 11:00 (UK time)");
  });
});

describe("confirmation cancellation policy", () => {
  it("renders Moderate from the booking and drops the 24h free-cancellation line", () => {
    const notice = confirmationCancellationNotice({
      bookingPolicy: "moderate",
      doctorPolicy: "flexible",
    });
    expect(notice?.policy).toBe("moderate");
    expect(notice?.label).toBe("Moderate");
    expect(en[notice!.detailKey]).toMatch(/Moderate/);
    expect(en[notice!.detailKey]).not.toMatch(/Free cancellation up to 24/i);

    const doctorOnly = confirmationCancellationNotice({
      bookingPolicy: null,
      doctorPolicy: "moderate",
    });
    expect(doctorOnly?.label).toBe("Moderate");

    const page = readFileSync(
      join(
        process.cwd(),
        "src/app/[locale]/(public)/booking-confirmation/page.tsx"
      ),
      "utf8"
    );
    expect(page).toContain("formatConfirmationAppointmentWindow");
    expect(page).toContain("confirmationCancellationNotice");
    expect(page).toContain("bookingPolicy:");
    expect(page).toContain("doctorPolicy:");
    expect(page).not.toMatch(/Free cancellation up to 24/);
    expect(page).not.toContain("moderate_policy");
    expect(page).not.toContain("formatTime(");
  });
});
