import { afterEach, describe, expect, it, vi } from "vitest";

import { exporter as parentExporter } from "../contacts/contactExporter";
import { admissionExporter } from "../deals/admissionExporter";

// Reads the CSV file the browser would download (ra-core's downloadCSV hands a Blob to createObjectURL)
const captureDownloadedCsv = () => {
  let blob: Blob | undefined;
  // Keep the test page in place: no real download navigation
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.spyOn(URL, "createObjectURL").mockImplementation((value) => {
    blob = value as Blob;
    return "blob:csv";
  });
  return async () => {
    await expect.poll(() => blob).toBeDefined();
    return blob!.text();
  };
};

// Stand-in for ra-core's fetchRelatedRecords: returns the related records by id
const relatedRecords =
  (byResource: Record<string, Record<number, object>>) =>
  async (_records: unknown, _field: string, resource: string) =>
    byResource[resource] ?? {};

const headerOf = (csv: string) => csv.split("\n")[0].split(",");

describe("CSV export of the MVP fields (M-103)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports parents with country, time zone, WhatsApp number and opt-in", async () => {
    // Arrange
    const readCsv = captureDownloadedCsv();
    const parent = {
      id: 1,
      first_name: "Meera",
      last_name: "Shah",
      company_id: null,
      sales_id: 7,
      tags: [],
      email_jsonb: [],
      phone_jsonb: [],
      country: "United Kingdom",
      timezone: "Europe/London",
      phone_e164: "+447700900123",
      whatsapp_opt_in: false,
    };

    // Act (the export resolves through jsonexport's callback, not through the returned value)
    void parentExporter(
      [parent] as never,
      relatedRecords({
        sales: { 7: { first_name: "Owner", last_name: "A" } },
      }) as never,
      undefined as never,
      "contacts",
    );

    // Assert
    const csv = await readCsv();
    expect(headerOf(csv)).toEqual(
      expect.arrayContaining([
        "country",
        "timezone",
        "phone_e164",
        "whatsapp_opt_in",
      ]),
    );
    expect(csv).toContain("+447700900123");
    expect(csv).toContain("Europe/London");
  });

  it("exports admissions with child, follow-up and fee columns and the parents' names", async () => {
    // Arrange
    const readCsv = captureDownloadedCsv();
    const admission = {
      id: 10,
      name: "Asha",
      child_name: "Asha",
      child_grade: "VII",
      board: "cbse",
      course: "grammar",
      source: "whatsapp",
      stage: "enrolled",
      contact_ids: [1],
      sales_id: 7,
      next_action_at: null,
      lost_reason: null,
      trial_at: "2026-11-20T10:00:00.000Z",
      first_response_at: "2026-11-18T09:00:00.000Z",
      enrolled_at: "2026-11-22T09:00:00.000Z",
      stage_changed_at: "2026-11-22T09:00:00.000Z",
      fee_amount_paise: 350000,
      fee_period: "monthly",
      next_fee_due: "2026-12-01",
    };

    // Act
    void admissionExporter(
      [admission] as never,
      relatedRecords({
        contacts: { 1: { first_name: "Meera", last_name: "Shah" } },
        sales: { 7: { first_name: "Owner", last_name: "A" } },
      }) as never,
      undefined as never,
      "deals",
    );

    // Assert
    const csv = await readCsv();
    expect(headerOf(csv)).toEqual(
      expect.arrayContaining([
        "child_name",
        "child_grade",
        "board",
        "course",
        "source",
        "next_action_at",
        "lost_reason",
        "trial_at",
        "first_response_at",
        "enrolled_at",
        "stage_changed_at",
        "fee_amount_paise",
        "fee_period",
        "next_fee_due",
        "parents",
      ]),
    );
    expect(csv).toContain("Meera Shah");
    expect(csv).toContain("350000");
    expect(csv).toContain("2026-12-01");
  });
});
