import { describe, expect, it } from "vitest";

import {
  INVALID_PHONE_MESSAGE,
  normalisePhone,
  timezoneForCountry,
} from "./phone";

describe("normalisePhone (M-201)", () => {
  it.each([
    "+91 98765 43210",
    "+919876543210",
    "098765 43210",
    "09876543210",
    "98765 43210",
    "9876543210",
    "+91-98765-43210",
  ])("normalises the Indian form %s to one E.164 number", (input) => {
    // Act
    const result = normalisePhone(input);

    // Assert
    expect(result).toEqual({ ok: true, e164: "+919876543210", country: "IN" });
  });

  it.each([
    ["+1 (415) 555-2671", "+14155552671", "US"],
    ["+44 7400 123456", "+447400123456", "GB"],
    ["+971 50 123 4567", "+971501234567", "AE"],
  ])(
    "keeps the country code of the foreign number %s",
    (input, e164, country) => {
      // Act
      const result = normalisePhone(input);

      // Assert
      expect(result).toEqual({ ok: true, e164, country });
    },
  );

  it.each(["12345", "+91 12345", "not a number", "+44 1234"])(
    "rejects %s with a clear message",
    (input) => {
      // Act
      const result = normalisePhone(input);

      // Assert
      expect(result).toEqual({ ok: false, error: INVALID_PHONE_MESSAGE });
    },
  );

  it("asks for a number when the field is empty", () => {
    expect(normalisePhone("  ")).toEqual({
      ok: false,
      error: "Enter a WhatsApp number",
    });
  });
});

describe("timezoneForCountry", () => {
  it("guesses the parent's time zone from the number's country", () => {
    expect(timezoneForCountry("US")).toBe("America/New_York");
    expect(timezoneForCountry("GB")).toBe("Europe/London");
    expect(timezoneForCountry("IN")).toBe("Asia/Kolkata");
  });

  it("falls back to India time for a country it does not know", () => {
    expect(timezoneForCountry("ZZ")).toBe("Asia/Kolkata");
    expect(timezoneForCountry(null)).toBe("Asia/Kolkata");
  });
});
