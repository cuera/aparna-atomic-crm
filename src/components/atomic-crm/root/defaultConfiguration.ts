import type { ConfigurationContextValue } from "./ConfigurationContext";
// Import the logos as module assets so Vite resolves their URL relative to the
// JS chunk (import.meta.url), not the current route. A plain "./logos/..." path
// breaks on nested routes like /oauth/consent and under a deployment sub-path.
import darkModeLogo from "./logos/logo_atomic_crm_dark.svg";
import lightModeLogo from "./logos/logo_atomic_crm_light.svg";

export const defaultDarkModeLogo = darkModeLogo;
export const defaultLightModeLogo = lightModeLogo;

export const defaultCurrency = "INR";

export const defaultTitle = "Aparna's English Coaching";

export const defaultCompanySectors = [
  { value: "communication-services", label: "Communication Services" },
  { value: "consumer-discretionary", label: "Consumer Discretionary" },
  { value: "consumer-staples", label: "Consumer Staples" },
  { value: "energy", label: "Energy" },
  { value: "financials", label: "Financials" },
  { value: "health-care", label: "Health Care" },
  { value: "industrials", label: "Industrials" },
  { value: "information-technology", label: "Information Technology" },
  { value: "materials", label: "Materials" },
  { value: "real-estate", label: "Real Estate" },
  { value: "utilities", label: "Utilities" },
];

// MVP admission stages (MVP.md section 4). The database check deals_open_needs_next_action
// hard-codes enrolled and lost as the closed stages, so the Settings page shows these read-only.
export const defaultDealStages = [
  { value: "enquiry", label: "Enquiry" },
  { value: "trial_booked", label: "Trial booked" },
  { value: "trial_done", label: "Trial done" },
  { value: "payment_pending", label: "Payment pending" },
  { value: "enrolled", label: "Enrolled" },
  { value: "lost", label: "Lost" },
];

export const defaultDealPipelineStatuses = ["enrolled"];

export const defaultDealCategories = [
  { value: "other", label: "Other" },
  { value: "copywriting", label: "Copywriting" },
  { value: "print-project", label: "Print project" },
  { value: "ui-design", label: "UI Design" },
  { value: "website-design", label: "Website design" },
];

export const defaultNoteStatuses = [
  { value: "cold", label: "Cold", color: "#7dbde8" },
  { value: "warm", label: "Warm", color: "#e8cb7d" },
  { value: "hot", label: "Hot", color: "#e88b7d" },
  { value: "in-contract", label: "In Contract", color: "#a4e87d" },
];

// "none" stays first: the task forms default to it
export const defaultTaskTypes = [
  { value: "none", label: "None" },
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "trial", label: "Trial" },
  { value: "fee", label: "Fee" },
  { value: "other", label: "Other" },
];

// Placeholder list; the Owner edits it on the Settings page
export const defaultCourses = [
  { value: "spoken-english", label: "Spoken English" },
  { value: "grammar", label: "Grammar (IV-XII)" },
  { value: "creative-writing", label: "Creative Writing" },
  { value: "board-exam-prep", label: "Board Exam Prep" },
  { value: "other", label: "Other" },
];

export const defaultBoards = [
  { value: "cbse", label: "CBSE" },
  { value: "icse", label: "ICSE" },
  { value: "isc", label: "ISC" },
  { value: "igcse", label: "IGCSE" },
  { value: "state", label: "State" },
  { value: "other", label: "Other" },
];

export const defaultSources = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "call", label: "Call" },
  { value: "website", label: "Website" },
  { value: "instagram", label: "Instagram" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

export const defaultLostReasons = [
  { value: "no-response", label: "No response" },
  { value: "price", label: "Price" },
  { value: "timing", label: "Timing" },
  { value: "chose-competitor", label: "Chose competitor" },
  { value: "level-mismatch", label: "Level mismatch" },
  { value: "not-interested", label: "Not interested" },
  { value: "duplicate", label: "Duplicate" },
  { value: "other", label: "Other" },
];

export const defaultConfiguration: Required<ConfigurationContextValue> = {
  companySectors: defaultCompanySectors,
  currency: defaultCurrency,
  dealCategories: defaultDealCategories,
  dealPipelineStatuses: defaultDealPipelineStatuses,
  dealStages: defaultDealStages,
  noteStatuses: defaultNoteStatuses,
  taskTypes: defaultTaskTypes,
  title: defaultTitle,
  darkModeLogo: defaultDarkModeLogo,
  lightModeLogo: defaultLightModeLogo,
  courses: defaultCourses,
  boards: defaultBoards,
  sources: defaultSources,
  lostReasons: defaultLostReasons,
};
