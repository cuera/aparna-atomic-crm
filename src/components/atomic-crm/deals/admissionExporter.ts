import jsonExport from "jsonexport/dist";
import { downloadCSV, type Exporter } from "ra-core";

import type { Contact, Deal, Sale } from "../types";

/**
 * Admissions CSV (M-103): every admission field, including the MVP child, follow-up and fee
 * columns, plus the parents' and the staff member's names, like the Parents export.
 */
export const admissionExporter: Exporter<Deal> = async (
  records,
  fetchRelatedRecords,
) => {
  const contacts = await fetchRelatedRecords<Contact>(
    records,
    "contact_ids",
    "contacts",
  );
  const sales = await fetchRelatedRecords<Sale>(records, "sales_id", "sales");

  const admissions = records.map((deal) => ({
    ...deal,
    parents: (deal.contact_ids ?? [])
      .map((id) => contacts[id])
      .filter(Boolean)
      .map((contact) => `${contact.first_name} ${contact.last_name}`)
      .join(", "),
    sales:
      deal.sales_id != null && sales[deal.sales_id]
        ? `${sales[deal.sales_id].first_name} ${sales[deal.sales_id].last_name}`
        : undefined,
  }));

  return jsonExport(admissions, {}, (_err: unknown, csv: string) => {
    downloadCSV(csv, "admissions");
  });
};
