import { describe, expect, it } from "vitest";
import {
  DAYS,
  defaultWeekSchedule,
  isOpenNow,
  parseHorairesSemaine,
  todayDayKey,
} from "@/lib/horaires-semaine";

describe("parseHorairesSemaine", () => {
  it("returns null for null input", () => {
    expect(parseHorairesSemaine(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseHorairesSemaine(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseHorairesSemaine("")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseHorairesSemaine("not json")).toBeNull();
  });

  it("returns null for a JSON array", () => {
    expect(parseHorairesSemaine("[]")).toBeNull();
  });

  it("parses a valid schedule", () => {
    const raw = JSON.stringify({
      lun: { open: true, debut: "09:00", fin: "17:00" },
      ...Object.fromEntries(
        DAYS.filter((d) => d !== "lun").map((d) => [d, { open: false, debut: "", fin: "" }])
      ),
    });
    const result = parseHorairesSemaine(raw);
    expect(result).not.toBeNull();
    expect(result!.lun).toEqual({ open: true, debut: "09:00", fin: "17:00" });
    expect(result!.dim.open).toBe(false);
  });

  it("fills missing days with defaults rather than returning null", () => {
    const result = parseHorairesSemaine(JSON.stringify({}));
    expect(result).not.toBeNull();
    for (const day of DAYS) {
      expect(result![day]).toBeDefined();
      expect(typeof result![day].open).toBe("boolean");
    }
  });

  it("ignores extra properties in the JSON", () => {
    const raw = JSON.stringify({ unknown: 42 });
    const result = parseHorairesSemaine(raw);
    expect(result).not.toBeNull();
    expect(result!.lun).toBeDefined();
  });
});

describe("isOpenNow", () => {
  // Algeria = UTC+1, no DST.
  // Date("2026-09-21T...Z") is a Monday:
  //   08:00 UTC = 09:00 Algeria
  //   17:00 UTC = 18:00 Algeria

  function openOnMonday() {
    const s = defaultWeekSchedule();
    s.lun = { open: true, debut: "09:00", fin: "17:00" };
    return s;
  }

  it("returns false when the day is closed (all defaults are closed)", () => {
    const schedule = defaultWeekSchedule(); // all open: false
    // Monday 10:00 Algeria
    const d = new Date("2026-09-21T09:00:00Z");
    expect(isOpenNow(schedule, d)).toBe(false);
  });

  it("returns true when within open hours", () => {
    // Monday 10:00 Algeria = 09:00 UTC
    const d = new Date("2026-09-21T09:00:00Z");
    expect(isOpenNow(openOnMonday(), d)).toBe(true);
  });

  it("returns false before opening time", () => {
    // Monday 08:00 Algeria = 07:00 UTC
    const d = new Date("2026-09-21T07:00:00Z");
    expect(isOpenNow(openOnMonday(), d)).toBe(false);
  });

  it("returns false at exactly closing time (exclusive end)", () => {
    // Monday 17:00 Algeria = 16:00 UTC
    const d = new Date("2026-09-21T16:00:00Z");
    expect(isOpenNow(openOnMonday(), d)).toBe(false);
  });

  it("returns true at exactly opening time (inclusive start)", () => {
    // Monday 09:00 Algeria = 08:00 UTC
    const d = new Date("2026-09-21T08:00:00Z");
    expect(isOpenNow(openOnMonday(), d)).toBe(true);
  });

  it("handles Sunday correctly (DAYS[0] = dim)", () => {
    const s = defaultWeekSchedule();
    s.dim = { open: true, debut: "10:00", fin: "14:00" };
    // 2026-09-20 is a Sunday; 11:00 Algeria = 10:00 UTC
    const d = new Date("2026-09-20T10:00:00Z");
    expect(isOpenNow(s, d)).toBe(true);
  });

  it("handles Saturday correctly (DAYS[6] = sam)", () => {
    const s = defaultWeekSchedule();
    s.sam = { open: true, debut: "08:00", fin: "12:00" };
    // 2026-09-19 is a Saturday; 09:00 Algeria = 08:00 UTC
    const d = new Date("2026-09-19T08:00:00Z");
    expect(isOpenNow(s, d)).toBe(true);
  });
});

describe("todayDayKey", () => {
  it("returns 'lun' for a Monday in Algeria time", () => {
    // 2026-09-21 is a Monday; any UTC time that maps to Monday in Algeria (UTC+1)
    const d = new Date("2026-09-21T10:00:00Z");
    expect(todayDayKey(d)).toBe("lun");
  });

  it("returns 'dim' for a Sunday in Algeria time", () => {
    const d = new Date("2026-09-20T10:00:00Z");
    expect(todayDayKey(d)).toBe("dim");
  });
});

describe("defaultWeekSchedule", () => {
  it("has all 7 days defined", () => {
    const s = defaultWeekSchedule();
    for (const day of DAYS) {
      expect(s[day]).toBeDefined();
    }
  });

  it("sets all days to closed by default", () => {
    const s = defaultWeekSchedule();
    for (const day of DAYS) {
      expect(s[day].open).toBe(false);
    }
  });
});
