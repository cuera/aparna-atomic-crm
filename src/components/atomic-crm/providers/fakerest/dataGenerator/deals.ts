import { add } from "date-fns";
import { datatype, lorem, name, random } from "faker/locale/en_US";

import {
  defaultBoards,
  defaultCourses,
  defaultDealCategories,
  defaultDealStages,
  defaultLostReasons,
  defaultSources,
} from "../../../root/defaultConfiguration";
import type { Deal } from "../../../types";
import type { Db } from "./types";
import { randomDate } from "./utils";

const childGrades = [
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "adult",
];
const feesInPaise = [250000, 350000, 450000, 600000];

const hoursFromNow = (min: number, max: number) =>
  add(new Date(), { hours: datatype.number({ min, max }) }).toISOString();

// MVP admission fields for a stage (MVP.md section 4): open stages always have a next action,
// some overdue; enrolled admissions carry their fees; lost ones carry a reason.
const generateAdmissionFields = (stage: string) => {
  const isOpen = stage !== "enrolled" && stage !== "lost";
  const stage_changed_at = hoursFromNow(-24 * 10, -1);
  return {
    child_grade: random.arrayElement(childGrades),
    board: random.arrayElement(defaultBoards).value,
    course: random.arrayElement(defaultCourses).value,
    source: random.arrayElement(defaultSources).value,
    next_action_at: isOpen ? hoursFromNow(-48, 24 * 5) : null,
    lost_reason:
      stage === "lost" ? random.arrayElement(defaultLostReasons).value : null,
    trial_at:
      stage === "trial_booked"
        ? hoursFromNow(2, 24 * 4)
        : stage === "trial_done" || stage === "payment_pending"
          ? hoursFromNow(-24 * 6, -2)
          : null,
    first_response_at: stage === "enquiry" ? null : stage_changed_at,
    stage_changed_at,
    enrolled_at: stage === "enrolled" ? stage_changed_at : null,
    fee_amount_paise:
      stage === "enrolled" ? random.arrayElement(feesInPaise) : null,
    fee_period:
      stage === "enrolled"
        ? random.arrayElement(["monthly", "quarterly"] as const)
        : null,
    next_fee_due:
      stage === "enrolled"
        ? hoursFromNow(-24 * 5, 24 * 30).split("T")[0]
        : null,
  };
};

export const generateDeals = (db: Db): Deal[] => {
  const deals = Array.from(Array(50).keys()).map((id) => {
    const company = random.arrayElement(db.companies);
    company.nb_deals = (company.nb_deals ?? 0) + 1;
    const contacts = random.arrayElements(
      db.contacts.filter((contact) => contact.company_id === company.id),
      datatype.number({ min: 1, max: 3 }),
    );
    // Every stage is present: stages are assigned in turn
    const stage = defaultDealStages[id % defaultDealStages.length].value;
    const child_name = name.firstName();
    const created_at = randomDate(new Date(company.created_at)).toISOString();

    const expected_closing_date = randomDate(
      new Date(created_at),
      add(new Date(created_at), { months: 6 }),
    )
      .toISOString()
      .split("T")[0];

    return {
      id,
      // deals.name = child name (the database trigger keeps them equal)
      name: child_name,
      child_name,
      company_id: company.id,
      contact_ids: contacts.map((contact) => contact.id),
      categories: [random.arrayElement(defaultDealCategories).value],
      stage,
      description: lorem.paragraphs(datatype.number({ min: 1, max: 4 })),
      amount: datatype.number(1000) * 100,
      created_at,
      updated_at: randomDate(new Date(created_at)).toISOString(),
      expected_closing_date,
      sales_id: company.sales_id!,
      index: 0,
      ...generateAdmissionFields(stage),
    };
  });
  // compute index based on stage
  defaultDealStages.forEach((stage) => {
    deals
      .filter((deal) => deal.stage === stage.value)
      .forEach((deal, index) => {
        deals[deal.id].index = index;
      });
  });
  return deals;
};
