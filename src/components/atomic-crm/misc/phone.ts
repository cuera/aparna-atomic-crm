import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

// Most families are in India: a number typed without a country code is read as Indian
const DEFAULT_COUNTRY: CountryCode = "IN";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export type PhoneResult =
  | { ok: true; e164: string; country: string | null }
  | { ok: false; error: string };

export const INVALID_PHONE_MESSAGE =
  "Enter a valid WhatsApp number, e.g. 98765 43210 or +44 7400 123456";

/**
 * Normalises a typed phone number to E.164 and guesses its country.
 * "+91 98765 43210", "098765 43210" and "9876543210" all give "+919876543210";
 * a number with another country code keeps it.
 */
export const normalisePhone = (
  input: string | null | undefined,
): PhoneResult => {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a WhatsApp number" };
  }
  const phone = parsePhoneNumberFromString(trimmed, DEFAULT_COUNTRY);
  if (!phone || !phone.isValid()) {
    return { ok: false, error: INVALID_PHONE_MESSAGE };
  }
  return { ok: true, e164: phone.number, country: phone.country ?? null };
};

// One zone per country, for the countries families write from; editable in quick-add.
// Countries spanning several zones get their most populous one.
const COUNTRY_TIMEZONES: Record<string, string> = {
  IN: "Asia/Kolkata",
  US: "America/New_York",
  CA: "America/Toronto",
  GB: "Europe/London",
  IE: "Europe/Dublin",
  AE: "Asia/Dubai",
  SA: "Asia/Riyadh",
  QA: "Asia/Qatar",
  KW: "Asia/Kuwait",
  OM: "Asia/Muscat",
  BH: "Asia/Bahrain",
  SG: "Asia/Singapore",
  MY: "Asia/Kuala_Lumpur",
  HK: "Asia/Hong_Kong",
  JP: "Asia/Tokyo",
  AU: "Australia/Sydney",
  NZ: "Pacific/Auckland",
  DE: "Europe/Berlin",
  FR: "Europe/Paris",
  NL: "Europe/Amsterdam",
  CH: "Europe/Zurich",
  NP: "Asia/Kathmandu",
  LK: "Asia/Colombo",
  BD: "Asia/Dhaka",
  ZA: "Africa/Johannesburg",
  KE: "Africa/Nairobi",
  NG: "Africa/Lagos",
};

export const timezoneForCountry = (country: string | null | undefined) =>
  (country && COUNTRY_TIMEZONES[country]) || DEFAULT_TIMEZONE;

/** IANA zones the browser knows, plus the ones above (Chromium lists some under legacy names). */
export const timezoneChoices = () => {
  const zones = new Set<string>(Object.values(COUNTRY_TIMEZONES));
  for (const zone of Intl.supportedValuesOf("timeZone")) zones.add(zone);
  return [...zones].sort().map((zone) => ({ id: zone, name: zone }));
};
