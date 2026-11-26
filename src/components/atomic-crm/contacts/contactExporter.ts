import jsonExport from "jsonexport/dist";
import { downloadCSV, type Exporter } from "ra-core";

import type { Company, Contact, Sale, Tag } from "../types";

// Parents CSV. It spreads every contacts_summary column, so the MVP parent fields
// (country, timezone, phone_e164, whatsapp_opt_in) are exported too (M-103).
export const exporter: Exporter<Contact> = async (
  records,
  fetchRelatedRecords,
) => {
  const companies = await fetchRelatedRecords<Company>(
    records,
    "company_id",
    "companies",
  );
  const sales = await fetchRelatedRecords<Sale>(records, "sales_id", "sales");
  const tags = await fetchRelatedRecords<Tag>(records, "tags", "tags");

  const contacts = records.map((contact) => {
    const exportedContact = {
      ...contact,
      company:
        contact.company_id != null
          ? companies[contact.company_id].name
          : undefined,
      sales:
        contact.sales_id != null
          ? `${sales[contact.sales_id].first_name} ${sales[contact.sales_id].last_name}`
          : undefined,
      tags: contact.tags.map((tagId) => tags[tagId].name).join(", "),
      email_work: contact.email_jsonb?.find((email) => email.type === "Work")
        ?.email,
      email_home: contact.email_jsonb?.find((email) => email.type === "Home")
        ?.email,
      email_other: contact.email_jsonb?.find((email) => email.type === "Other")
        ?.email,
      email_jsonb: JSON.stringify(contact.email_jsonb),
      email_fts: undefined,
      phone_work: contact.phone_jsonb?.find((phone) => phone.type === "Work")
        ?.number,
      phone_home: contact.phone_jsonb?.find((phone) => phone.type === "Home")
        ?.number,
      phone_other: contact.phone_jsonb?.find((phone) => phone.type === "Other")
        ?.number,
      phone_jsonb: JSON.stringify(contact.phone_jsonb),
      phone_fts: undefined,
    };
    delete exportedContact.email_fts;
    delete exportedContact.phone_fts;
    return exportedContact;
  });
  return jsonExport(contacts, {}, (_err: any, csv: string) => {
    downloadCSV(csv, "contacts");
  });
};
