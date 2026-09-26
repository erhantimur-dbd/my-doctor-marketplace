import { describe, expect, it } from "vitest";
import {
  buildBusyOverride,
  replaceCalendarSyncOverrides,
  wallClockInTimeZone,
} from "@/lib/calendar/import-overrides";

describe("wallClockInTimeZone", () => {
  it("converts a UTC instant to London winter wall clock", () => {
    // 2026-01-15 15:00 UTC → 15:00 Europe/London (GMT)
    const wall = wallClockInTimeZone(
      "2026-01-15T15:00:00.000Z",
      "Europe/London"
    );
    expect(wall.date).toBe("2026-01-15");
    expect(wall.time).toBe("15:00");
  });

  it("converts a UTC instant to Europe/Berlin summer wall clock", () => {
    // 2026-07-15 14:00 UTC → 16:00 Europe/Berlin (CEST)
    const wall = wallClockInTimeZone(
      "2026-07-15T14:00:00.000Z",
      "Europe/Berlin"
    );
    expect(wall.date).toBe("2026-07-15");
    expect(wall.time).toBe("16:00");
  });

  it("shifts the calendar date near midnight for eastern zones", () => {
    // 2026-03-10 23:30 UTC → 2026-03-11 08:30 Asia/Tokyo
    const wall = wallClockInTimeZone(
      "2026-03-10T23:30:00.000Z",
      "Asia/Tokyo"
    );
    expect(wall.date).toBe("2026-03-11");
    expect(wall.time).toBe("08:30");
  });
});

describe("buildBusyOverride", () => {
  it("writes location-local date/time, not UTC toISOString", () => {
    const o = buildBusyOverride({
      doctorId: "doc-1",
      start: "2026-07-15T14:00:00.000Z",
      end: "2026-07-15T15:30:00.000Z",
      timeZone: "Europe/Berlin",
      reason: "google_calendar_sync",
    });
    expect(o).toEqual({
      doctor_id: "doc-1",
      override_date: "2026-07-15",
      is_available: false,
      start_time: "16:00",
      end_time: "17:30",
      reason: "google_calendar_sync",
    });
  });
});

describe("replaceCalendarSyncOverrides", () => {
  it("inserts before deleting old ids so a failed insert keeps busy blocks", async () => {
    const ops: string[] = [];
    let insertShouldFail = false;

    const supabase = {
      from(_table: string) {
        const state: {
          action: string;
          filters: Record<string, unknown>;
          payload?: unknown;
        } = { action: "select", filters: {} };
        const builder: Record<string, unknown> = {};
        const self = new Proxy(builder, {
          get(_t, prop) {
            if (prop === "then") {
              return (
                resolve: (v: unknown) => unknown,
                reject?: (e: unknown) => unknown
              ) => {
                ops.push(state.action);
                if (state.action === "select") {
                  return Promise.resolve({
                    data: [{ id: "old-1" }, { id: "old-2" }],
                    error: null,
                  }).then(resolve, reject);
                }
                if (state.action === "insert" && insertShouldFail) {
                  return Promise.resolve({
                    data: null,
                    error: { message: "insert failed" },
                  }).then(resolve, reject);
                }
                return Promise.resolve({ data: null, error: null }).then(
                  resolve,
                  reject
                );
              };
            }
            return (...args: unknown[]) => {
              if (prop === "select") state.action = "select";
              if (prop === "insert") {
                state.action = "insert";
                state.payload = args[0];
              }
              if (prop === "delete") state.action = "delete";
              if (prop === "eq" || prop === "gte" || prop === "in") {
                state.filters[String(prop)] = args;
              }
              return self;
            };
          },
        });
        return self;
      },
    };

    const ok = await replaceCalendarSyncOverrides({
      supabase,
      doctorId: "doc-1",
      reason: "google_calendar_sync",
      fromDate: "2026-09-26",
      overrides: [
        {
          doctor_id: "doc-1",
          override_date: "2026-09-26",
          is_available: false,
          start_time: "10:00",
          end_time: "11:00",
          reason: "google_calendar_sync",
        },
      ],
    });
    expect(ok.error).toBeUndefined();
    expect(ops).toEqual(["select", "insert", "delete"]);

    insertShouldFail = true;
    ops.length = 0;
    const fail = await replaceCalendarSyncOverrides({
      supabase,
      doctorId: "doc-1",
      reason: "google_calendar_sync",
      fromDate: "2026-09-26",
      overrides: [
        {
          doctor_id: "doc-1",
          override_date: "2026-09-26",
          is_available: false,
          start_time: "10:00",
          end_time: "11:00",
          reason: "google_calendar_sync",
        },
      ],
    });
    expect(fail.error).toMatch(/insert failed/);
    expect(ops).toEqual(["select", "insert"]);
    expect(ops).not.toContain("delete");
  });
});
