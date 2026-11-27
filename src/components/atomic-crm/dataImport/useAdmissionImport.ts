import { useCallback } from "react";
import {
  useDataProvider,
  useGetIdentity,
  type DataProvider,
  type Identifier,
} from "ra-core";

import { transformAdmission } from "../deals/DealInputs";
import { normalisePhone } from "../misc/phone";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Deal } from "../types";
import { toText } from "./parseCell";
import type { ImportRow } from "./types";
import {
  validateAdmissionRows,
  type AdmissionOptions,
  type RowMessage,
  type ValidAdmission,
} from "./validateAdmissionRows";

export type AdmissionImportReport =
  | { status: "invalid"; errors: RowMessage[]; links: RowMessage[] }
  | {
      status: "done";
      imported: number;
      skipped: RowMessage[];
      links: RowMessage[];
    }
  | {
      status: "stopped";
      imported: number;
      skipped: RowMessage[];
      links: RowMessage[];
      /** Last row written or skipped before the failure; null when none was. */
      lastImportedRow: number | null;
      failed: RowMessage;
    };

type ImportContext = {
  dataProvider: DataProvider;
  options: AdmissionOptions;
  salesId?: Identifier;
  now?: Date;
};

const ALREADY_IMPORTED = "already imported (same parent phone and child name)";

/**
 * Imports an admissions CSV (M-401, M-402): every row is validated first and a
 * single failing row means nothing is written. Valid files are written row by
 * row; if a write fails midway the import stops and reports the last row that
 * went through, and running the same file again skips the rows already there.
 */
export const importAdmissions = async (
  rows: ImportRow[],
  { dataProvider, options, salesId, now = new Date() }: ImportContext,
): Promise<AdmissionImportReport> => {
  const parentIds = await findParentsByPhone(rows, dataProvider);
  const { admissions, errors, links } = validateAdmissionRows(
    rows,
    new Set(parentIds.keys()),
    options,
    now,
  );
  if (errors.length > 0) return { status: "invalid", errors, links };

  const skipped: RowMessage[] = [];
  const childrenOf = new Map<Identifier, Set<string>>();
  const nextIndexOf = new Map<string, number>();
  let imported = 0;
  let lastImportedRow: number | null = null;

  for (const admission of admissions) {
    try {
      const parentId =
        parentIds.get(admission.parent.phone_e164) ??
        (await createParent(admission, dataProvider, salesId, now));
      parentIds.set(admission.parent.phone_e164, parentId);

      const children = admission.existingParent
        ? await childNamesOf(parentId, childrenOf, dataProvider)
        : undefined;
      if (children?.has(childKey(admission.admission.child_name))) {
        skipped.push({ row: admission.row, reason: ALREADY_IMPORTED });
      } else {
        const index = await nextIndex(
          admission.admission.stage,
          nextIndexOf,
          dataProvider,
        );
        await dataProvider.create<Deal>("deals", {
          data: transformAdmission({
            ...admission.admission,
            contact_ids: [parentId],
            sales_id: salesId,
            index,
          }),
        });
        imported += 1;
      }
      lastImportedRow = admission.row;
    } catch (error: unknown) {
      return {
        status: "stopped",
        imported,
        skipped,
        links,
        lastImportedRow,
        failed: { row: admission.row, reason: errorMessage(error) },
      };
    }
  }
  return { status: "done", imported, skipped, links };
};

/** The import as a function of the parsed rows, bound to the running CRM. */
export const useAdmissionImport = (): ((
  rows: ImportRow[],
) => Promise<AdmissionImportReport>) => {
  const dataProvider = useDataProvider();
  const { identity } = useGetIdentity();
  const { dealStages, boards, courses, sources, lostReasons } =
    useConfigurationContext();

  return useCallback(
    (rows) =>
      importAdmissions(rows, {
        dataProvider,
        salesId: identity?.id,
        options: {
          stages: dealStages,
          boards: boards ?? [],
          courses: courses ?? [],
          sources: sources ?? [],
          lostReasons: lostReasons ?? [],
        },
      }),
    [
      boards,
      courses,
      dataProvider,
      dealStages,
      identity?.id,
      lostReasons,
      sources,
    ],
  );
};

/** Parents already in the CRM, by the E.164 number of the rows that have a valid phone. */
const findParentsByPhone = async (
  rows: ImportRow[],
  dataProvider: DataProvider,
): Promise<Map<string, Identifier>> => {
  const phones = new Set<string>();
  for (const row of rows) {
    const phone = normalisePhone(toText(row.phone));
    if (phone.ok) phones.add(phone.e164);
  }
  const found = new Map<string, Identifier>();
  for (const e164 of phones) {
    const { data } = await dataProvider.getList<Contact>("contacts", {
      filter: { "phone_e164@eq": e164 },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    });
    if (data[0]) found.set(e164, data[0].id);
  }
  return found;
};

const createParent = async (
  { parent }: ValidAdmission,
  dataProvider: DataProvider,
  salesId: Identifier | undefined,
  now: Date,
): Promise<Identifier> => {
  const seen = now.toISOString();
  const { data } = await dataProvider.create<Contact>("contacts", {
    data: {
      ...parent,
      phone_jsonb: [{ number: parent.phone_e164, type: "Home" }],
      email_jsonb: [],
      whatsapp_opt_in: true,
      sales_id: salesId,
      first_seen: seen,
      last_seen: seen,
      tags: [],
    },
  });
  return data.id;
};

const childKey = (childName: string) => childName.trim().toLowerCase();

/** Child names of a parent's admissions, read once per parent. */
const childNamesOf = async (
  parentId: Identifier,
  cache: Map<Identifier, Set<string>>,
  dataProvider: DataProvider,
): Promise<Set<string>> => {
  const cached = cache.get(parentId);
  if (cached) return cached;
  const { data } = await dataProvider.getList<Deal>("deals", {
    filter: { "contact_ids@cs": `{${parentId}}` },
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "id", order: "ASC" },
  });
  const names = new Set(
    data.map((deal) => childKey(deal.child_name || deal.name || "")),
  );
  cache.set(parentId, names);
  return names;
};

/**
 * Next free board position in a stage: imported cards go below the existing
 * ones with distinct indexes, so the column can still be reordered by drag.
 */
const nextIndex = async (
  stage: string,
  cache: Map<string, number>,
  dataProvider: DataProvider,
): Promise<number> => {
  let next = cache.get(stage);
  if (next === undefined) {
    const { data } = await dataProvider.getList<Deal>("deals", {
      filter: { stage },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "index", order: "DESC" },
    });
    next = (data[0]?.index ?? -1) + 1;
  }
  cache.set(stage, next + 1);
  return next;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : "the save failed";
