import { describe, expect, it } from "vitest";
import type { DataProvider } from "ra-core";

import { buildContact, buildDeal, createCrmDb } from "@/test/StoryWrapper";
import { createDataProvider } from "../providers/fakerest";
import type { Db } from "../providers/fakerest/dataGenerator/types";
import {
  defaultBoards,
  defaultCourses,
  defaultDealStages,
  defaultLostReasons,
  defaultSources,
} from "../root/defaultConfiguration";
import type { Contact, Deal } from "../types";
import type { ImportRow } from "./types";
import { importAdmissions } from "./useAdmissionImport";

const OPTIONS = {
  stages: defaultDealStages,
  boards: defaultBoards,
  courses: defaultCourses,
  sources: defaultSources,
  lostReasons: defaultLostReasons,
};

// 2026-12-01 09:00 IST
const NOW = new Date("2026-12-01T03:30:00.000Z");
const TOMORROW_10_IST = "2026-12-02T04:30:00.000Z";

// A parent already on file; every number here is synthetic
const meera = buildContact({
  id: 1,
  first_name: "Meera",
  last_name: "Shah",
  phone_e164: "+919876543210",
});

const ROWS: ImportRow[] = [
  {
    parent_name: "Asha Verma",
    phone: "98765 00001",
    child_name: "Riya",
    grade: "VI",
    board: "CBSE",
    course: "Grammar (IV-XII)",
    source: "WhatsApp",
    stage: "Enquiry",
    note: "Weekend batch",
  },
  {
    parent_name: "Asha Verma",
    phone: "+91 98765 00001",
    child_name: "Kabir",
    stage: "Enrolled",
    fee_amount: "3000",
    fee_period: "monthly",
    next_fee_due: "2026-12-05",
  },
  {
    parent_name: "Meera S",
    phone: "098765 43210",
    child_name: "Ishaan",
    stage: "Trial booked",
    trial_at: "2026-12-03 18:30",
  },
  {
    parent_name: "Neha Iyer",
    phone: "+44 7400 123456",
    child_name: "Arjun",
    stage: "Lost",
    lost_reason: "Price",
  },
];

const providerWith = (db: Partial<Db> = {}) =>
  createDataProvider({ db: createCrmDb(db), latency: 0, silent: true });

const getAll = async <T>(dataProvider: DataProvider, resource: string) =>
  (
    await dataProvider.getList(resource, {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    })
  ).data as T[];

const run = (rows: ImportRow[], dataProvider: DataProvider) =>
  importAdmissions(rows, {
    dataProvider,
    options: OPTIONS,
    salesId: 0,
    now: NOW,
  });

/** Fails the n-th admission write, as a dropped connection would. */
const failingOnDealWrite = (
  dataProvider: DataProvider,
  failingWrite: number,
): DataProvider => {
  let writes = 0;
  return {
    ...dataProvider,
    create: (resource, params) => {
      if (resource === "deals" && ++writes === failingWrite) {
        return Promise.reject(new Error("Network request failed"));
      }
      return dataProvider.create(resource, params);
    },
  };
};

describe("importAdmissions (M-401)", () => {
  it("creates parents and admissions in every stage, linking known numbers", async () => {
    // Arrange
    const dataProvider = providerWith({ contacts: [meera] });

    // Act
    const report = await run(ROWS, dataProvider);

    // Assert
    expect(report).toEqual({
      status: "done",
      imported: 4,
      skipped: [],
      links: [
        { row: 3, reason: "links to existing parent (from row 2)" },
        { row: 4, reason: "links to existing parent" },
      ],
    });
    const contacts = await getAll<Contact>(dataProvider, "contacts");
    expect(contacts.map((c) => c.phone_e164)).toEqual([
      "+919876543210",
      "+919876500001",
      "+447400123456",
    ]);
    const [, asha, neha] = contacts;
    expect(asha).toMatchObject({
      first_name: "Asha",
      last_name: "Verma",
      country: "IN",
      timezone: "Asia/Kolkata",
      whatsapp_opt_in: true,
    });
    expect(neha).toMatchObject({ country: "GB", timezone: "Europe/London" });

    const [riya, kabir, ishaan, arjun] = await getAll<Deal>(
      dataProvider,
      "deals",
    );
    expect(riya).toMatchObject({
      name: "Riya",
      child_name: "Riya",
      child_grade: "VI",
      board: "cbse",
      course: "grammar",
      source: "whatsapp",
      stage: "enquiry",
      description: "Weekend batch",
      next_action_at: TOMORROW_10_IST,
      contact_ids: [asha.id],
      sales_id: 0,
    });
    // Current student: enrolled with fees, no follow-up needed
    expect(kabir).toMatchObject({
      name: "Kabir",
      stage: "enrolled",
      fee_amount_paise: 300000,
      fee_period: "monthly",
      next_fee_due: "2026-12-05",
      next_action_at: null,
      contact_ids: [asha.id],
    });
    expect(ishaan).toMatchObject({
      stage: "trial_booked",
      trial_at: "2026-12-03T13:00:00.000Z",
      next_action_at: TOMORROW_10_IST,
      contact_ids: [meera.id],
    });
    expect(arjun).toMatchObject({
      stage: "lost",
      lost_reason: "price",
      contact_ids: [neha.id],
    });
  });

  it("writes nothing when any row fails, and reports each failing row", async () => {
    // Arrange
    const dataProvider = providerWith({ contacts: [meera] });

    // Act
    const report = await run(
      [...ROWS, { parent_name: "X", phone: "123", stage: "Enquiry" }],
      dataProvider,
    );

    // Assert
    expect(report.status).toBe("invalid");
    expect(report.status === "invalid" && report.errors).toEqual([
      {
        row: 6,
        reason:
          "child name is missing; phone: Enter a valid WhatsApp number, e.g. 98765 43210 or +44 7400 123456",
      },
    ]);
    expect(await getAll<Contact>(dataProvider, "contacts")).toHaveLength(1);
    expect(await getAll<Deal>(dataProvider, "deals")).toHaveLength(0);
  });

  it("reports the last imported row when a write fails, and a re-run skips the rows already imported", async () => {
    // Arrange
    const dataProvider = providerWith({ contacts: [meera] });

    // Act: the third admission write fails
    const stopped = await run(ROWS, failingOnDealWrite(dataProvider, 3));

    // Assert
    expect(stopped).toMatchObject({
      status: "stopped",
      imported: 2,
      lastImportedRow: 3,
      failed: { row: 4, reason: "Network request failed" },
    });
    expect(await getAll<Deal>(dataProvider, "deals")).toHaveLength(2);

    // Act: the same file again
    const rerun = await run(ROWS, dataProvider);

    // Assert
    expect(rerun).toMatchObject({
      status: "done",
      imported: 2,
      skipped: [
        {
          row: 2,
          reason: "already imported (same parent phone and child name)",
        },
        {
          row: 3,
          reason: "already imported (same parent phone and child name)",
        },
      ],
    });
    const deals = await getAll<Deal>(dataProvider, "deals");
    expect(deals.map((deal) => deal.child_name).sort()).toEqual([
      "Arjun",
      "Ishaan",
      "Kabir",
      "Riya",
    ]);
    expect(await getAll<Contact>(dataProvider, "contacts")).toHaveLength(3);
  });

  it("appends imported cards below the ones already in their stage", async () => {
    // Arrange
    const dataProvider = providerWith({
      contacts: [meera],
      deals: [
        buildDeal({
          id: 1,
          name: "Old",
          stage: "enquiry",
          index: 4,
          contact_ids: [1],
        }),
      ],
    });

    // Act
    await run(
      [
        ROWS[0],
        { ...ROWS[0], child_name: "Zoya" },
        { ...ROWS[2], child_name: "Tara", stage: "Enquiry" },
      ],
      dataProvider,
    );

    // Assert
    const deals = await getAll<Deal>(dataProvider, "deals");
    expect(deals.map(({ name, index }) => ({ name, index }))).toEqual([
      { name: "Old", index: 4 },
      { name: "Riya", index: 5 },
      { name: "Zoya", index: 6 },
      { name: "Tara", index: 7 },
    ]);
  });
});
