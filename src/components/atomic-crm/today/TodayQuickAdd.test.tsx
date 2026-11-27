import { render } from "vitest-browser-react";
import type { DataProvider } from "ra-core";
import {
  buildContact,
  buildDeal,
  createCrmDb,
  StoryWrapper,
} from "@/test/StoryWrapper";

import { createDataProvider } from "../providers/fakerest";
import type { Contact, Deal } from "../types";
import { TodayPage } from "./TodayPage";

const mockIsMobile = vi.hoisted(() => vi.fn(() => false));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: mockIsMobile }));

const HOUR_MS = 60 * 60 * 1000;

// A parent already on file, with one enrolled child; synthetic number
const meera = buildContact({
  id: 1,
  first_name: "Meera",
  last_name: "Shah",
  phone_e164: "+919876543210",
  country: "IN",
  timezone: "Asia/Kolkata",
});

const getAll = async <T,>(dataProvider: DataProvider, resource: string) =>
  (
    await dataProvider.getList(resource, {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    })
  ).data as T[];

const openQuickAddOnToday = async () => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [meera],
      deals: [
        buildDeal({
          id: 1,
          name: "Ishaan",
          child_name: "Ishaan",
          stage: "enrolled",
          contact_ids: [1],
          next_action_at: null,
        }),
      ],
    }),
    latency: 0,
    silent: true,
  });
  const screen = await render(
    <StoryWrapper dataProvider={dataProvider}>
      <TodayPage />
    </StoryWrapper>,
  );
  await expect
    .element(screen.getByRole("heading", { name: "Today", level: 1 }))
    .toBeVisible();
  await screen.getByRole("button", { name: "Quick add enquiry" }).click();
  const dialog = screen.getByRole("dialog", { name: "Quick add enquiry" });
  await expect.element(dialog).toBeVisible();
  return { screen, dialog, dataProvider };
};

describe("Quick-add on Today (M-403)", () => {
  beforeEach(() => {
    mockIsMobile.mockReturnValue(false);
  });

  it("creates a parent and an enquiry due in two hours, shown under New", async () => {
    // Arrange
    const { screen, dialog, dataProvider } = await openQuickAddOnToday();

    // Act
    await dialog.getByLabelText(/parent name/i).fill("Dana Lee");
    await dialog.getByLabelText(/whatsapp number/i).fill("+1 415 555 2671");
    await dialog.getByLabelText(/child name/i).fill("Ben");
    await dialog.getByRole("button", { name: "Save" }).click();

    // Assert
    await expect.element(dialog).not.toBeInTheDocument();
    const contacts = await getAll<Contact>(dataProvider, "contacts");
    const dana = contacts.find((c) => c.phone_e164 === "+14155552671");
    expect(dana).toMatchObject({
      first_name: "Dana",
      last_name: "Lee",
      country: "US",
      timezone: "America/New_York",
    });
    const deal = (await getAll<Deal>(dataProvider, "deals")).find(
      (candidate) => candidate.child_name === "Ben",
    );
    expect(deal).toMatchObject({
      name: "Ben",
      stage: "enquiry",
      contact_ids: [dana!.id],
    });
    const dueIn = new Date(deal!.next_action_at!).getTime() - Date.now();
    expect(dueIn).toBeGreaterThan(2 * HOUR_MS - 5 * 60 * 1000);
    expect(dueIn).toBeLessThanOrEqual(2 * HOUR_MS);
    await expect
      .element(
        screen
          .getByRole("region", { name: "New" })
          .getByText("Ben", { exact: true }),
      )
      .toBeVisible();
  });

  it("links a known number to the existing parent, as the board button does", async () => {
    // Arrange
    const { screen, dialog, dataProvider } = await openQuickAddOnToday();

    // Act: Meera's number, typed the Indian way
    await dialog.getByLabelText(/parent name/i).fill("Meera S");
    await dialog.getByLabelText(/whatsapp number/i).fill("098765 43210");
    await dialog.getByLabelText(/child name/i).fill("Kabir");
    await dialog.getByRole("button", { name: "Save" }).click();

    // Assert
    await expect.element(dialog).not.toBeInTheDocument();
    await expect
      .element(screen.getByText(/already belongs to Meera Shah/))
      .toBeVisible();
    expect(await getAll<Contact>(dataProvider, "contacts")).toHaveLength(1);
    const kabir = (await getAll<Deal>(dataProvider, "deals")).find(
      (deal) => deal.child_name === "Kabir",
    );
    expect(kabir).toMatchObject({ stage: "enquiry", contact_ids: [1] });
  });

  it("offers quick-add on an empty CRM, next to the onboarding steps, and lands the enquiry on Today", async () => {
    // Arrange: a brand-new CRM, no parent yet
    const dataProvider = createDataProvider({
      db: createCrmDb({ contacts: [], deals: [] }),
      latency: 0,
      silent: true,
    });
    const screen = await render(
      <StoryWrapper dataProvider={dataProvider}>
        <TodayPage />
      </StoryWrapper>,
    );
    await expect
      .element(screen.getByRole("heading", { name: "What's next?" }))
      .toBeVisible();

    // Act
    await screen.getByRole("button", { name: "Quick add enquiry" }).click();
    const dialog = screen.getByRole("dialog", { name: "Quick add enquiry" });
    await dialog.getByLabelText(/parent name/i).fill("Dana Lee");
    await dialog.getByLabelText(/whatsapp number/i).fill("+1 415 555 2671");
    await dialog.getByLabelText(/child name/i).fill("Ben");
    await dialog.getByRole("button", { name: "Save" }).click();

    // Assert: the parent comes with an admission, so it shows under New
    await expect
      .element(
        screen
          .getByRole("region", { name: "New" })
          .getByText("Ben", { exact: true }),
      )
      .toBeVisible();
    const [deal] = await getAll<Deal>(dataProvider, "deals");
    expect(deal).toMatchObject({ child_name: "Ben", stage: "enquiry" });
  });
});
