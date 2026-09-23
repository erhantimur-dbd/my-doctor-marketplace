import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOOKING_CURRENT_DOCTOR_EMBED,
  BOOKING_DOCTOR_PROFILE_EMBED,
  PATIENT_BOOKINGS_LIST_SELECT,
  patientBookingDoctorName,
} from "@/lib/patient/booking-doctor-embed";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("patient bookings doctor embed", () => {
  it("names the current-doctor foreign key, not the reassignment key", () => {
    expect(BOOKING_CURRENT_DOCTOR_EMBED).toBe("doctors!bookings_doctor_id_fkey");
    expect(BOOKING_CURRENT_DOCTOR_EMBED).not.toContain(
      "reassigned_from_doctor"
    );
    expect(PATIENT_BOOKINGS_LIST_SELECT).toContain(
      `doctor:${BOOKING_CURRENT_DOCTOR_EMBED}(`
    );
    expect(PATIENT_BOOKINGS_LIST_SELECT).not.toMatch(/doctor:doctors\(/);
  });

  it("names the doctor profile foreign key so favorites does not collide", () => {
    expect(BOOKING_DOCTOR_PROFILE_EMBED).toBe(
      "profiles!doctors_profile_id_fkey"
    );
    expect(PATIENT_BOOKINGS_LIST_SELECT).toContain(
      `profile:${BOOKING_DOCTOR_PROFILE_EMBED}(`
    );
    expect(PATIENT_BOOKINGS_LIST_SELECT).not.toMatch(/profile:profiles\(/);
  });

  it("patient bookings list and dashboard use the disambiguated embeds", () => {
    const listPage = read(
      "src/app/[locale]/(patient)/dashboard/bookings/page.tsx"
    );
    const detailPage = read(
      "src/app/[locale]/(patient)/dashboard/bookings/[id]/page.tsx"
    );
    const dashboard = read("src/app/[locale]/(patient)/dashboard/page.tsx");

    expect(listPage).toContain("PATIENT_BOOKINGS_LIST_SELECT");
    expect(listPage).not.toMatch(/doctor:doctors\(/);
    expect(listPage).not.toMatch(/profile:profiles\(/);

    for (const source of [detailPage, dashboard]) {
      expect(source).toContain("BOOKING_CURRENT_DOCTOR_EMBED");
      expect(source).toContain("BOOKING_DOCTOR_PROFILE_EMBED");
      expect(source).not.toMatch(/doctor:doctors\(/);
      expect(source).not.toMatch(/profile:profiles\(/);
    }
  });

  it("still shows a booking when the doctor row is hidden", () => {
    expect(patientBookingDoctorName(null)).toBe("Doctor");
    expect(patientBookingDoctorName({ title: "Dr.", profile: null })).toBe(
      "Dr."
    );
    expect(
      patientBookingDoctorName({
        title: "Dr.",
        profile: { first_name: "Vera", last_name: "Softsmoke" },
      })
    ).toBe("Dr. Vera Softsmoke");
  });
});
