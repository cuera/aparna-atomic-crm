import { describe, expect, it } from "vitest";

import {
  defaultBoards,
  defaultCourses,
  defaultDealStages,
  defaultLostReasons,
  defaultSources,
} from "../root/defaultConfiguration";
import dealsSampleCsv from "./deals_sample.csv?raw";
import { parseCsvRows } from "./parseCsvRows";
import type { ImportRow } from "./types";
import { validateAdmissionRows } from "./validateAdmissionRows";

const OPTIONS = {
  stages: defaultDealStages,
  boards: defaultBoards,
  courses: defaultCourses,
  sources: defaultSources,
  lostReasons: defaultLostReasons,
};

// 2026-12-01 09:00 IST
const NOW = new Date("2026-12-01T03:30:00.000Z");

// Synthetic rows only
const enquiry = (overrides: ImportRow = {}): ImportRow => ({
  parent_name: "Asha Verma",
  phone: "98765 00001",
  child_name: "Riya",
  stage: "Enquiry",
  ...overrides,
});

const validate = (rows: ImportRow[], existing: string[] = []) =>
  validateAdmissionRows(rows, new Set(existing), OPTIONS, NOW);

describe("validateAdmissionRows (M-402)", () => {
  it("accepts the downloadable sample as it is", async () => {
    // Arrange
    const rows = await parseCsvRows(
      new File([dealsSampleCsv], "sample.csv", { type: "text/csv" }),
    );

    // Act
    const { admissions, errors } = validate(rows);

    // Assert
    expect(errors).toEqual([]);
    expect(admissions).toHaveLength(4);
  });

  it("lists every failing row with its reason, numbered as in the spreadsheet", () => {
    // Act
    const { errors, admissions } = validate([
      enquiry(),
      enquiry({ phone: "12345", child_name: "Kabir" }),
      enquiry({ parent_name: null, child_name: null }),
      enquiry({ child_name: "Zoya", stage: "Opportunity" }),
    ]);

    // Assert: the header is row 1, so the second data row is row 3
    expect(errors.map(({ row }) => row)).toEqual([3, 4, 5]);
    expect(errors[0].reason).toMatch(/phone: Enter a valid WhatsApp number/);
    expect(errors[1].reason).toBe(
      "parent name is missing; child name is missing",
    );
    expect(errors[2].reason).toBe('unknown stage "Opportunity"');
    // A failing file leaves nothing to write
    expect(admissions).toHaveLength(1);
  });

  it("requires fee amount, period and next due date on enrolled rows", () => {
    // Act
    const { errors } = validate([
      enquiry({ stage: "enrolled" }),
      enquiry({
        child_name: "Kabir",
        stage: "enrolled",
        fee_amount: "abc",
        fee_period: "weekly",
        next_fee_due: "05/12/2026",
      }),
    ]);

    // Assert
    expect(errors).toEqual([
      {
        row: 2,
        reason:
          "enrolled rows need a fee amount; enrolled rows need a fee period; enrolled rows need a next fee due date",
      },
      {
        row: 3,
        reason:
          'fee amount "abc" must be a number of rupees; fee period "weekly" must be monthly or quarterly; next fee due "05/12/2026" must be YYYY-MM-DD',
      },
    ]);
  });

  it("requires a known lost reason on lost rows", () => {
    const { errors } = validate([
      enquiry({ stage: "Lost" }),
      enquiry({ child_name: "Kabir", stage: "Lost", lost_reason: "Moved" }),
    ]);

    expect(errors).toEqual([
      { row: 2, reason: "lost rows need a lost reason" },
      { row: 3, reason: 'unknown lost reason "Moved"' },
    ]);
  });

  it("refuses the same parent phone and child twice in one file", () => {
    const { errors } = validate([
      enquiry(),
      enquiry({ phone: "+91 98765 00001", child_name: " riya " }),
    ]);

    expect(errors).toEqual([
      { row: 3, reason: "same parent phone and child as row 2" },
    ]);
  });

  it("lists rows that reuse a parent as links, not errors", () => {
    // Act
    const { errors, links, admissions } = validate(
      [
        enquiry({ phone: "+91 98765 00009", parent_name: "Known Parent" }),
        enquiry(),
        enquiry({ child_name: "Kabir" }),
      ],
      ["+919876500009"],
    );

    // Assert
    expect(errors).toEqual([]);
    expect(links).toEqual([
      { row: 2, reason: "links to existing parent" },
      { row: 4, reason: "links to existing parent (from row 3)" },
    ]);
    expect(admissions.map((a) => a.existingParent)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("maps a valid enrolled row to the admission fields, fee in paise", () => {
    // Act
    const { admissions } = validate([
      enquiry({
        phone: "+44 7400 123456",
        board: "igcse",
        course: "Spoken English",
        source: "Website",
        grade: "IV",
        stage: "Enrolled",
        fee_amount: "3,000",
        fee_period: "Monthly",
        next_fee_due: "2026-12-05",
        note: "Sibling",
      }),
    ]);

    // Assert
    expect(admissions[0]).toMatchObject({
      row: 2,
      parent: {
        first_name: "Asha",
        last_name: "Verma",
        phone_e164: "+447400123456",
        country: "GB",
        timezone: "Europe/London",
      },
      admission: {
        child_name: "Riya",
        child_grade: "IV",
        board: "igcse",
        course: "spoken-english",
        source: "website",
        stage: "enrolled",
        next_action_at: null,
        description: "Sibling",
        fee_amount_paise: 300000,
        fee_period: "monthly",
        next_fee_due: "2026-12-05",
      },
    });
  });

  it("gives open rows without a follow-up tomorrow 10:00 IST, and reads given times as IST", () => {
    // Act
    const { admissions, errors } = validate([
      enquiry(),
      enquiry({
        child_name: "Kabir",
        stage: "Trial booked",
        next_follow_up: "2026-12-04",
        trial_at: "2026-12-03 18:30",
      }),
      enquiry({ child_name: "Zoya", trial_at: "2026-12-03" }),
    ]);

    // Assert
    expect(admissions[0].admission.next_action_at).toBe(
      "2026-12-02T04:30:00.000Z",
    );
    expect(admissions[1].admission).toMatchObject({
      next_action_at: "2026-12-04T04:30:00.000Z",
      trial_at: "2026-12-03T13:00:00.000Z",
    });
    // A trial needs a time
    expect(errors).toEqual([
      {
        row: 4,
        reason: 'trial_at "2026-12-03" must be YYYY-MM-DD HH:mm (IST)',
      },
    ]);
  });
});
