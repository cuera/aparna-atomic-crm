import { ResourceContextProvider } from "ra-core";
import { render } from "vitest-browser-react";

import { createCrmDb, StoryWrapper } from "@/test/StoryWrapper";
import { createDataProvider } from "../providers/fakerest";
import type { Deal } from "../types";
import { buildAdmission } from "./boardTestUtils";
import DealListMobile from "./DealListMobile";

const mockIsMobile = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: mockIsMobile }));

const renderAdmissions = (deals: Deal[]) =>
  render(
    <StoryWrapper
      dataProvider={createDataProvider({
        db: createCrmDb({ deals }),
        latency: 0,
        silent: true,
      })}
    >
      <ResourceContextProvider value="deals">
        <DealListMobile />
      </ResourceContextProvider>
    </StoryWrapper>,
  );

const admissions = [
  buildAdmission({ id: 1, name: "Asha", child_name: "Asha", stage: "enquiry" }),
  buildAdmission({ id: 2, name: "Ravi", child_name: "Ravi", stage: "enquiry" }),
  buildAdmission({
    id: 3,
    name: "Kabir",
    child_name: "Kabir",
    stage: "trial_booked",
  }),
];

describe("Admissions on a phone", () => {
  it("shows a stage chip with its count for every stage, and the first stage's admissions", async () => {
    // Arrange + Act
    const screen = await renderAdmissions(admissions);

    // Assert
    const stages = screen.getByRole("group", { name: "Stages" });
    await expect
      .element(stages.getByRole("button", { name: "Enquiry 2" }))
      .toHaveAttribute("aria-pressed", "true");
    await expect
      .element(stages.getByRole("button", { name: "Trial booked 1" }))
      .toBeVisible();
    await expect
      .element(stages.getByRole("button", { name: "Lost 0" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Asha", { exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Ravi", { exact: true }))
      .toBeVisible();
    expect(screen.getByText("Kabir", { exact: true }).query()).toBeNull();
  });

  it("switches to another stage's admissions when its chip is tapped", async () => {
    // Arrange
    const screen = await renderAdmissions(admissions);
    const stages = screen.getByRole("group", { name: "Stages" });
    await expect
      .element(screen.getByText("Asha", { exact: true }))
      .toBeVisible();

    // Act
    await stages.getByRole("button", { name: "Trial booked 1" }).click();

    // Assert
    await expect
      .element(screen.getByText("Kabir", { exact: true }))
      .toBeVisible();
    expect(screen.getByText("Asha", { exact: true }).query()).toBeNull();
  });

  it("says there is nothing in a stage with no admissions", async () => {
    // Arrange
    const screen = await renderAdmissions(admissions);

    // Act
    await screen
      .getByRole("group", { name: "Stages" })
      .getByRole("button", { name: "Lost 0" })
      .click();

    // Assert
    await expect.element(screen.getByText("Nothing here.")).toBeVisible();
  });
});
