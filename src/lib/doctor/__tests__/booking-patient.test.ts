import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DOCTOR_BOOKING_PATIENT_EMAIL_FALLBACK,
  DOCTOR_BOOKING_PATIENT_FALLBACK,
  doctorBookingPatientEmail,
  doctorBookingPatientName,
} from "@/lib/doctor/booking-patient";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const darren = {
  first_name: "Darren",
  last_name: "Been",
  email: "darren@example.com",
};

describe("doctor booking patient label", () => {
  it("falls back when the embed is null", () => {
    expect(doctorBookingPatientName(null)).toBe(DOCTOR_BOOKING_PATIENT_FALLBACK);
    expect(doctorBookingPatientEmail(null)).toBe(
      DOCTOR_BOOKING_PATIENT_EMAIL_FALLBACK
    );
    expect(doctorBookingPatientName(undefined)).toBe("Patient");
    expect(doctorBookingPatientEmail(undefined)).toBe("—");
  });

  it("falls back when the embed is an empty or blank array", () => {
    expect(doctorBookingPatientName([])).toBe("Patient");
    expect(doctorBookingPatientEmail([])).toBe("—");
    expect(
      doctorBookingPatientName([{ first_name: " ", last_name: null, email: "" }])
    ).toBe("Patient");
    expect(doctorBookingPatientEmail([{ email: "  " }])).toBe("—");
  });

  it("reads an object embed and an array-shaped embed", () => {
    expect(doctorBookingPatientName(darren)).toBe("Darren Been");
    expect(doctorBookingPatientEmail(darren)).toBe("darren@example.com");
    expect(doctorBookingPatientName([darren])).toBe("Darren Been");
    expect(doctorBookingPatientEmail([darren])).toBe("darren@example.com");
  });
});

describe("doctor bookings page patient access", () => {
  const page = read(
    "src/app/[locale]/(doctor)/doctor-dashboard/bookings/bookings-client.tsx"
  );
  const home = read("src/app/[locale]/(doctor)/doctor-dashboard/page.tsx");
  const payments = read(
    "src/app/[locale]/(doctor)/doctor-dashboard/payments/page.tsx"
  );
  const patients = read(
    "src/app/[locale]/(doctor)/doctor-dashboard/patients/page.tsx"
  );
  const reviews = read(
    "src/app/[locale]/(doctor)/doctor-dashboard/reviews/page.tsx"
  );
  const messages = read(
    "src/app/[locale]/(doctor)/doctor-dashboard/messages/page.tsx"
  );
  const patientDetail = read(
    "src/app/[locale]/(doctor)/doctor-dashboard/patients/[id]/page.tsx"
  );

  it("does not read booking.patient.first_name unprotected", () => {
    for (const source of [page, home, payments, patients, reviews, messages, patientDetail]) {
      expect(source).not.toMatch(/booking\.patient\.first_name/);
      expect(source).not.toMatch(/booking\.patient\.last_name/);
      expect(source).not.toMatch(/booking\.patient\.email/);
      expect(source).not.toMatch(/review\.patient\.first_name/);
      expect(source).not.toMatch(/review\.patient\.last_name/);
    }
    for (const source of [messages, patientDetail]) {
      expect(source).not.toMatch(/patient\.first_name/);
      expect(source).not.toMatch(/patient\.last_name/);
    }
  });

  it("labels the booking row and the nested reschedule patient", () => {
    expect(page).toContain("doctorBookingPatientName");
    expect(page).toContain("doctorBookingPatientEmail");
    expect(page.match(/doctorBookingPatientName\(/g)?.length).toBeGreaterThanOrEqual(
      2
    );
    expect(page.match(/doctorBookingPatientEmail\(/g)?.length).toBeGreaterThanOrEqual(
      2
    );
  });

  it("doctor home, payments, patients, and reviews use null-safe patient helpers", () => {
    expect(home).toContain("doctorBookingPatientName");
    expect(payments).toContain("doctorBookingPatientName");
    expect(patients).toContain("unwrapBookingPatient");
    expect(reviews).toContain("unwrapBookingPatient");
    expect(reviews).toContain("doctorBookingPatientName");
    expect(messages).toContain("doctorBookingPatientName");
    expect(patientDetail).toContain("doctorBookingPatientName");
  });
});

describe("doctor read of booking patient profiles", () => {
  const sql = read(
    "supabase/migrations/00109_doctors_read_booking_patient_profiles.sql"
  );

  it("uses a security-definer check that does not re-enter profiles RLS", () => {
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = ''/);
    expect(sql).toMatch(/rls_is_booking_patient_of_doctor/);
    expect(sql).toMatch(
      /CREATE POLICY "Doctors can read profiles of their booking patients"/
    );
    expect(sql).not.toMatch(/softsmoke/i);
    const fn = sql.slice(
      sql.indexOf("CREATE OR REPLACE FUNCTION"),
      sql.indexOf("GRANT EXECUTE")
    );
    expect(fn).not.toMatch(/public\.profiles/);
  });
});
