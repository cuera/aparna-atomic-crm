// Pure selection logic for the Today screen (M-301) and the This-week strip (M-306).
// "Today", "tomorrow" and "this week" are IST calendar days (staff times are IST).

import { addDaysToDateKey, istDateKey, istWeekStart } from "../misc/time";
import type { Deal } from "../types";

const MINUTE_MS = 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * MINUTE_MS;

const CLOSED_STAGES = ["enrolled", "lost"];

export const isOpenAdmission = (deal: Deal): boolean =>
  !CLOSED_STAGES.includes(deal.stage);

/** An enquiry nobody has answered yet. */
export const isNewEnquiry = (deal: Deal): boolean =>
  deal.stage === "enquiry" && !deal.first_response_at;

const time = (iso: string | null | undefined): number =>
  iso ? Date.parse(iso) : Number.NaN;

const byTime =
  (field: (deal: Deal) => string | null | undefined) => (a: Deal, b: Deal) =>
    (time(field(a)) || 0) - (time(field(b)) || 0);

export interface TodaySections {
  newEnquiries: Deal[];
  followUps: Deal[];
  trials: Deal[];
  paymentPending: Deal[];
  fees: Deal[];
}

export const FEE_WINDOW_DAYS = 3;

export const buildTodaySections = (deals: Deal[], now: Date): TodaySections => {
  const today = istDateKey(now);
  const tomorrow = addDaysToDateKey(today, 1);
  const endOfToday = Date.parse(`${tomorrow}T00:00:00+05:30`);
  const feeLimit = addDaysToDateKey(today, FEE_WINDOW_DAYS);

  return {
    newEnquiries: deals
      .filter(isNewEnquiry)
      .sort(byTime((deal) => deal.created_at)),
    // Payment pending has its own section, so it is not repeated here.
    followUps: deals
      .filter(
        (deal) =>
          isOpenAdmission(deal) &&
          !isNewEnquiry(deal) &&
          deal.stage !== "payment_pending" &&
          time(deal.next_action_at) < endOfToday,
      )
      .sort(byTime((deal) => deal.next_action_at)),
    trials: deals
      .filter(
        (deal) =>
          deal.stage === "trial_booked" &&
          !!deal.trial_at &&
          [today, tomorrow].includes(istDateKey(deal.trial_at)),
      )
      .sort(byTime((deal) => deal.trial_at)),
    paymentPending: deals
      .filter((deal) => deal.stage === "payment_pending")
      .sort(byTime((deal) => deal.next_action_at)),
    fees: deals
      .filter(
        (deal) =>
          deal.stage === "enrolled" &&
          !!deal.next_fee_due &&
          deal.next_fee_due <= feeLimit,
      )
      .sort((a, b) =>
        (a.next_fee_due ?? "").localeCompare(b.next_fee_due ?? ""),
      ),
  };
};

/** "5 min", "2 h 5 min", "3 d 4 h" */
export const formatMinutes = (totalMinutes: number): string => {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
};

export const formatWaiting = (sinceIso: string, now: Date): string =>
  formatMinutes((now.getTime() - Date.parse(sinceIso)) / MINUTE_MS);

export interface WeekStats {
  enquiries: number;
  medianFirstResponseMinutes: number | null;
  trials: number;
  enrolled: number;
  lostByReason: { reason: string | null; count: number }[];
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

export const buildWeekStats = (deals: Deal[], now: Date): WeekStats => {
  const start = istWeekStart(now).getTime();
  const end = start + WEEK_MS;
  const inWeek = (iso: string | null | undefined) => {
    const t = time(iso);
    return t >= start && t < end;
  };

  const enquiriesThisWeek = deals.filter((deal) => inWeek(deal.created_at));
  const responseMinutes = enquiriesThisWeek
    .filter((deal) => deal.first_response_at)
    .map(
      (deal) =>
        (time(deal.first_response_at) - time(deal.created_at)) / MINUTE_MS,
    );

  const lostCounts = new Map<string | null, number>();
  for (const deal of deals) {
    if (deal.stage === "lost" && inWeek(deal.stage_changed_at)) {
      const reason = deal.lost_reason ?? null;
      lostCounts.set(reason, (lostCounts.get(reason) ?? 0) + 1);
    }
  }

  return {
    enquiries: enquiriesThisWeek.length,
    medianFirstResponseMinutes: median(responseMinutes),
    trials: deals.filter((deal) => inWeek(deal.trial_at)).length,
    enrolled: deals.filter((deal) => inWeek(deal.enrolled_at)).length,
    lostByReason: [...lostCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
};
