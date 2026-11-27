// One-tap WhatsApp templates (MVP.md section 6). The Owner changes wording through a PR.
// MVP: wa.me links only, no WhatsApp API calls.

import { formatInZone } from "../misc/time";

export const TEMPLATE_KEYS = [
  "welcome",
  "trial_confirm",
  "trial_reminder",
  "after_trial",
  "payment_link",
  "payment_followup",
  "fee_reminder",
  "absence_checkin",
  "progress_update",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export interface TemplateVars {
  parentFirstName?: string | null;
  childName?: string | null;
  /** UTC ISO timestamp of the trial class */
  trialAt?: string | null;
  /** IANA zone the trial time is shown in (the parent's) */
  parentTimeZone?: string | null;
  course?: string | null;
  feeAmountPaise?: number | null;
  /** "YYYY-MM-DD" */
  nextFeeDue?: string | null;
  paymentLink?: string | null;
}

type FilledVars = Record<keyof TemplateVars | "greeting", string>;

interface Template {
  label: string;
  needsPaymentLink: boolean;
  /** Default next follow-up (editable in the "Sent?" dialog) */
  followUp: (context: { now: Date; trialAt?: string | null }) => Date;
  body: (v: FilledVars) => string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const afterNow =
  (ms: number) =>
  ({ now }: { now: Date }) =>
    new Date(now.getTime() + ms);

// Two hours after the trial; one day from now when no trial time is set yet.
const afterTrial = ({
  now,
  trialAt,
}: {
  now: Date;
  trialAt?: string | null;
}) =>
  trialAt
    ? new Date(new Date(trialAt).getTime() + 2 * HOUR_MS)
    : new Date(now.getTime() + DAY_MS);

export const SIGNATURE = "Warm regards,\nAparna's English Coaching";

export const TEMPLATES: Record<TemplateKey, Template> = {
  welcome: {
    label: "Welcome",
    needsPaymentLink: false,
    followUp: afterNow(DAY_MS),
    body: (v) =>
      `${v.greeting} thank you for reaching out about English classes for ${v.childName}! We would love to help. When would be a good time for a short chat?`,
  },
  trial_confirm: {
    label: "Trial confirmed",
    needsPaymentLink: false,
    followUp: afterTrial,
    body: (v) =>
      `${v.greeting} ${v.childName}'s trial class is booked for ${v.trialAt}. We look forward to meeting ${v.childName}!`,
  },
  trial_reminder: {
    label: "Trial reminder",
    needsPaymentLink: false,
    followUp: afterTrial,
    body: (v) =>
      `${v.greeting} a gentle reminder that ${v.childName}'s trial class is on ${v.trialAt}. See you soon!`,
  },
  after_trial: {
    label: "After the trial",
    needsPaymentLink: false,
    followUp: afterNow(2 * DAY_MS),
    body: (v) =>
      `${v.greeting} thank you for joining the trial class. How did ${v.childName} find it? We are happy to answer any questions.`,
  },
  payment_link: {
    label: "Payment link",
    needsPaymentLink: true,
    followUp: afterNow(2 * DAY_MS),
    body: (v) =>
      `${v.greeting} we are so glad ${v.childName} is joining ${v.course}! Here is the payment link: ${v.paymentLink}\nPlease let us know once it is done.`,
  },
  payment_followup: {
    label: "Payment follow-up",
    needsPaymentLink: false,
    followUp: afterNow(3 * DAY_MS),
    body: (v) =>
      `${v.greeting} just checking in about ${v.childName}'s enrolment. Is there anything we can help with?`,
  },
  fee_reminder: {
    label: "Fee reminder",
    needsPaymentLink: true,
    followUp: afterNow(3 * DAY_MS),
    body: (v) =>
      `${v.greeting} a friendly reminder that ${v.childName}'s fee of ${v.feeAmountPaise} is due on ${v.nextFeeDue}. You can pay here: ${v.paymentLink}\nThank you!`,
  },
  absence_checkin: {
    label: "Absence check-in",
    needsPaymentLink: false,
    followUp: afterNow(2 * DAY_MS),
    body: (v) =>
      `${v.greeting} we missed ${v.childName} in class recently and hope all is well. Let us know if we can help ${v.childName} catch up.`,
  },
  progress_update: {
    label: "Progress update",
    needsPaymentLink: false,
    followUp: afterNow(7 * DAY_MS),
    body: (v) =>
      `${v.greeting} here is a quick update on ${v.childName}'s progress:\n\n`,
  },
};

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** Money is stored in paise: 450000 -> "₹4,500". */
export const formatPaise = (paise: number): string => INR.format(paise / 100);

/** "2026-12-01" -> "1 Dec 2026" (a calendar date, no time zone shift). */
export const formatDateKey = (dateKey: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00Z`));

export const buildMessage = (key: TemplateKey, vars: TemplateVars): string => {
  const filled: FilledVars = {
    greeting: vars.parentFirstName?.trim()
      ? `Hello ${vars.parentFirstName.trim()},`
      : "Hello,",
    parentFirstName: vars.parentFirstName ?? "",
    childName: vars.childName?.trim() || "your child",
    trialAt: vars.trialAt
      ? formatInZone(vars.trialAt, vars.parentTimeZone)
      : "the agreed time",
    parentTimeZone: vars.parentTimeZone ?? "",
    course: vars.course?.trim() || "our classes",
    feeAmountPaise:
      vars.feeAmountPaise != null
        ? formatPaise(vars.feeAmountPaise)
        : "this period",
    nextFeeDue: vars.nextFeeDue
      ? formatDateKey(vars.nextFeeDue)
      : "the due date",
    paymentLink: vars.paymentLink?.trim() ?? "",
  };
  return `${TEMPLATES[key].body(filled).trimEnd()}\n\n${SIGNATURE}`;
};

export const defaultFollowUp = (
  key: TemplateKey,
  context: { now: Date; trialAt?: string | null },
): Date => TEMPLATES[key].followUp(context);

/** E.164 ("+919810000001") -> wa.me digits; null when the number is not E.164. */
export const waDigits = (
  phoneE164: string | null | undefined,
): string | null =>
  phoneE164 && /^\+[1-9][0-9]{6,14}$/.test(phoneE164)
    ? phoneE164.slice(1)
    : null;

export const waMeUrl = (digits: string, text: string): string =>
  `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
