import * as Papa from "papaparse";

import type { ImportRow } from "./types";

/**
 * Reads a whole CSV file as text cells keyed by header: a phone such as
 * "098765 43210" must keep its leading zero, so nothing is converted.
 */
export const parseCsvRows = (file: File): Promise<ImportRow[]> =>
  new Promise((resolve, reject) => {
    Papa.parse<ImportRow>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
      complete: (results) => resolve(results.data),
      error: reject,
    });
  });
