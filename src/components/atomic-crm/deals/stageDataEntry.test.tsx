import { beforeAll, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import {
  buildAdmission,
  dragCard,
  renderBoard,
  renderEditForm,
} from "./boardTestUtils";

describe("Stage data entry (M-206)", () => {
  beforeAll(() => {
    page.viewport(1600, 1600);
  });

  it("asks for the trial time when an admission is dragged to Trial booked", async () => {
    // Arrange
    const { screen, dataProvider } = await renderBoard({
      deals: [buildAdmission({ id: 1, stage: "enquiry" })],
    });
    await expect.element(screen.getByText("Asha")).toBeVisible();

    // Act: Enquiry -> Trial booked
    await dragCard("Asha", "{ArrowRight}");
    const dialog = screen.getByRole("dialog", { name: "Move to Trial booked" });
    await dialog.getByLabelText("Trial at").fill("2030-01-05T16:30");
    await dialog.getByRole("button", { name: "Move" }).click();

    // Assert
    await expect.element(dialog).not.toBeInTheDocument();
    await expect
      .poll(async () => (await dataProvider.getOne("deals", { id: 1 })).data)
      .toMatchObject({
        stage: "trial_booked",
        trial_at: new Date("2030-01-05T16:30").toISOString(),
      });
  });

  it("asks for fee amount, period and next due date when an admission is dragged to Enrolled", async () => {
    // Arrange
    const { screen, dataProvider } = await renderBoard({
      deals: [buildAdmission({ id: 1, stage: "payment_pending" })],
    });
    await expect.element(screen.getByText("Asha")).toBeVisible();

    // Act: Payment pending -> Enrolled
    await dragCard("Asha", "{ArrowRight}");
    const dialog = screen.getByRole("dialog", { name: "Move to Enrolled" });
    await dialog.getByLabelText("Fee amount (₹)").fill("2500.50");
    await dialog.getByRole("combobox", { name: /fee period/i }).click();
    await screen.getByRole("option", { name: "Quarterly" }).click();
    await dialog.getByLabelText("Next fee due").fill("2030-02-01");
    await dialog.getByRole("button", { name: "Move" }).click();

    // Assert: money is stored in paise
    await expect.element(dialog).not.toBeInTheDocument();
    await expect
      .poll(async () => (await dataProvider.getOne("deals", { id: 1 })).data)
      .toMatchObject({
        stage: "enrolled",
        fee_amount_paise: 250050,
        fee_period: "quarterly",
        next_fee_due: "2030-02-01",
      });
  });

  it("does not enrol without the fee details", async () => {
    // Arrange
    const { screen, dataProvider } = await renderBoard({
      deals: [buildAdmission({ id: 1, stage: "payment_pending" })],
    });
    await expect.element(screen.getByText("Asha")).toBeVisible();

    // Act
    await dragCard("Asha", "{ArrowRight}");
    const dialog = screen.getByRole("dialog", { name: "Move to Enrolled" });
    await dialog.getByRole("button", { name: "Move" }).click();

    // Assert
    await expect.element(dialog.getByText("Required").first()).toBeVisible();
    const { data } = await dataProvider.getOne("deals", { id: 1 });
    expect(data.stage).toBe("payment_pending");
  });

  it("edits child and fee fields, with no name field: the name follows the child's name", async () => {
    // Arrange
    const { screen, dataProvider } = await renderEditForm(
      buildAdmission({
        id: 1,
        stage: "enrolled",
        fee_amount_paise: 300000,
        fee_period: "monthly",
        next_fee_due: "2030-01-10",
      }),
    );
    const childName = screen.getByLabelText(/child name/i);
    await expect.element(childName).toHaveValue("Asha");

    // Assert: the fields the Counsellor edits are there, the upstream name is not
    await expect.element(screen.getByLabelText("Grade")).toBeVisible();
    for (const select of [/^board/i, /^course/i, /^source/i, /fee period/i]) {
      await expect
        .element(screen.getByRole("combobox", { name: select }))
        .toBeVisible();
    }
    await expect
      .element(screen.getByLabelText("Fee amount (₹)"))
      .toHaveValue(3000);
    await expect
      .element(screen.getByLabelText("Next fee due"))
      .toHaveValue("2030-01-10");
    expect(
      screen.getByRole("textbox", { name: "Name", exact: true }).query(),
    ).toBeNull();

    // Act
    await childName.fill("Riya");
    await screen.getByLabelText("Grade").fill("VII");
    await screen.getByLabelText("Fee amount (₹)").fill("3200");
    await screen.getByRole("button", { name: /^save$/i }).click();

    // Assert
    await expect
      .poll(async () => (await dataProvider.getOne("deals", { id: 1 })).data)
      .toMatchObject({
        name: "Riya",
        child_name: "Riya",
        child_grade: "VII",
        fee_amount_paise: 320000,
      });
  });
});
