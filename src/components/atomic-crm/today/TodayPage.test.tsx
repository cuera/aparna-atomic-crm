import { memoryStore } from "ra-core";
import { render } from "vitest-browser-react";
import {
  buildContact,
  buildDeal,
  createCrmDb,
  createTestAuthProvider,
  StoryWrapper,
} from "@/test/StoryWrapper";

import { addDaysToDateKey, istDateKey, istDayStart } from "../misc/time";
import { testI18nProvider } from "../providers/commons/i18nProvider";
import { createDataProvider } from "../providers/fakerest";
import type { Db } from "../providers/fakerest/dataGenerator/types";
import { CRM } from "../root/CRM";
import type { Deal } from "../types";
import { TodayPage } from "./TodayPage";

const mockIsMobile = vi.hoisted(() => vi.fn(() => false));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: mockIsMobile }));

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const buildData = (): Partial<Db> => {
  const now = Date.now();
  const at = (offsetMs: number) => new Date(now + offsetMs).toISOString();
  const today = istDateKey(new Date(now));
  const tomorrow6pmIst = new Date(
    istDayStart(addDaysToDateKey(today, 1)).getTime() + 18 * HOUR,
  ).toISOString();
  const parents = [
    buildContact({
      id: 1,
      first_name: "Meera",
      last_name: "Shah",
      phone_e164: "+919810000001",
      whatsapp_opt_in: true,
    }),
    buildContact({
      id: 2,
      first_name: "Anita",
      last_name: "Rao",
      phone_e164: "+12125550101",
      timezone: "America/New_York",
      whatsapp_opt_in: true,
    }),
  ];
  const admission = (overrides: Partial<Deal>) =>
    buildDeal({
      contact_ids: [1],
      created_at: at(-30 * 24 * HOUR),
      first_response_at: at(-29 * 24 * HOUR),
      next_action_at: at(5 * 24 * HOUR),
      ...overrides,
    });
  const deals = [
    admission({
      id: 1,
      name: "Riya",
      child_name: "Riya",
      stage: "enquiry",
      created_at: at(-25 * MINUTE),
      first_response_at: null,
    }),
    admission({
      id: 2,
      name: "Arjun",
      child_name: "Arjun",
      stage: "trial_done",
      next_action_at: at(-HOUR),
    }),
    admission({
      id: 3,
      name: "Kabir",
      child_name: "Kabir",
      stage: "trial_booked",
      contact_ids: [2],
      trial_at: tomorrow6pmIst,
    }),
    admission({
      id: 4,
      name: "Diya",
      child_name: "Diya",
      stage: "payment_pending",
    }),
    admission({
      id: 5,
      name: "Ishaan",
      child_name: "Ishaan",
      stage: "enrolled",
      next_action_at: null,
      fee_amount_paise: 450000,
      fee_period: "monthly",
      next_fee_due: addDaysToDateKey(today, 2),
    }),
    // Not on Today: a fee due in 10 days, an enquiry whose follow-up is next week, a lost one
    admission({
      id: 6,
      name: "Zoya",
      child_name: "Zoya",
      stage: "enrolled",
      next_action_at: null,
      fee_period: "monthly",
      next_fee_due: addDaysToDateKey(today, 10),
    }),
    admission({ id: 7, name: "Neel", child_name: "Neel", stage: "enquiry" }),
    admission({
      id: 8,
      name: "Tara",
      child_name: "Tara",
      stage: "lost",
      lost_reason: "price",
      next_action_at: null,
    }),
  ];
  return { contacts: parents, deals };
};

const section = (screen: Awaited<ReturnType<typeof render>>, name: string) =>
  screen.getByRole("region", { name });

describe("Today", () => {
  beforeEach(() => {
    mockIsMobile.mockReturnValue(false);
  });

  it("lists New, Follow-ups, Trials, Payment pending and Fees with one-tap actions", async () => {
    const screen = await render(
      <StoryWrapper data={buildData()}>
        <TodayPage />
      </StoryWrapper>,
    );

    const newSection = section(screen, "New");
    await expect.element(newSection.getByText("Riya")).toBeVisible();
    await expect
      .element(newSection.getByText(/Meera Shah · waiting 2[56] min/))
      .toBeVisible();
    await expect
      .element(newSection.getByRole("button", { name: "WhatsApp: Welcome" }))
      .toBeEnabled();

    await expect
      .element(section(screen, "Follow-ups due").getByText(/overdue since/))
      .toBeVisible();
    await expect
      .element(section(screen, "Follow-ups due").getByText("Arjun"))
      .toBeVisible();

    // Trial time in IST and in the parent's time zone
    await expect
      .element(
        section(screen, "Trials today and tomorrow").getByText(
          /trial \w{3} \d+ \w{3}, 6:00 pm IST · \w{3} \d+ \w{3}, 7:30 am New York/,
        ),
      )
      .toBeVisible();

    await expect
      .element(section(screen, "Payment pending").getByText("Diya"))
      .toBeVisible();

    const fees = section(screen, "Fees due");
    await expect.element(fees.getByText(/₹4,500 due/)).toBeVisible();
    await expect
      .element(fees.getByRole("button", { name: "Mark fee paid" }))
      .toBeVisible();

    for (const hidden of ["Zoya", "Neel", "Tara"]) {
      expect(screen.getByText(hidden, { exact: true }).query()).toBeNull();
    }
  });

  it("opens the admission when a row is tapped", async () => {
    const screen = await render(
      <StoryWrapper data={buildData()}>
        <TodayPage />
      </StoryWrapper>,
    );

    await section(screen, "Payment pending").getByText("Diya").click();

    const dialog = screen.getByRole("dialog");
    await expect
      .element(dialog.getByRole("heading", { name: "Diya" }))
      .toBeVisible();
    await expect
      .element(dialog.getByRole("button", { name: "WhatsApp" }))
      .toBeVisible();
  });

  it.each([
    ["desktop", false],
    ["mobile", true],
  ])("is the %s landing page after login", async (_, isMobile) => {
    mockIsMobile.mockReturnValue(isMobile);
    localStorage.clear();
    // No outer router: the CRM builds its own data router, as in the app
    window.location.hash = "";
    const screen = await render(
      <CRM
        authProvider={createTestAuthProvider()}
        dataProvider={createDataProvider({
          db: createCrmDb(buildData()),
          silent: true,
        })}
        i18nProvider={testI18nProvider}
        store={memoryStore()}
        disableTelemetry
      />,
    );

    await expect
      .element(screen.getByRole("heading", { name: "Today", level: 1 }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("region", { name: "This week" }))
      .toBeVisible();
  });
});
