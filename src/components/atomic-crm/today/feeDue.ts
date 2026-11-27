// Demo-mode twin of the SQL function mark_fee_paid (supabase/schemas/02_functions.sql).
// Keep both rule sets equal: date arithmetic and note text.

const MONTHS_BY_PERIOD: Record<string, number> = { monthly: 1, quarterly: 3 };

export const feePeriodMonths = (
  period: string | null | undefined,
): number | null => (period ? (MONTHS_BY_PERIOD[period] ?? null) : null);

/**
 * Postgres `date + interval 'n months'`: the day is clamped to the target month's
 * last day (31 Jan + 1 month = 28 Feb).
 */
export const addMonthsToDateKey = (dateKey: string, months: number): string => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetMonthIndex = month - 1 + months;
  const lastDay = new Date(
    Date.UTC(year, targetMonthIndex + 1, 0),
  ).getUTCDate();
  return new Date(Date.UTC(year, targetMonthIndex, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
};

/** Same text as the SQL note: "Fee paid: ₹2500.00, due 2026-12-01, next due 2027-01-01". */
export const feePaidNoteText = (
  amountPaise: number | null | undefined,
  shownDue: string,
  newDue: string,
): string => {
  const amount =
    amountPaise != null
      ? `₹${(amountPaise / 100).toFixed(2)}`
      : "amount not set";
  return `Fee paid: ${amount}, due ${shownDue}, next due ${newDue}`;
};
