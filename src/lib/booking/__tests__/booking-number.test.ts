import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dailyRoomNameForBooking } from "@/lib/booking/finalize-confirmed-booking";
import {
  BOOKING_NUMBER_ALPHABET,
  BOOKING_NUMBER_EXAMPLE,
  bookingNumberMatchesQuery,
  isBookingNumber,
  rescheduleSuccessorBookingNumber,
} from "@/lib/booking/booking-number";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function generatorSql(source: string): string {
  const start = source.indexOf(
    "CREATE OR REPLACE FUNCTION public.generate_booking_number()"
  );
  const comment = source.indexOf(
    "COMMENT ON FUNCTION public.generate_booking_number() IS",
    start
  );
  const end = source.indexOf("';", comment);
  return source.slice(start, end + 2);
}

describe("isBookingNumber", () => {
  it("accepts legacy BK-YYYYMMDD-XXXX numbers", () => {
    expect(isBookingNumber("BK-20260926-2FB5")).toBe(true);
    expect(isBookingNumber("BK-20260925-A856")).toBe(true);
    expect(isBookingNumber("bk-20260926-2fb5")).toBe(true);
    expect(isBookingNumber("BK-20250115-S001")).toBe(true);
  });

  it("accepts legacy numbers with a -R suffix", () => {
    expect(isBookingNumber("BK-20260926-2FB5-R")).toBe(true);
    expect(isBookingNumber("BK-20260926-2FB5-R-R")).toBe(true);
    expect(isBookingNumber(" bk-20260926-2fb5-r ")).toBe(true);
  });

  it("accepts MD- plus 6 unambiguous characters", () => {
    expect(BOOKING_NUMBER_EXAMPLE).toBe("MD-7K3Q9X");
    expect(isBookingNumber("MD-7K3Q9X")).toBe(true);
    expect(isBookingNumber("md-7k3q9x")).toBe(true);
    expect(BOOKING_NUMBER_ALPHABET).toHaveLength(31);
    expect(BOOKING_NUMBER_ALPHABET).not.toMatch(/[01OIL]/);
    for (const ch of BOOKING_NUMBER_ALPHABET) {
      expect(isBookingNumber(`MD-${ch.repeat(6)}`)).toBe(true);
    }
  });

  it("accepts the short form with a -R suffix", () => {
    expect(isBookingNumber("MD-7K3Q9X-R")).toBe(true);
    expect(isBookingNumber("MD-7K3Q9X-R-R")).toBe(true);
    expect(isBookingNumber("md-7k3q9x-r")).toBe(true);
  });

  it("rejects ambiguous characters, wrong lengths, and non-booking samples", () => {
    for (const value of [
      "MD-0K3Q9X",
      "MD-OK3Q9X",
      "MD-1K3Q9X",
      "MD-IK3Q9X",
      "MD-LK3Q9X",
      "MD-7K3Q9",
      "MD-7K3Q9XX",
      "BK-2026092-2FB5",
      "BK-20260926-2FB",
      "BK-20260926-2FB55",
      "BK-TEST-001",
      "BK-100",
      "BK-1",
      "E2E-TEST",
      "",
      "MD-",
    ]) {
      expect(isBookingNumber(value)).toBe(false);
    }
  });

  it("does not treat the legacy date segment as a calendar date", () => {
    expect(isBookingNumber("BK-20260231-2FB5")).toBe(true);
    expect(isBookingNumber("BK-20260231-2FB5-R")).toBe(true);
  });
});

describe("rescheduleSuccessorBookingNumber", () => {
  it("appends -R to legacy and short numbers", () => {
    expect(rescheduleSuccessorBookingNumber("BK-20260926-2FB5")).toBe(
      "BK-20260926-2FB5-R"
    );
    expect(rescheduleSuccessorBookingNumber("MD-7K3Q9X")).toBe("MD-7K3Q9X-R");
    expect(rescheduleSuccessorBookingNumber("MD-7K3Q9X-R")).toBe(
      "MD-7K3Q9X-R-R"
    );
    expect(isBookingNumber(rescheduleSuccessorBookingNumber("BK-20260926-2FB5"))).toBe(
      true
    );
    expect(isBookingNumber(rescheduleSuccessorBookingNumber("MD-7K3Q9X"))).toBe(
      true
    );
  });
});

describe("bookingNumberMatchesQuery", () => {
  it("matches legacy and short numbers, including -R", () => {
    expect(bookingNumberMatchesQuery("BK-20260926-2FB5", "bk-20260926")).toBe(
      true
    );
    expect(bookingNumberMatchesQuery("BK-20260926-2FB5-R", "2fb5-r")).toBe(
      true
    );
    expect(bookingNumberMatchesQuery("MD-7K3Q9X", "md-7k3q9x")).toBe(true);
    expect(bookingNumberMatchesQuery("MD-7K3Q9X-R", " MD-7K ")).toBe(true);
    expect(bookingNumberMatchesQuery("MD-7K3Q9X", "nope")).toBe(false);
  });
});

describe("daily room names", () => {
  it("slugs both formats without reading a date out of the number", () => {
    expect(dailyRoomNameForBooking("BK-20260926-2FB5")).toBe(
      "md-bk-20260926-2fb5"
    );
    expect(dailyRoomNameForBooking("BK-20260926-2FB5-R")).toBe(
      "md-bk-20260926-2fb5-r"
    );
    expect(dailyRoomNameForBooking("MD-7K3Q9X")).toBe("md-md-7k3q9x");
    expect(dailyRoomNameForBooking("MD-7K3Q9X-R")).toBe("md-md-7k3q9x-r");
  });
});

describe("generate_booking_number migration", () => {
  const migration = read(
    "supabase/migrations/00114_short_booking_numbers.sql"
  );
  const combined = read("supabase/combined-migration.sql");

  it("allocates MD- numbers, retries collisions, and does not rewrite rows", () => {
    expect(migration).toContain(BOOKING_NUMBER_ALPHABET);
    expect(migration).toContain("IF NEW.booking_number IS NOT NULL THEN");
    expect(migration).toContain("FOR attempt IN 1..10 LOOP");
    expect(migration).toContain(
      "could not allocate a unique booking number after % attempts"
    );
    expect(migration).toContain("extensions.gen_random_bytes");
    expect(migration).toContain("public.gen_random_bytes");
    expect(migration).toContain("gen_random_uuid()");
    expect(migration).toContain("NOT EXISTS");
    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    expect(migration).toContain("BEFORE INSERT ON public.bookings");
    expect(migration).not.toMatch(/UPDATE\s+(public\.)?bookings/i);
    const fn = generatorSql(migration);
    expect(fn).not.toContain("'BK-'");
    expect(fn).not.toContain("YYYYMMDD");
    expect(fn).toContain("candidate := 'MD-'");
  });

  it("keeps combined-migration.sql on the same generator", () => {
    expect(generatorSql(migration)).toBe(generatorSql(combined));
    expect(combined).toContain("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    expect(combined).not.toContain("'BK-'");
    expect(combined).not.toContain("YYYYMMDD");
  });
});
