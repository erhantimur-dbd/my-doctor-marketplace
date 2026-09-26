import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dailyRoomNameForBooking } from "@/lib/booking/finalize-confirmed-booking";
import {
  BOOKING_NUMBER_ALPHABET,
  BOOKING_NUMBER_BYTE_LIMIT,
  BOOKING_NUMBER_EXAMPLE,
  allocateBookingNumber,
  bookingCodeFromBytes,
  bookingListMatchesQuery,
  bookingNumberMatchesQuery,
  bookingNumberRoot,
  isBookingNumber,
  normalizeBookingNumber,
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

describe("normalizeBookingNumber", () => {
  it("returns the canonical uppercase form and tolerates a missing dash", () => {
    expect(normalizeBookingNumber(" md-7k3q9x ")).toBe("MD-7K3Q9X");
    expect(normalizeBookingNumber("MD7K3Q9X")).toBe("MD-7K3Q9X");
    expect(normalizeBookingNumber("MD-7K3Q9X")).toBe("MD-7K3Q9X");
    expect(normalizeBookingNumber("BK202609262FB5")).toBe("BK-20260926-2FB5");
    expect(normalizeBookingNumber("BK-202609262FB5")).toBe("BK-20260926-2FB5");
    expect(normalizeBookingNumber("bk-20260926-2fb5")).toBe("BK-20260926-2FB5");
    expect(normalizeBookingNumber("BK-20250115-S001")).toBe("BK-20250115-S001");
  });

  it("keeps a single -R or -Rn suffix", () => {
    expect(normalizeBookingNumber("md-7k3q9x-r")).toBe("MD-7K3Q9X-R");
    expect(normalizeBookingNumber("MD7K3Q9X-R2")).toBe("MD-7K3Q9X-R2");
    expect(normalizeBookingNumber(" bk-20260926-2fb5-r ")).toBe(
      "BK-20260926-2FB5-R"
    );
    expect(normalizeBookingNumber("BK202609262FB5-R3")).toBe(
      "BK-20260926-2FB5-R3"
    );
  });

  it("returns null for invalid numbers, including a stacked -R-R suffix", () => {
    for (const value of [
      "MD-7K3Q9X-R-R",
      "BK-20260926-2FB5-R-R",
      "MD-7K3Q9X-R0",
      "MD-7K3Q9X-R1",
      "MD-7K3Q9X-R01",
      "BK-TEST-001",
      "BK-100",
      "BK-1",
      "E2E-TEST",
      "",
      "   ",
      "MD-",
      "MD-0K3Q9X",
    ]) {
      expect(normalizeBookingNumber(value)).toBeNull();
    }
  });

  it("does not treat the legacy date segment as a calendar date", () => {
    expect(normalizeBookingNumber("BK-20260231-2FB5")).toBe("BK-20260231-2FB5");
  });
});

describe("isBookingNumber", () => {
  it("accepts legacy BK-YYYYMMDD-XXXX numbers", () => {
    expect(isBookingNumber("BK-20260926-2FB5")).toBe(true);
    expect(isBookingNumber("BK-20260925-A856")).toBe(true);
    expect(isBookingNumber("bk-20260926-2fb5")).toBe(true);
    expect(isBookingNumber("BK-20250115-S001")).toBe(true);
  });

  it("accepts legacy numbers with a -R or -Rn suffix", () => {
    expect(isBookingNumber("BK-20260926-2FB5-R")).toBe(true);
    expect(isBookingNumber("BK-20260926-2FB5-R2")).toBe(true);
    expect(isBookingNumber(" bk-20260926-2fb5-r ")).toBe(true);
    expect(isBookingNumber("BK-20260926-2FB5-R-R")).toBe(false);
  });

  it("accepts MD- plus 6 unambiguous characters", () => {
    expect(BOOKING_NUMBER_EXAMPLE).toBe("MD-7K3Q9X");
    expect(isBookingNumber("MD-7K3Q9X")).toBe(true);
    expect(isBookingNumber("md-7k3q9x")).toBe(true);
    expect(isBookingNumber("MD7K3Q9X")).toBe(true);
    expect(BOOKING_NUMBER_ALPHABET).toHaveLength(31);
    expect(BOOKING_NUMBER_ALPHABET).not.toMatch(/[01OIL]/);
    for (const ch of BOOKING_NUMBER_ALPHABET) {
      expect(isBookingNumber(`MD-${ch.repeat(6)}`)).toBe(true);
    }
  });

  it("accepts the short form with a -R or -Rn suffix", () => {
    expect(isBookingNumber("MD-7K3Q9X-R")).toBe(true);
    expect(isBookingNumber("MD-7K3Q9X-R2")).toBe(true);
    expect(isBookingNumber("MD-7K3Q9X-R-R")).toBe(false);
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
  it("appends -R the first time and -R2 when that suffix is taken", () => {
    expect(rescheduleSuccessorBookingNumber("BK-20260926-2FB5")).toBe(
      "BK-20260926-2FB5-R"
    );
    expect(rescheduleSuccessorBookingNumber("MD-7K3Q9X")).toBe("MD-7K3Q9X-R");
    expect(rescheduleSuccessorBookingNumber("MD-7K3Q9X-R")).toBe(
      "MD-7K3Q9X-R2"
    );
    expect(
      rescheduleSuccessorBookingNumber("MD-7K3Q9X", ["MD-7K3Q9X-R"])
    ).toBe("MD-7K3Q9X-R2");
    expect(
      rescheduleSuccessorBookingNumber("MD-7K3Q9X-R", ["MD-7K3Q9X-R2"])
    ).toBe("MD-7K3Q9X-R3");
    expect(
      rescheduleSuccessorBookingNumber("md-7k3q9x", ["md-7k3q9x-r", "MD-7K3Q9X-R2"])
    ).toBe("MD-7K3Q9X-R3");
    expect(bookingNumberRoot("MD-7K3Q9X-R2")).toBe("MD-7K3Q9X");
    expect(isBookingNumber(rescheduleSuccessorBookingNumber("BK-20260926-2FB5"))).toBe(
      true
    );
    expect(isBookingNumber(rescheduleSuccessorBookingNumber("MD-7K3Q9X-R"))).toBe(
      true
    );
  });

  it("does not stack -R onto an existing suffix", () => {
    expect(rescheduleSuccessorBookingNumber("MD-7K3Q9X-R")).not.toContain("-R-R");
    expect(rescheduleSuccessorBookingNumber("BK-20260926-2FB5-R2")).toBe(
      "BK-20260926-2FB5-R"
    );
  });
});

describe("allocateBookingNumber", () => {
  it("regenerates a candidate another transaction already locked", () => {
    const draws = ["MD-222222", "MD-222222", "MD-7K3Q9X"];
    const result = allocateBookingNumber({
      existing: [],
      lockedByOther: ["MD-222222"],
      draw: () => draws.shift() ?? "MD-XXXXXX",
    });
    expect(result).toEqual({ ok: true, bookingNumber: "MD-7K3Q9X" });
    expect(draws).toEqual([]);
  });

  it("regenerates a candidate that already exists", () => {
    const draws = ["MD-7K3Q9X", "MD-8K3Q9X"];
    const result = allocateBookingNumber({
      existing: ["MD-7K3Q9X"],
      draw: () => draws.shift() ?? "MD-XXXXXX",
    });
    expect(result).toEqual({ ok: true, bookingNumber: "MD-8K3Q9X" });
  });

  it("fails after the bounded retries instead of returning a colliding number", () => {
    const result = allocateBookingNumber({
      existing: ["MD-222222"],
      draw: () => "MD-222222",
      maxAttempts: 10,
    });
    expect(result).toEqual({
      ok: false,
      error: "could not allocate a unique booking number after 10 attempts",
    });
  });
});

describe("bookingCodeFromBytes", () => {
  it("maps unbiased bytes and rejects the remainder of the range", () => {
    expect(BOOKING_NUMBER_BYTE_LIMIT).toBe(248);
    expect(bookingCodeFromBytes(Uint8Array.from([0, 0, 0, 0, 0, 0]))).toBe(
      "222222"
    );
    expect(bookingCodeFromBytes(Uint8Array.from([247, 247, 247, 247, 247, 247]))).toBe(
      "ZZZZZZ"
    );
    expect(
      bookingCodeFromBytes(Uint8Array.from([248, 255, 0, 1, 2, 3, 4, 5]))
    ).toBe("234567");
    expect(bookingCodeFromBytes(Uint8Array.from([248, 255]))).toBeNull();
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

describe("bookingListMatchesQuery", () => {
  it("trims the query for names as well as the booking number", () => {
    expect(
      bookingListMatchesQuery("MD-7K3Q9X", "Ada Lovelace", "Dr. House", "  ada ")
    ).toBe(true);
    expect(
      bookingListMatchesQuery("MD-7K3Q9X", "Ada Lovelace", "Dr. House", " house ")
    ).toBe(true);
    expect(
      bookingListMatchesQuery("MD-7K3Q9X", "Ada Lovelace", "Dr. House", " 7k3q ")
    ).toBe(true);
    expect(
      bookingListMatchesQuery("MD-7K3Q9X", "Ada Lovelace", "Dr. House", "nope")
    ).toBe(false);
  });

  it("does not filter the list when the query is only whitespace", () => {
    expect(
      bookingListMatchesQuery("MD-7K3Q9X", "Ada Lovelace", "Dr. House", "   ")
    ).toBe(true);
    expect(
      bookingListMatchesQuery("MD-7K3Q9X", "Ada Lovelace", "Dr. House", "")
    ).toBe(true);
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
    expect(dailyRoomNameForBooking("MD-7K3Q9X-R2")).toBe("md-md-7k3q9x-r2");
  });
});

describe("generate_booking_number migration", () => {
  const migration = read(
    "supabase/migrations/00115_short_booking_numbers.sql"
  );
  const combined = read("supabase/combined-migration.sql");

  it("allocates MD- numbers, locks the candidate, and does not rewrite rows", () => {
    expect(migration).toContain(BOOKING_NUMBER_ALPHABET);
    expect(migration).toContain("IF NEW.booking_number IS NOT NULL THEN");
    expect(migration).toContain("FOR attempt IN 1..10 LOOP");
    expect(migration).toContain(
      "could not allocate a unique booking number after % attempts"
    );
    expect(migration).toContain("extensions.gen_random_bytes");
    expect(migration).toContain("public.gen_random_bytes");
    expect(migration).toContain(
      "generate_booking_number: pgcrypto gen_random_bytes is required"
    );
    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    expect(migration).toContain("SET search_path = pg_catalog, public");
    expect(migration).toContain("BEFORE INSERT ON public.bookings");
    expect(migration).not.toMatch(/UPDATE\s+(public\.)?bookings/i);
    const fn = generatorSql(migration);
    expect(fn).not.toContain("'BK-'");
    expect(fn).not.toContain("YYYYMMDD");
    expect(fn).not.toContain("gen_random_uuid");
    expect(fn).toContain("candidate := 'MD-'");
    const lockAt = fn.indexOf(
      "pg_advisory_xact_lock(hashtext(candidate)::bigint)"
    );
    const existsAt = fn.indexOf("IF NOT EXISTS");
    expect(lockAt).toBeGreaterThan(-1);
    expect(existsAt).toBeGreaterThan(lockAt);
  });

  it("keeps combined-migration.sql on the same generator", () => {
    expect(generatorSql(migration)).toBe(generatorSql(combined));
    expect(combined).toContain("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    const fn = generatorSql(combined);
    expect(fn).not.toContain("'BK-'");
    expect(fn).not.toContain("YYYYMMDD");
    expect(fn).not.toContain("gen_random_uuid");
  });

  it("loads existing -R successors before the clinic reschedule insert", () => {
    const src = read("src/actions/clinic-booking.ts");
    const fn = src.slice(src.indexOf("export async function adminRescheduleBooking"));
    const likeAt = fn.indexOf('`${root}-R%`');
    const insertAt = fn.indexOf("booking_number: successorNumber");
    expect(likeAt).toBeGreaterThan(-1);
    expect(insertAt).toBeGreaterThan(likeAt);
    expect(fn).toContain("rescheduleSuccessorBookingNumber(booking.booking_number, taken)");
  });
});
