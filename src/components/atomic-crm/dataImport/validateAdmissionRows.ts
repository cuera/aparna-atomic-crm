import { normalisePhone, timezoneForCountry } from "../misc/phone";
import { addDaysToDateKey, fromIstInputValue, istDateKey } from "../misc/time";
import type { LabeledValue } from "../types";
import { toConfiguredValue, toIsoDate, toText } from "./parseCell";
import type { ImportRow } from "./types";

/** A problem or a remark about one CSV row; `row` is the spreadsheet row (the header is row 1). */
export type RowMessage = { row: number; reason: string };

/** One valid CSV row, ready to be written. */
export type ValidAdmission = {
  row: number;
  parent: {
    first_name: string;
    last_name: string;
    phone_e164: string;
    country: string | null;
    timezone: string;
  };
  /** Row number of the earlier row that creates this row's parent, if any. */
  sameParentAsRow?: number;
  /** True when the phone belongs to a parent already in the CRM. */
  existingParent: boolean;
  admission: {
    child_name: string;
    child_grade?: string;
    board?: string;
    course?: string;
    source?: string;
    stage: string;
    next_action_at: string | null;
    trial_at?: string;
    description?: string;
    fee_amount_paise?: number;
    fee_period?: "monthly" | "quarterly";
    next_fee_due?: string;
    lost_reason?: string;
  };
};

export type AdmissionValidation = {
  admissions: ValidAdmission[];
  errors: RowMessage[];
  links: RowMessage[];
};

export type AdmissionOptions = {
  stages: LabeledValue[];
  boards: LabeledValue[];
  courses: LabeledValue[];
  sources: LabeledValue[];
  lostReasons: LabeledValue[];
};

export const ADMISSION_COLUMNS = [
  "parent_name",
  "phone",
  "country",
  "child_name",
  "grade",
  "board",
  "course",
  "source",
  "stage",
  "next_follow_up",
  "trial_at",
  "note",
  "fee_amount",
  "fee_period",
  "next_fee_due",
  "lost_reason",
] as const;

const CLOSED_STAGES = ["enrolled", "lost"];
const FEE_PERIODS = ["monthly", "quarterly"] as const;
const DEFAULT_FOLLOW_UP_TIME = "10:00";
const DATE_TIME_REGEX = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?$/;
const COUNTRY_REGEX = /^[A-Z]{2}$/;

/** Tomorrow 10:00 IST, the follow-up of an open admission imported without one. */
export const defaultFollowUp = (now: Date): string =>
  fromIstInputValue(
    `${addDaysToDateKey(istDateKey(now), 1)}T${DEFAULT_FOLLOW_UP_TIME}`,
  )!.toISOString();

/** "YYYY-MM-DD HH:mm" (or "T") in IST; a bare date gets `dateOnlyTime`, or is refused without one. */
const parseIstDateTime = (
  text: string,
  dateOnlyTime?: string,
): string | undefined => {
  const match = DATE_TIME_REGEX.exec(text);
  if (!match || !toIsoDate(match[1])) return undefined;
  const time = match[2] ?? dateOnlyTime;
  if (!time) return undefined;
  const [hours, minutes] = time.split(":").map(Number);
  if (hours > 23 || minutes > 59) return undefined;
  return fromIstInputValue(`${match[1]}T${time}`)?.toISOString();
};

const childKey = (e164: string, childName: string) =>
  `${e164}|${childName.trim().toLowerCase()}`;

const splitName = (fullName: string) => {
  const [first_name, ...rest] = fullName.trim().split(/\s+/);
  return { first_name, last_name: rest.join(" ") };
};

/**
 * Checks every row of an admissions CSV before anything is written (M-402).
 * `existingPhones` holds the E.164 numbers of the parents already in the CRM.
 */
export const validateAdmissionRows = (
  rows: ImportRow[],
  existingPhones: ReadonlySet<string>,
  options: AdmissionOptions,
  now: Date = new Date(),
): AdmissionValidation => {
  const admissions: ValidAdmission[] = [];
  const errors: RowMessage[] = [];
  const links: RowMessage[] = [];
  const firstRowOfPhone = new Map<string, number>();
  const firstRowOfChild = new Map<string, number>();

  rows.forEach((cells, index) => {
    const row = index + 2;
    const reasons: string[] = [];
    const text = (column: (typeof ADMISSION_COLUMNS)[number]) =>
      toText(cells[column]);
    const option = (
      column: (typeof ADMISSION_COLUMNS)[number],
      choices: LabeledValue[],
      label: string,
    ) => {
      const value = text(column);
      if (value === undefined) return undefined;
      const known = toConfiguredValue(value, choices);
      if (!known) reasons.push(`unknown ${label} "${value}"`);
      return known;
    };

    const parentName = text("parent_name");
    if (!parentName) reasons.push("parent name is missing");
    const childName = text("child_name");
    if (!childName) reasons.push("child name is missing");

    const phone = normalisePhone(text("phone"));
    if (!phone.ok) reasons.push(`phone: ${phone.error}`);

    const countryCell = text("country")?.toUpperCase();
    if (countryCell && !COUNTRY_REGEX.test(countryCell)) {
      reasons.push(
        `country "${countryCell}" must be a two-letter code such as IN or GB`,
      );
    }

    const stageCell = text("stage");
    const stage = stageCell
      ? toConfiguredValue(stageCell, options.stages)
      : undefined;
    if (!stageCell) reasons.push("stage is missing");
    else if (!stage) reasons.push(`unknown stage "${stageCell}"`);

    const board = option("board", options.boards, "board");
    const course = option("course", options.courses, "course");
    const source = option("source", options.sources, "source");

    const followUpCell = text("next_follow_up");
    const followUp = followUpCell
      ? parseIstDateTime(followUpCell, DEFAULT_FOLLOW_UP_TIME)
      : undefined;
    if (followUpCell && !followUp) {
      reasons.push(
        `next follow-up "${followUpCell}" must be YYYY-MM-DD or YYYY-MM-DD HH:mm (IST)`,
      );
    }

    const trialCell = text("trial_at");
    const trialAt = trialCell ? parseIstDateTime(trialCell) : undefined;
    if (trialCell && !trialAt) {
      reasons.push(`trial_at "${trialCell}" must be YYYY-MM-DD HH:mm (IST)`);
    }

    const fee = readFee(cells, stage === "enrolled", reasons);

    const lostReason =
      stage === "lost"
        ? option("lost_reason", options.lostReasons, "lost reason")
        : undefined;
    if (stage === "lost" && !text("lost_reason")) {
      reasons.push("lost rows need a lost reason");
    }

    if (phone.ok && childName) {
      const key = childKey(phone.e164, childName);
      const earlier = firstRowOfChild.get(key);
      if (earlier) {
        reasons.push(`same parent phone and child as row ${earlier}`);
      } else {
        firstRowOfChild.set(key, row);
      }
    }

    if (
      reasons.length > 0 ||
      !phone.ok ||
      !parentName ||
      !childName ||
      !stage
    ) {
      errors.push({ row, reason: reasons.join("; ") });
      return;
    }

    const existingParent = existingPhones.has(phone.e164);
    const sameParentAsRow = firstRowOfPhone.get(phone.e164);
    if (existingParent) {
      links.push({ row, reason: "links to existing parent" });
    } else if (sameParentAsRow) {
      links.push({
        row,
        reason: `links to existing parent (from row ${sameParentAsRow})`,
      });
    } else {
      firstRowOfPhone.set(phone.e164, row);
    }

    const country = countryCell ?? phone.country;
    const isOpen = !CLOSED_STAGES.includes(stage);
    admissions.push({
      row,
      existingParent,
      sameParentAsRow: existingParent ? undefined : sameParentAsRow,
      parent: {
        ...splitName(parentName),
        phone_e164: phone.e164,
        country,
        timezone: timezoneForCountry(country),
      },
      admission: {
        child_name: childName,
        child_grade: text("grade"),
        board,
        course,
        source,
        stage,
        next_action_at: followUp ?? (isOpen ? defaultFollowUp(now) : null),
        trial_at: trialAt,
        description: text("note"),
        ...fee,
        lost_reason: lostReason,
      },
    });
  });

  return { admissions, errors, links };
};

/** Fee columns: required on enrolled rows, ignored on the others. */
const readFee = (
  cells: ImportRow,
  isEnrolled: boolean,
  reasons: string[],
): Pick<
  ValidAdmission["admission"],
  "fee_amount_paise" | "fee_period" | "next_fee_due"
> => {
  if (!isEnrolled) return {};
  const amountText = toText(cells.fee_amount)?.replace(/,/g, "");
  const amount = amountText === undefined ? NaN : Number(amountText);
  const periodText = toText(cells.fee_period)?.toLowerCase();
  const period = FEE_PERIODS.find((candidate) => candidate === periodText);
  const dueText = toText(cells.next_fee_due);
  const due = toIsoDate(dueText ?? null)?.slice(0, 10);

  if (amountText === undefined) reasons.push("enrolled rows need a fee amount");
  else if (!Number.isFinite(amount) || amount < 0) {
    reasons.push(`fee amount "${amountText}" must be a number of rupees`);
  }
  if (!periodText) reasons.push("enrolled rows need a fee period");
  else if (!period) {
    reasons.push(`fee period "${periodText}" must be monthly or quarterly`);
  }
  if (!dueText) reasons.push("enrolled rows need a next fee due date");
  else if (!due) reasons.push(`next fee due "${dueText}" must be YYYY-MM-DD`);

  return {
    fee_amount_paise: Number.isFinite(amount)
      ? Math.round(amount * 100)
      : undefined,
    fee_period: period,
    next_fee_due: due,
  };
};
