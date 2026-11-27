import { beforeAll, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import { buildCompany, buildContact } from "@/test/StoryWrapper";

import {
  buildAdmission,
  dragCard,
  renderBoard,
  renderEditForm,
} from "./boardTestUtils";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("Next action required (M-203)", () => {
  beforeAll(() => {
    page.viewport(1600, 1600);
  });

  it("starts a new admission with a next action tomorrow, like the database default", async () => {
    // Arrange
    const { screen } = await renderBoard({
      deals: [buildAdmission({ id: 1, stage: "enquiry" })],
    });

    // Act
    await screen.getByRole("link", { name: /new admission/i }).click();

    // Assert: the datetime-local value is local time, one day from now (to the minute)
    const nextAction = screen.getByLabelText("Next action");
    await expect.element(nextAction).toBeVisible();
    const value = (nextAction.element() as HTMLInputElement).value;
    const offset = new Date(value).getTime() - Date.now();
    expect(offset).toBeGreaterThan(DAY_MS - 5 * 60 * 1000);
    expect(offset).toBeLessThanOrEqual(DAY_MS);
  });

  it("keeps what was typed when a parent is created from the new admission form", async () => {
    // Arrange: the defaulted next action must not reset the form on re-render
    const { screen, dataProvider } = await renderBoard({
      companies: [buildCompany({ id: 1, name: "Smith Corp" })],
      contacts: [buildContact({ id: 1, company_id: 1 })],
    });
    await screen.getByRole("link", { name: /new admission/i }).click();
    const form = screen.getByRole("dialog");
    await form.getByLabelText(/child name/i).fill("Big opportunity");

    // Act: create a parent that is not on file yet, then save
    const parents = form.getByPlaceholder("Search").first();
    await parents.click();
    await userEvent.type(parents, "Grace Hopper");
    await screen.getByRole("option", { name: /Create Grace Hopper/ }).click();
    const sheet = screen.getByRole("dialog", { name: /new parent/i });
    await sheet.getByRole("button", { name: /^save$/i }).click();
    await expect.element(form.getByText(/Grace Hopper/)).toBeVisible();
    await form.getByRole("button", { name: /^save$/i }).click();

    // Assert
    await expect
      .poll(async () => {
        const { data } = await dataProvider.getList("deals", {
          pagination: { page: 1, perPage: 10 },
          sort: { field: "id", order: "ASC" },
          filter: {},
        });
        return data.map((deal) => deal.child_name);
      })
      .toEqual(["Big opportunity"]);
  });

  it("cannot save an open admission without a next action", async () => {
    // Arrange: e.g. an admission that came back from Lost with its next action cleared
    const { screen, dataProvider } = await renderEditForm(
      buildAdmission({ id: 1, stage: "trial_done", next_action_at: null }),
    );
    await expect
      .element(screen.getByLabelText(/child name/i))
      .toHaveValue("Asha");

    // Act
    await screen.getByRole("button", { name: /^save$/i }).click();

    // Assert: refused, then accepted once a next action is given
    await expect.element(screen.getByText("Required")).toBeVisible();
    await screen.getByLabelText("Next action").fill("2030-03-01T11:00");
    await screen.getByRole("button", { name: /^save$/i }).click();
    await expect
      .poll(async () => (await dataProvider.getOne("deals", { id: 1 })).data)
      .toMatchObject({
        next_action_at: new Date("2030-03-01T11:00").toISOString(),
      });
  });

  it("saves a closed admission without a next action", async () => {
    // Arrange
    const { screen, dataProvider } = await renderEditForm(
      buildAdmission({
        id: 1,
        stage: "lost",
        lost_reason: "price",
        next_action_at: null,
      }),
    );

    // Act
    const childName = screen.getByLabelText(/child name/i);
    await expect.element(childName).toHaveValue("Asha");
    await childName.fill("Asha R");
    await screen.getByRole("button", { name: /^save$/i }).click();

    // Assert
    await expect
      .poll(async () => (await dataProvider.getOne("deals", { id: 1 })).data)
      .toMatchObject({ child_name: "Asha R", next_action_at: null });
  });

  it("asks for a next action when an enrolled admission without one goes back to an open stage", async () => {
    // Arrange
    const { screen, dataProvider } = await renderBoard({
      deals: [
        buildAdmission({ id: 1, stage: "enrolled", next_action_at: null }),
      ],
    });
    await expect.element(screen.getByText("Asha")).toBeVisible();

    // Act: Enrolled -> Payment pending
    await dragCard("Asha", "{ArrowLeft}");
    const dialog = screen.getByRole("dialog", {
      name: "Move to Payment pending",
    });
    await dialog.getByLabelText("Next action").fill("2030-02-01T09:30");
    await dialog.getByRole("button", { name: "Move" }).click();

    // Assert
    await expect.element(dialog).not.toBeInTheDocument();
    await expect
      .poll(async () => (await dataProvider.getOne("deals", { id: 1 })).data)
      .toMatchObject({
        stage: "payment_pending",
        next_action_at: new Date("2030-02-01T09:30").toISOString(),
      });
  });

  it("moves an open admission that already has a next action without asking", async () => {
    // Arrange
    const { screen, dataProvider } = await renderBoard({
      deals: [buildAdmission({ id: 1, stage: "trial_done" })],
    });
    await expect.element(screen.getByText("Asha")).toBeVisible();

    // Act: Trial done -> Payment pending
    await dragCard("Asha", "{ArrowRight}");

    // Assert
    await expect
      .poll(
        async () => (await dataProvider.getOne("deals", { id: 1 })).data.stage,
      )
      .toBe("payment_pending");
    expect(screen.getByRole("dialog").query()).toBeNull();
  });
});
