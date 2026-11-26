import { beforeAll, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { StoryWrapper } from "@/test/StoryWrapper";
import { CreateForm } from "../deals/DealInputs.stories";
import { SettingsPage, transformFormValues } from "../settings/SettingsPage";
import { useConfigurationContext } from "./ConfigurationContext";
import { defaultConfiguration } from "./defaultConfiguration";

const MVP_STAGES = [
  "enquiry",
  "trial_booked",
  "trial_done",
  "payment_pending",
  "enrolled",
  "lost",
];

// Shows the configuration the app actually uses, the way any screen reads it
const ConfigProbe = () => {
  const config = useConfigurationContext();
  return (
    <pre data-testid="config">
      {JSON.stringify({
        title: config.title,
        currency: config.currency,
        stages: config.dealStages.map((stage) => stage.value),
        pipeline: config.dealPipelineStatuses,
        taskTypes: config.taskTypes.map((type) => type.value),
        courses: config.courses.map((course) => course.label),
        boards: config.boards.map((board) => board.label),
        sources: config.sources.map((source) => source.value),
        lostReasons: config.lostReasons.map((reason) => reason.value),
      })}
    </pre>
  );
};

const readConfig = async () => {
  const probe = page.getByTestId("config");
  await expect.element(probe).toBeInTheDocument();
  return JSON.parse(probe.element().textContent ?? "{}");
};

describe("MVP domain configuration (M-101)", () => {
  beforeAll(() => {
    page.viewport(1600, 900);
  });

  it("uses the MVP config by default, which both the demo and the real entry render (neither passes config props)", async () => {
    // Arrange + Act
    await render(
      <StoryWrapper>
        <ConfigProbe />
      </StoryWrapper>,
    );

    // Assert
    const config = await readConfig();
    expect(config.title).toBe("Aparna's English Coaching");
    expect(config.currency).toBe("INR");
    expect(config.stages).toEqual(MVP_STAGES);
    expect(config.pipeline).toEqual(["enrolled"]);
    expect(config.taskTypes).toEqual(
      expect.arrayContaining(["call", "whatsapp", "trial", "fee", "other"]),
    );
    expect(config.courses.length).toBeGreaterThan(0);
    expect(config.boards).toEqual(
      expect.arrayContaining([
        "CBSE",
        "ICSE",
        "ISC",
        "IGCSE",
        "State",
        "Other",
      ]),
    );
    expect(config.sources).toEqual([
      "whatsapp",
      "call",
      "website",
      "instagram",
      "referral",
      "other",
    ]);
    expect(config.lostReasons).toContain("no-response");
  });

  it("starts a new admission in the enquiry stage", async () => {
    // Arrange + Act
    const screen = await render(<CreateForm />);

    // Assert
    await expect
      .element(screen.getByRole("combobox", { name: /stage/i }))
      .toHaveTextContent("Enquiry");
  });

  it("shows stages read-only on the Settings page while courses stay editable", async () => {
    // Arrange + Act
    const screen = await render(
      <StoryWrapper>
        <SettingsPage />
      </StoryWrapper>,
    );

    // Assert
    const stageList = screen.getByRole("list", { name: "Admission stages" });
    await expect
      .element(stageList.getByText("Payment pending", { exact: true }))
      .toBeVisible();
    // No text box holds a stage label, while a course label is editable
    expect(
      document.querySelector('input[value="Enquiry"], input[value="Lost"]'),
    ).toBeNull();
    await expect
      .poll(() => document.querySelector('input[value="Spoken English"]'))
      .not.toBeNull();
  });

  it("keeps the MVP keys and the fixed stages when the Settings page is saved", () => {
    // Arrange: what the Settings form submits, with an edited course and a tampered stage list
    const submitted = {
      title: "Aparna's English Coaching",
      currency: "INR",
      companySectors: [],
      dealCategories: [],
      noteStatuses: [],
      taskTypes: [{ value: "call", label: "Call" }],
      dealStages: [{ value: "opportunity", label: "Opportunity" }],
      dealPipelineStatuses: ["opportunity"],
      courses: [{ label: "Phonics" }],
      boards: defaultConfiguration.boards,
      sources: defaultConfiguration.sources,
      lostReasons: defaultConfiguration.lostReasons,
    };

    // Act
    const { config } = transformFormValues(submitted);

    // Assert
    expect(config.dealStages?.map((stage) => stage.value)).toEqual(MVP_STAGES);
    expect(config.dealPipelineStatuses).toEqual(["enrolled"]);
    expect(config.courses).toEqual([{ value: "phonics", label: "Phonics" }]);
    expect(config.boards).toEqual(defaultConfiguration.boards);
    expect(config.sources).toEqual(defaultConfiguration.sources);
    expect(config.lostReasons).toEqual(defaultConfiguration.lostReasons);
  });
});
