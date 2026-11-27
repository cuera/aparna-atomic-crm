// Times are stored in UTC. Staff and batch times show in IST; parent times in the
// parent's IANA time zone (CLAUDE-aparna.md "Times").

export const IST = "Asia/Kolkata";

// India has no daylight saving time, so IST is a fixed UTC+05:30.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
};

/** A parent's time zone is free text: fall back to IST when it is not a valid IANA zone. */
export const safeTimeZone = (timeZone: string | null | undefined): string => {
  if (!timeZone) return IST;
  try {
    getFormatter(timeZone);
    return timeZone;
  } catch {
    return IST;
  }
};

/** "IST" for India, else the zone's city: "America/New_York" -> "New York". */
export const zoneLabel = (timeZone: string): string =>
  timeZone === IST
    ? "IST"
    : (timeZone.split("/").pop() ?? timeZone).replaceAll("_", " ");

/** "Sat 5 Dec, 7:00 am New York" (or "... IST"). */
export const formatInZone = (
  date: Date | string,
  timeZone: string | null | undefined,
): string => {
  const zone = safeTimeZone(timeZone);
  const parts = Object.fromEntries(
    getFormatter(zone)
      .formatToParts(new Date(date))
      .map((part) => [part.type, part.value]),
  );
  const period = (parts.dayPeriod ?? "").toLowerCase();
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute} ${period} ${zoneLabel(zone)}`;
};

/** IST and the parent's local time side by side; IST alone when the parent is in India. */
export const formatIstAndParent = (
  date: Date | string,
  parentTimeZone: string | null | undefined,
): string => {
  const ist = formatInZone(date, IST);
  const zone = safeTimeZone(parentTimeZone);
  return zone === IST ? ist : `${ist} · ${formatInZone(date, zone)}`;
};

/** The calendar day in IST, as "YYYY-MM-DD". */
export const istDateKey = (date: Date | string): string =>
  new Date(new Date(date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** Adds days to a "YYYY-MM-DD" calendar day. */
export const addDaysToDateKey = (dateKey: string, days: number): string =>
  new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);

/** The instant an IST calendar day starts. */
export const istDayStart = (dateKey: string): Date =>
  new Date(Date.parse(`${dateKey}T00:00:00Z`) - IST_OFFSET_MS);

/** Monday 00:00 IST of the week that contains `now`. */
export const istWeekStart = (now: Date): Date => {
  const today = istDateKey(now);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (weekday + 6) % 7;
  return istDayStart(addDaysToDateKey(today, -daysSinceMonday));
};
