import { beforeAll, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import {
  buildAdmission,
  dragCard,
  renderBoard,
  renderEditForm,
} from "./boardTestUtils";

describe("Lost reason (M-204)", () => {
  beforeAll(() => {
    // tall enough for the whole edit form, so every select opens on screen
    page.viewport(1600, 1600);
  });

  it("asks for a reason from the fixed list when an admission is dragged to Lost", async () => {
    // Arrange
    const { screen, dataProvider } = await renderBoard({
      deals: [buildAdmission({ id: 1, stage: "enrolled" })],
    });
    await expect.element(screen.getByText("Asha")).toBeVisible();

    // Act
    await dragCard("Asha", "{ArrowRight}");
    const dialog = screen.getByRole("dialog", { name: "Move to Lost" });
    await dialog.getByRole("combobox", { name: /lost reason/i }).click();
    await screen.getByRole("option", { name: "Price" }).click();
    await dialog.getByRole("button", { name: "Move" }).click();

    // Assert
    await expect.element(dialog).not.toBeInTheDocument();
    await expect
      .poll(async () => (await dataProvider.getOne("deals", { id: 1 })).data)
      .toMatchObject({ stage: "lost", lost_reason: "price" });
  });

  it("does not move the admission without a reason", async () => {
    // Arrange
    const { screen, dataProvider } = await renderBoard({
      deals: [buildAdmission({ id: 1, stage: "enrolled" })],
    });
    await expect.element(screen.getByText("Asha")).toBeVisible();

    // Act: try to confirm without a reason, then give up
    await dragCard("Asha", "{ArrowRight}");
    const dialog = screen.getByRole("dialog", { name: "Move to Lost" });
    await dialog.getByRole("button", { name: "Move" }).click();
    // the prompt stays open: a reason is required
    await expect.element(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // Assert
    await expect.element(dialog).not.toBeInTheDocument();
    const { data } = await dataProvider.getOne("deals", { id: 1 });
    expect(data.stage).toBe("enrolled");
  });

  it("the edit form keeps a Lost admission from saving without a reason", async () => {
    // Arrange: e.g. an imported row in Lost with no reason
    const { screen, dataProvider } = await renderEditForm(
      buildAdmission({ id: 1, stage: "lost", child_grade: "V" }),
    );
    const grade = screen.getByLabelText("Grade");
    await expect.element(grade).toHaveValue("V");
    await grade.fill("VI");

    // Act
    await screen.getByRole("button", { name: /^save$/i }).click();

    // Assert: refused until a reason from the list is picked
    await expect.element(screen.getByRole("dialog")).toBeVisible();
    expect(
      (await dataProvider.getOne("deals", { id: 1 })).data.child_grade,
    ).toBe("V");
    await screen.getByRole("combobox", { name: /lost reason/i }).click();
    await screen.getByRole("option", { name: "Timing" }).click();
    await screen.getByRole("button", { name: /^save$/i }).click();
    await expect
      .poll(async () => (await dataProvider.getOne("deals", { id: 1 })).data)
      .toMatchObject({ child_grade: "VI", lost_reason: "timing" });
  });
});
