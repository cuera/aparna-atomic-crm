import {
  addDaysToDateKey,
  formatInZone,
  formatIstAndParent,
  istDateKey,
  istWeekStart,
} from "./time";

describe("formatInZone", () => {
  it("shows a UTC instant in IST", () => {
    expect(formatInZone("2026-12-05T12:00:00Z", "Asia/Kolkata")).toBe(
      "Sat 5 Dec, 5:30 pm IST",
    );
  });

  it("follows New York daylight saving (EST in winter, EDT in summer)", () => {
    expect(formatInZone("2026-12-05T12:00:00Z", "America/New_York")).toBe(
      "Sat 5 Dec, 7:00 am New York",
    );
    expect(formatInZone("2026-07-04T12:00:00Z", "America/New_York")).toBe(
      "Sat 4 Jul, 8:00 am New York",
    );
  });

  it("follows London daylight saving (GMT in winter, BST in summer)", () => {
    expect(formatInZone("2026-12-05T12:00:00Z", "Europe/London")).toBe(
      "Sat 5 Dec, 12:00 pm London",
    );
    expect(formatInZone("2026-07-04T12:00:00Z", "Europe/London")).toBe(
      "Sat 4 Jul, 1:00 pm London",
    );
  });

  it("falls back to IST when the time zone is missing or not a real zone", () => {
    expect(formatInZone("2026-12-05T12:00:00Z", null)).toBe(
      "Sat 5 Dec, 5:30 pm IST",
    );
    expect(formatInZone("2026-12-05T12:00:00Z", "Mars/Olympus")).toBe(
      "Sat 5 Dec, 5:30 pm IST",
    );
  });
});

describe("formatIstAndParent", () => {
  it("shows IST and the parent's local time side by side, across the date line", () => {
    expect(formatIstAndParent("2026-03-09T01:00:00Z", "America/New_York")).toBe(
      "Mon 9 Mar, 6:30 am IST · Sun 8 Mar, 9:00 pm New York",
    );
  });

  it("shows IST alone for a parent in India", () => {
    expect(formatIstAndParent("2026-12-05T12:00:00Z", "Asia/Kolkata")).toBe(
      "Sat 5 Dec, 5:30 pm IST",
    );
  });
});

describe("IST calendar helpers", () => {
  it("puts 20:00 UTC on the next IST day", () => {
    expect(istDateKey("2026-12-05T20:00:00Z")).toBe("2026-12-06");
    expect(istDateKey("2026-12-05T18:00:00Z")).toBe("2026-12-05");
  });

  it("adds days across a month end", () => {
    expect(addDaysToDateKey("2026-11-29", 3)).toBe("2026-12-02");
  });

  it("starts the week on Monday 00:00 IST", () => {
    // Sunday 6 Dec 2026, 10:00 IST -> Monday 30 Nov 00:00 IST = 29 Nov 18:30 UTC
    expect(istWeekStart(new Date("2026-12-06T04:30:00Z")).toISOString()).toBe(
      "2026-11-29T18:30:00.000Z",
    );
    // Monday 30 Nov 2026, 00:10 IST is already in the new week
    expect(istWeekStart(new Date("2026-11-29T18:40:00Z")).toISOString()).toBe(
      "2026-11-29T18:30:00.000Z",
    );
  });
});
