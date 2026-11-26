import { describe, expect, it } from "vitest";

import { defaultDealStages } from "../../../root/defaultConfiguration";
import generateData from "./index";

const E164 = /^\+[1-9][0-9]{6,14}$/;

describe("demo data for the MVP (M-106)", () => {
  const db = generateData();

  it("has admissions in every MVP stage", () => {
    const stages = new Set(db.deals.map((deal) => deal.stage));
    expect([...stages].sort()).toEqual(
      defaultDealStages.map((stage) => stage.value).sort(),
    );
  });

  it("has Indian and foreign parents, and foreign numbers carry a non-IST time zone", () => {
    const foreign = db.contacts.filter(
      (contact) => !contact.phone_e164?.startsWith("+91"),
    );
    expect(db.contacts.some((c) => c.phone_e164?.startsWith("+91"))).toBe(true);
    expect(foreign.length).toBeGreaterThan(0);
    expect(foreign.some((c) => c.timezone !== "Asia/Kolkata")).toBe(true);
  });

  it("gives every parent a unique, valid E.164 WhatsApp number, as the database requires", () => {
    const phones = db.contacts.map((contact) => contact.phone_e164);
    phones.forEach((phone) => expect(phone).toMatch(E164));
    expect(new Set(phones).size).toBe(phones.length);
  });

  it("gives every enrolled admission a fee amount, period and next due date", () => {
    const enrolled = db.deals.filter((deal) => deal.stage === "enrolled");
    expect(enrolled.length).toBeGreaterThan(0);
    enrolled.forEach((deal) => {
      expect(deal.fee_amount_paise).toBeGreaterThan(0);
      expect(["monthly", "quarterly"]).toContain(deal.fee_period);
      expect(deal.next_fee_due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it("gives every open admission a next action and every lost one a reason, as the database checks require", () => {
    db.deals.forEach((deal) => {
      if (deal.stage !== "enrolled" && deal.stage !== "lost") {
        expect(deal.next_action_at).toBeTruthy();
      }
      if (deal.stage === "lost") {
        expect(deal.lost_reason).toBeTruthy();
      }
      expect(deal.name).toBe(deal.child_name);
    });
  });
});
