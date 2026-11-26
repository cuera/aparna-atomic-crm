import {
  company as fakerCompany,
  internet,
  lorem,
  name,
  phone,
  random,
} from "faker/locale/en_US";

import { defaultNoteStatuses } from "../../../root/defaultConfiguration";
import { contactGender } from "../../../contacts/contactModel";
import type { Company, Contact } from "../../../types";
import type { Db } from "./types";
import { randomDate, weightedBoolean } from "./utils";

const maxContacts = {
  1: 1,
  10: 4,
  50: 12,
  250: 25,
  500: 50,
};

// Most families are in India; some are abroad, with their own time zone (M-106).
// Picked by id so every generated set has foreign numbers.
const parentCountries = [
  { country: "India", timezone: "Asia/Kolkata", prefix: "+919810" },
  { country: "India", timezone: "Asia/Kolkata", prefix: "+919710" },
  {
    country: "United Arab Emirates",
    timezone: "Asia/Dubai",
    prefix: "+971501",
  },
  { country: "India", timezone: "Asia/Kolkata", prefix: "+919910" },
  { country: "United Kingdom", timezone: "Europe/London", prefix: "+447700" },
  { country: "India", timezone: "Asia/Kolkata", prefix: "+919610" },
  { country: "United States", timezone: "America/New_York", prefix: "+12125" },
  { country: "India", timezone: "Asia/Kolkata", prefix: "+919510" },
  { country: "Singapore", timezone: "Asia/Singapore", prefix: "+6581" },
  { country: "India", timezone: "Asia/Kolkata", prefix: "+919410" },
];

const getRandomContactDetailsType = () =>
  random.arrayElement(["Work", "Home", "Other"]) as "Work" | "Home" | "Other";

export const generateContacts = (db: Db, size = 500): Required<Contact>[] => {
  const nbAvailblePictures = 223;
  let numberOfContacts = 0;

  return Array.from(Array(size).keys()).map((id) => {
    const has_avatar =
      weightedBoolean(25) && numberOfContacts < nbAvailblePictures;
    const gender = random.arrayElement(contactGender).value;
    const first_name = name.firstName(gender as any);
    const last_name = name.lastName();
    const email_jsonb = [
      {
        email: internet.email(first_name, last_name),
        type: getRandomContactDetailsType(),
      },
    ];
    const { country, timezone, prefix } =
      parentCountries[id % parentCountries.length];
    // Unique per contact, and valid E.164 (the database checks the format)
    const phone_e164 = prefix + String(id).padStart(6, "0");
    const phone_jsonb = [
      {
        number: phone_e164,
        type: getRandomContactDetailsType(),
      },
      {
        number: phone.phoneNumber(),
        type: getRandomContactDetailsType(),
      },
    ];
    const avatar = {
      src: has_avatar
        ? "https://marmelab.com/posters/avatar-" +
          (223 - numberOfContacts) +
          ".jpeg"
        : undefined,
    };
    const title = fakerCompany.bsAdjective();

    if (has_avatar) {
      numberOfContacts++;
    }

    // choose company with people left to know
    let company: Company;
    do {
      company = random.arrayElement(db.companies);
    } while ((company.nb_contacts ?? 0) >= maxContacts[company.size]);
    company.nb_contacts = (company.nb_contacts ?? 0) + 1;

    const first_seen = randomDate(new Date(company.created_at)).toISOString();
    const last_seen = first_seen;

    return {
      id,
      first_name,
      last_name,
      gender,
      title: title.charAt(0).toUpperCase() + title.substr(1),
      company_id: company.id,
      company_name: company.name,
      email_jsonb,
      phone_jsonb,
      background: lorem.sentence(),
      acquisition: random.arrayElement(["inbound", "outbound"]),
      avatar,
      first_seen: first_seen,
      last_seen: last_seen,
      has_newsletter: weightedBoolean(30),
      status: random.arrayElement(defaultNoteStatuses).value,
      tags: random
        .arrayElements(db.tags, random.arrayElement([0, 0, 0, 1, 1, 2]))
        .map((tag) => tag.id), // finalize
      sales_id: company.sales_id!,
      nb_tasks: 0,
      linkedin_url: null,
      country,
      timezone,
      phone_e164,
      whatsapp_opt_in: weightedBoolean(95),
    };
  });
};
