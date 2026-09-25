import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { doctorHasBookingsEntitlement } from "@/lib/doctor/doctor-bookings-query";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("doctor bookings entitlement", () => {
  it("lets Founding Free through and blocks a missing licence", () => {
    expect(
      doctorHasBookingsEntitlement([
        { tier: "free", status: "active", created_at: "2026-09-18T00:00:00Z" },
      ])
    ).toBe(true);
    expect(doctorHasBookingsEntitlement([])).toBe(false);
    expect(doctorHasBookingsEntitlement(null)).toBe(false);
    expect(
      doctorHasBookingsEntitlement([
        { tier: "free", status: "cancelled", created_at: "2026-09-18T00:00:00Z" },
      ])
    ).toBe(false);
  });
});

describe("doctor bookings first paint", () => {
  const page = read(
    "src/app/[locale]/(doctor)/doctor-dashboard/bookings/page.tsx"
  );
  const client = read(
    "src/app/[locale]/(doctor)/doctor-dashboard/bookings/bookings-client.tsx"
  );
  const loader = read("src/lib/doctor/load-doctor-bookings.ts");
  const query = read("src/lib/doctor/doctor-bookings-query.ts");

  it("renders from the server session instead of the client spinner", () => {
    expect(page).not.toMatch(/["']use client["']/);
    expect(page).toContain("loadDoctorBookingsForSession");
    expect(page).toContain("<BookingsClient");
    expect(client).toMatch(/useState\(!initial\)/);
    expect(query).toContain("patient:profiles!bookings_patient_id_fkey");
    expect(loader).toContain("DOCTOR_BOOKINGS_SELECT");
    expect(loader).toContain("doctorHasBookingsEntitlement");
  });

  it("does not clear a seeded list when the client refetch errors", () => {
    expect(client).toContain("if (!error) setBookings");
  });
});
