import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FIND_BOOKING_MISS,
  FIND_BOOKING_LIMIT,
  emailsMatch,
  enforceFindBookingRateLimit,
  formatLookupWhen,
  performGuestBookingLookup,
  performManageLinkRequest,
  toPublicBookingView,
  type LookupBookingRow,
  type RateLimitFn,
} from "@/lib/booking/find-booking";
import {
  MANAGE_TOKEN_REQUIRED,
  MANAGE_TOKEN_TTL_MS,
  MemoryManageTokenStore,
  authorizeBookingChange,
  issueManageToken,
} from "@/lib/booking/manage-token";
import {
  EXISTING_ACCOUNT_MESSAGE,
  GUEST_SIGNUP_CARD_TITLE,
  guestConfirmationPrompt,
  planGuestSignup,
  selectGuestBookingsToAttach,
  shouldShowGuestSignupCard,
  type GuestBookingCandidate,
} from "@/lib/booking/guest-account-link";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function row(overrides: Partial<LookupBookingRow> = {}): LookupBookingRow {
  return {
    id: "booking-1",
    bookingNumber: "MD-7K3Q9X",
    appointmentDate: "2026-07-15",
    startTime: "2026-07-15T10:00:00.000Z",
    endTime: "2026-07-15T10:30:00.000Z",
    consultationType: "video",
    status: "confirmed",
    currency: "GBP",
    totalAmountCents: 4900,
    paymentMode: "full",
    depositAmountCents: null,
    paidAt: "2026-07-01T12:00:00.000Z",
    videoRoomUrl: "https://example.daily.co/room",
    patientEmail: "ada@example.com",
    doctorTitle: "Dr.",
    doctorFirstName: "Vera",
    doctorLastName: "Softsmoke",
    ...overrides,
  };
}

function openLimiter(): RateLimitFn {
  return async () => ({ limited: false, remaining: 4, retryAfterMs: 0 });
}

function countingLimiter(): RateLimitFn {
  const counts = new Map<string, number>();
  return async (key, max) => {
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return {
      limited: next > max,
      remaining: Math.max(0, max - next),
      retryAfterMs: next > max ? 60_000 : 0,
    };
  };
}

describe("booking lookup by email", () => {
  it("matches the email case-insensitively after trim and shows limited details", async () => {
    const seen: string[] = [];
    const result = await performGuestBookingLookup(
      {
        bookingNumber: " md7k3q9x ",
        email: "  ADA@Example.com ",
        ip: "203.0.113.8",
      },
      {
        limit: openLimiter(),
        findByNumber: async (bookingNumber) => {
          seen.push(bookingNumber);
          return row();
        },
      }
    );

    expect(seen).toEqual(["MD-7K3Q9X"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.booking.doctorName).toContain("Vera");
    expect(result.booking.consultationLabel).toBe("Video consultation");
    expect(result.booking.statusLabel).toBe("Confirmed");
    expect(result.booking.amountPaidCents).toBe(4900);
    expect(result.booking.amountPaidLabel).toContain("49");
    expect(result.booking.joinUrl).toBe("https://example.daily.co/room");
    expect(result.booking.timeLabel).toContain("11:00");
    expect(result.booking.timeLabel).toContain("(London)");
    expect(result.booking.canChangeBooking).toBe(false);
    expect(result.booking).not.toHaveProperty("bookingId");
    expect(result.booking).not.toHaveProperty("patientEmail");
    expect(result.booking).not.toHaveProperty("patientNotes");
    expect(emailsMatch(" Ada@Example.com ", "ada@example.com")).toBe(true);
  });

  it("matches a legacy BK- number with a -R suffix", async () => {
    const result = await performGuestBookingLookup(
      {
        bookingNumber: "bk202609262fb5r",
        email: "ada@example.com",
        ip: "203.0.113.8",
      },
      {
        limit: openLimiter(),
        findByNumber: async () =>
          row({ bookingNumber: "BK-20260926-2FB5-R" }),
      }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.booking.bookingNumber).toBe("BK-20260926-2FB5-R");
  });

  it("uses the same generic error for a wrong email and an unknown number", async () => {
    const wrongEmail = await performGuestBookingLookup(
      { bookingNumber: "MD-7K3Q9X", email: "other@example.com", ip: "1.1.1.1" },
      { limit: openLimiter(), findByNumber: async () => row() }
    );
    const unknown = await performGuestBookingLookup(
      { bookingNumber: "MD-7K3Q9X", email: "ada@example.com", ip: "1.1.1.1" },
      { limit: openLimiter(), findByNumber: async () => null }
    );
    const garbage = await performGuestBookingLookup(
      { bookingNumber: "not-a-booking", email: "ada@example.com", ip: "1.1.1.1" },
      {
        limit: openLimiter(),
        findByNumber: async () => {
          throw new Error("should not query");
        },
      }
    );

    expect(wrongEmail).toEqual({ ok: false, error: FIND_BOOKING_MISS });
    expect(unknown).toEqual({ ok: false, error: FIND_BOOKING_MISS });
    expect(garbage).toEqual({ ok: false, error: FIND_BOOKING_MISS });
    expect(FIND_BOOKING_MISS).toBe(
      "We couldn't find a booking with those details"
    );
  });

  it("omits the join link unless the video appointment can be joined", () => {
    expect(toPublicBookingView(row({ consultationType: "in_person" })).joinUrl).toBe(
      null
    );
    expect(toPublicBookingView(row({ status: "cancelled_patient" })).joinUrl).toBe(
      null
    );
    expect(toPublicBookingView(row({ videoRoomUrl: null })).joinUrl).toBe(null);
  });

  it("reports the deposit as the amount paid", () => {
    const view = toPublicBookingView(
      row({
        paymentMode: "deposit",
        depositAmountCents: 1500,
        totalAmountCents: 6000,
      })
    );
    expect(view.amountPaidCents).toBe(1500);
    expect(
      toPublicBookingView(
        row({ status: "pending_payment", paidAt: null, totalAmountCents: 4900 })
      ).amountPaidCents
    ).toBe(0);
  });
});

describe("find booking rate limit", () => {
  it("trips after 5 attempts on the same IP and on the same booking number", async () => {
    const byIp = countingLimiter();
    for (let i = 0; i < FIND_BOOKING_LIMIT; i++) {
      const result = await performGuestBookingLookup(
        {
          bookingNumber: `MD-${"23456789ABCDEFGHJKMNPQRSTUVWXYZ"[i]}K3Q9X`,
          email: "ada@example.com",
          ip: "198.51.100.10",
        },
        { limit: byIp, findByNumber: async () => null }
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.rateLimited).toBeUndefined();
    }
    const ipTrip = await performGuestBookingLookup(
      {
        bookingNumber: "MD-ZZZZZZ",
        email: "ada@example.com",
        ip: "198.51.100.10",
      },
      { limit: byIp, findByNumber: async () => row() }
    );
    expect(ipTrip).toMatchObject({ ok: false, rateLimited: true });

    const byBooking = countingLimiter();
    for (let i = 0; i < FIND_BOOKING_LIMIT; i++) {
      const result = await enforceFindBookingRateLimit(
        `203.0.113.${i}`,
        "MD-7K3Q9X",
        byBooking
      );
      expect(result.limited).toBe(false);
    }
    expect(
      await enforceFindBookingRateLimit("203.0.113.50", "md7k3q9x", byBooking)
    ).toEqual({ limited: true });
  });
});

describe("manage link token", () => {
  it("refuses a booking change without the emailed token, then accepts it once", async () => {
    const store = new MemoryManageTokenStore();
    const now = 1_700_000_000_000;
    const issued = issueManageToken({ bookingId: "booking-1", now });
    await store.put(issued.hash, issued.record);

    const missing = await authorizeBookingChange({
      token: null,
      bookingId: "booking-1",
      store,
      now,
    });
    expect(missing).toEqual({ ok: false, error: MANAGE_TOKEN_REQUIRED });

    const blank = await authorizeBookingChange({
      token: "   ",
      store,
      now,
    });
    expect(blank.ok).toBe(false);

    const allowed = await authorizeBookingChange({
      token: issued.token,
      bookingId: "booking-1",
      store,
      now,
    });
    expect(allowed).toEqual({ ok: true, bookingId: "booking-1" });

    const reused = await authorizeBookingChange({
      token: issued.token,
      bookingId: "booking-1",
      store,
      now,
    });
    expect(reused.ok).toBe(false);

    const expiredIssue = issueManageToken({ bookingId: "booking-2", now });
    await store.put(expiredIssue.hash, expiredIssue.record);
    const expired = await authorizeBookingChange({
      token: expiredIssue.token,
      store,
      now: now + MANAGE_TOKEN_TTL_MS + 1,
    });
    expect(expired.ok).toBe(false);
  });

  it("emails the manage link only after an email match", async () => {
    const store = new MemoryManageTokenStore();
    const sent: { to: string; html: string }[] = [];
    const miss = await performManageLinkRequest(
      {
        bookingNumber: "MD-7K3Q9X",
        email: "wrong@example.com",
        ip: "192.0.2.4",
        origin: "https://www.mydoctors360.com",
        locale: "en",
      },
      {
        limit: openLimiter(),
        findByNumber: async () => row(),
        store,
        now: 1_000,
        send: async (message) => {
          sent.push(message);
          return { success: true };
        },
        buildEmail: ({ manageUrl, bookingNumber }) => ({
          subject: bookingNumber,
          html: manageUrl,
        }),
      }
    );
    expect(miss).toEqual({ ok: false, error: FIND_BOOKING_MISS });
    expect(sent).toHaveLength(0);

    const hit = await performManageLinkRequest(
      {
        bookingNumber: "MD-7K3Q9X",
        email: "Ada@Example.com",
        ip: "192.0.2.5",
        origin: "https://www.mydoctors360.com",
        locale: "en",
      },
      {
        limit: openLimiter(),
        findByNumber: async () => row({ patientEmail: "Ada@Example.com" }),
        store,
        now: 1_000,
        send: async (message) => {
          sent.push(message);
          return { success: true };
        },
        buildEmail: ({ manageUrl, bookingNumber }) => ({
          subject: bookingNumber,
          html: manageUrl,
        }),
      }
    );
    expect(hit).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("ada@example.com");
    expect(sent[0].html).toContain("/en/find-booking/manage?token=");
  });
});

describe("guest confirmation account card", () => {
  const candidates: GuestBookingCandidate[] = [
    {
      id: "guest-booking",
      isGuest: true,
      patientId: "guest-user",
      patientEmail: "Ada@Example.com",
    },
    {
      id: "other-guest",
      isGuest: true,
      patientId: "someone-else",
      patientEmail: "other@example.com",
    },
    {
      id: "registered-booking",
      isGuest: false,
      patientId: "guest-user",
      patientEmail: "ada@example.com",
    },
  ];

  it("shows the card only for a guest who is not logged in", () => {
    expect(
      shouldShowGuestSignupCard({ isGuest: true, loggedIn: false })
    ).toBe(true);
    expect(
      shouldShowGuestSignupCard({ isGuest: true, loggedIn: true })
    ).toBe(false);
    expect(
      shouldShowGuestSignupCard({ isGuest: false, loggedIn: false })
    ).toBe(false);
    expect(
      guestConfirmationPrompt({
        isGuest: true,
        loggedIn: false,
        accountKind: "claimable_guest",
      })
    ).toBe("create");
    expect(
      guestConfirmationPrompt({
        isGuest: true,
        loggedIn: false,
        accountKind: "existing_account",
      })
    ).toBe("login");
    expect(GUEST_SIGNUP_CARD_TITLE).toBe(
      "Create an account to manage your booking"
    );
    expect(EXISTING_ACCOUNT_MESSAGE).toBe("Log in to see this booking");
  });

  it("links only guest bookings for the verified email, including when already attached", () => {
    const first = selectGuestBookingsToAttach({
      verifiedEmail: " ada@example.com ",
      emailConfirmed: true,
      bookings: candidates,
    });
    const second = selectGuestBookingsToAttach({
      verifiedEmail: "ADA@example.com",
      emailConfirmed: true,
      bookings: candidates,
    });
    expect(first).toEqual(["guest-booking"]);
    expect(second).toEqual(first);

    const already = selectGuestBookingsToAttach({
      verifiedEmail: "ada@example.com",
      emailConfirmed: true,
      bookings: [
        {
          id: "guest-booking",
          isGuest: true,
          patientId: "account-user",
          patientEmail: "ada@example.com",
        },
      ],
    });
    expect(
      selectGuestBookingsToAttach({
        verifiedEmail: "ada@example.com",
        emailConfirmed: true,
        bookings: [
          {
            id: "guest-booking",
            isGuest: true,
            patientId: "account-user",
            patientEmail: "ada@example.com",
          },
        ],
      })
    ).toEqual(already);

    expect(
      selectGuestBookingsToAttach({
        verifiedEmail: "ada@example.com",
        emailConfirmed: false,
        bookings: candidates,
      })
    ).toEqual([]);
  });

  it("claims matching bookings and tells an existing account to log in", () => {
    const claim = planGuestSignup({
      isGuestBooking: true,
      loggedIn: false,
      submittedEmail: "ADA@example.com",
      bookingEmail: "ada@example.com",
      emailConfirmed: true,
      authEmail: "ada@example.com",
      accountKind: "claimable_guest",
      bookings: candidates,
    });
    expect(claim).toEqual({ action: "claim", bookingIds: ["guest-booking"] });

    const existing = planGuestSignup({
      isGuestBooking: true,
      loggedIn: false,
      submittedEmail: "ada@example.com",
      bookingEmail: "ada@example.com",
      emailConfirmed: true,
      authEmail: "ada@example.com",
      accountKind: "existing_account",
      bookings: candidates,
    });
    expect(existing).toEqual({ action: "login" });

    const loggedIn = planGuestSignup({
      isGuestBooking: true,
      loggedIn: true,
      submittedEmail: "ada@example.com",
      bookingEmail: "ada@example.com",
      emailConfirmed: true,
      authEmail: "ada@example.com",
      accountKind: "claimable_guest",
      bookings: candidates,
    });
    expect(loggedIn).toEqual({ action: "hidden" });
  });
});

describe("London clock", () => {
  it("converts an absolute timestamp to London and leaves a wall-clock slot alone", () => {
    const winter = formatLookupWhen({
      appointmentDate: "2026-01-15",
      startTime: "2026-01-15T10:00:00.000Z",
    });
    expect(winter.timeLabel).toContain("10:00");
    expect(winter.timeLabel).toContain("(London)");

    const summer = formatLookupWhen({
      appointmentDate: "2026-07-15",
      startTime: "2026-07-15T10:00:00.000Z",
      endTime: "2026-07-15T10:30:00.000Z",
    });
    expect(summer.timeLabel).toContain("11:00");
    expect(summer.timeLabel).toContain("11:30");

    const wall = formatLookupWhen({
      appointmentDate: "2026-07-15",
      startTime: "10:00:00",
      endTime: "10:30:00",
    });
    expect(wall.timeLabel).toBe("10:00–10:30 (London)");
    expect(wall.dateLabel).toContain("2026");
  });
});

describe("wiring", () => {
  it("keeps lookup read-only and gates changes on the emailed token", () => {
    const form = read("src/app/[locale]/(public)/find-booking/find-booking-form.tsx");
    const result = read("src/components/booking/booking-lookup-result.tsx");
    const action = read("src/actions/find-booking.ts");
    const manage = read(
      "src/app/[locale]/(public)/find-booking/manage/page.tsx"
    );
    const redeem = read(
      "src/app/[locale]/(public)/find-booking/manage/manage-continue.tsx"
    );
    expect(form).not.toContain("cancelBooking");
    expect(form).not.toContain("requestReschedule");
    expect(result).not.toContain("cancelBooking");
    expect(action).toContain("createAdminClient");
    expect(action).toContain("rateLimit");
    expect(action).toContain("authorizeBookingChange");
    expect(action).not.toContain("patient_notes");
    expect(action).not.toContain("postal_code");
    expect(action).not.toContain("doctor_notes");
    expect(manage).toContain("previewManageLink");
    expect(redeem).toContain("redeemManageLink");
  });

  it("renders the sign-up card only through the guest helper", () => {
    const page = read(
      "src/app/[locale]/(public)/booking-confirmation/page.tsx"
    );
    const account = read("src/actions/guest-account.ts");
    expect(page).toContain("shouldShowGuestSignupCard");
    expect(page).toContain("GuestAccountCard");
    expect(page).toContain("showGuestSignup ?");
    expect(account).toContain("planGuestSignup");
    expect(account).toContain("passwordSchema");
    expect(account).toContain("createAdminClient");
    expect(account).not.toContain("postal_code");
  });

  it("allowlists the lookup page during Soft Launch", () => {
    const gate = read("src/lib/soft-launch/coming-soon-gate.ts");
    const vercel = read("vercel.json");
    expect(gate).toContain('"/find-booking"');
    expect(vercel).toContain("find-booking");
  });
});
