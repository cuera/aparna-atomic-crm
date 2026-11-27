import { beforeAll, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import { buildContact } from "@/test/StoryWrapper";
import { renderBoard } from "../deals/boardTestUtils";
import type { Contact, Deal } from "../types";

const HOUR_MS = 60 * 60 * 1000;

// A parent already on file; synthetic number
const meera = buildContact({
  id: 7,
  first_name: "Meera",
  last_name: "Shah",
  phone_e164: "+919876543210",
  country: "IN",
  timezone: "Asia/Kolkata",
});

const openQuickAdd = async () => {
  const result = await renderBoard({ contacts: [meera] });
  // The button sits on the admissions board header
  await result.screen
    .getByRole("button", { name: "Quick add enquiry" })
    .click();
  const dialog = result.screen.getByRole("dialog", {
    name: "Quick add enquiry",
  });
  await expect.element(dialog).toBeVisible();
  return { ...result, dialog };
};

const getAll = async <T,>(
  dataProvider: Awaited<ReturnType<typeof renderBoard>>["dataProvider"],
  resource: string,
) =>
  (
    await dataProvider.getList(resource, {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    })
  ).data as T[];

describe("Quick-add enquiry (M-202)", () => {
  beforeAll(() => {
    page.viewport(1600, 1200);
  });

  it("creates a parent and an enquiry due in two hours, with the time zone guessed from a US number", async () => {
    // Arrange
    const { screen, dialog, dataProvider } = await openQuickAdd();

    // Act
    await dialog.getByLabelText(/parent name/i).fill("Dana Lee");
    await dialog.getByLabelText(/whatsapp number/i).fill("+1 415 555 2671");
    await expect.element(dialog.getByText("Country: US")).toBeVisible();
    await expect
      .element(dialog.getByRole("combobox", { name: /time zone/i }))
      .toHaveTextContent("America/New_York");
    await dialog.getByLabelText(/child name/i).fill("Ben");
    await dialog.getByRole("button", { name: "Save" }).click();

    // Assert
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(screen.getByText("Enquiry added")).toBeVisible();
    const contacts = await getAll<Contact>(dataProvider, "contacts");
    const dana = contacts.find((c) => c.phone_e164 === "+14155552671");
    expect(dana).toMatchObject({
      first_name: "Dana",
      last_name: "Lee",
      country: "US",
      timezone: "America/New_York",
      whatsapp_opt_in: true,
    });
    const [deal] = await getAll<Deal>(dataProvider, "deals");
    expect(deal).toMatchObject({
      name: "Ben",
      child_name: "Ben",
      stage: "enquiry",
      contact_ids: [dana!.id],
    });
    const dueIn = new Date(deal.next_action_at!).getTime() - Date.now();
    expect(dueIn).toBeGreaterThan(2 * HOUR_MS - 5 * 60 * 1000);
    expect(dueIn).toBeLessThanOrEqual(2 * HOUR_MS);
    // the new enquiry shows on the board
    await expect
      .element(screen.getByText("Ben", { exact: true }))
      .toBeVisible();
  });

  it("guesses London for a UK number and keeps the time zone the user picks instead", async () => {
    // Arrange
    const { screen, dialog, dataProvider } = await openQuickAdd();

    // Act
    await dialog.getByLabelText(/parent name/i).fill("Tom Hale");
    await dialog.getByLabelText(/whatsapp number/i).fill("+44 7400 123456");
    const timezone = dialog.getByRole("combobox", { name: /time zone/i });
    await expect.element(timezone).toHaveTextContent("Europe/London");
    await timezone.click();
    await userEvent.keyboard("Dublin");
    await screen.getByRole("option", { name: "Europe/Dublin" }).click();
    await dialog.getByLabelText(/child name/i).fill("Ollie");
    await dialog.getByRole("button", { name: "Save" }).click();

    // Assert
    await expect.element(dialog).not.toBeInTheDocument();
    const contacts = await getAll<Contact>(dataProvider, "contacts");
    expect(
      contacts.find((c) => c.phone_e164 === "+447400123456"),
    ).toMatchObject({ country: "GB", timezone: "Europe/Dublin" });
  });

  it("links a known number to the existing parent and warns", async () => {
    // Arrange
    const { screen, dialog, dataProvider } = await openQuickAdd();

    // Act: the same number as Meera's, typed the Indian way
    await dialog.getByLabelText(/parent name/i).fill("Meera S");
    await dialog.getByLabelText(/whatsapp number/i).fill("098765 43210");
    await expect
      .element(dialog.getByText(/This number belongs to Meera Shah/))
      .toBeVisible();
    await dialog.getByLabelText(/child name/i).fill("Kabir");
    await dialog.getByRole("button", { name: "Save" }).click();

    // Assert
    await expect.element(dialog).not.toBeInTheDocument();
    await expect
      .element(
        screen.getByText(
          "This number already belongs to Meera Shah: the enquiry was added to that parent",
        ),
      )
      .toBeVisible();
    const contacts = await getAll<Contact>(dataProvider, "contacts");
    expect(contacts).toHaveLength(1);
    const [deal] = await getAll<Deal>(dataProvider, "deals");
    expect(deal).toMatchObject({ child_name: "Kabir", contact_ids: [7] });
  });

  it("refuses an invalid number with a clear message", async () => {
    // Arrange
    const { dialog, dataProvider } = await openQuickAdd();

    // Act
    await dialog.getByLabelText(/parent name/i).fill("Ravi K");
    await dialog.getByLabelText(/whatsapp number/i).fill("12345");
    await dialog.getByLabelText(/child name/i).fill("Isha");
    await dialog.getByRole("button", { name: "Save" }).click();

    // Assert
    await expect
      .element(dialog.getByText(/enter a valid whatsapp number/i))
      .toBeVisible();
    expect(await getAll<Deal>(dataProvider, "deals")).toHaveLength(0);
    expect(await getAll<Contact>(dataProvider, "contacts")).toHaveLength(1);
  });
});
