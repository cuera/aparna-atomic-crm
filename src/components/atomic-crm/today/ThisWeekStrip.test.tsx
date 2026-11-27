import { render } from "vitest-browser-react";
import { buildDeal, StoryWrapper } from "@/test/StoryWrapper";

import type { Deal } from "../types";
import { ThisWeekStrip } from "./ThisWeekStrip";

// Wednesday 2 Dec 2026, 12:00 IST; the week started Monday 30 Nov 00:00 IST (29 Nov 18:30 UTC)
const NOW = new Date("2026-12-02T06:30:00Z");
const LAST_WEEK = "2026-11-29T17:30:00Z"; // Sunday 29 Nov, 23:00 IST

let nextId = 1;
const deal = (overrides: Partial<Deal>): Deal =>
  buildDeal({
    id: nextId++,
    stage: "enquiry",
    created_at: "2026-10-01T00:00:00Z",
    ...overrides,
  });

const deals: Deal[] = [
  // Enquiries this week: response times 20, 60 and 30 minutes, plus one unanswered
  deal({
    created_at: "2026-11-30T04:30:00Z",
    first_response_at: "2026-11-30T04:50:00Z",
  }),
  deal({
    created_at: "2026-12-01T03:30:00Z",
    first_response_at: "2026-12-01T04:30:00Z",
  }),
  deal({
    created_at: "2026-12-01T05:30:00Z",
    first_response_at: "2026-12-01T06:00:00Z",
  }),
  deal({ created_at: "2026-12-02T05:00:00Z" }),
  // Last week's enquiry, answered in 5 minutes: not counted
  deal({ created_at: LAST_WEEK, first_response_at: "2026-11-29T17:35:00Z" }),
  // Trials: two this week, one last week
  deal({ stage: "trial_booked", trial_at: "2026-12-03T10:00:00Z" }),
  deal({ stage: "trial_done", trial_at: "2026-11-30T10:00:00Z" }),
  deal({ stage: "trial_done", trial_at: LAST_WEEK }),
  // Enrolled: one this week, one last week
  deal({ stage: "enrolled", enrolled_at: "2026-12-01T08:00:00Z" }),
  deal({ stage: "enrolled", enrolled_at: LAST_WEEK }),
  // Lost this week by reason, and one lost last week
  deal({
    stage: "lost",
    lost_reason: "price",
    stage_changed_at: "2026-11-30T08:00:00Z",
  }),
  deal({
    stage: "lost",
    lost_reason: "price",
    stage_changed_at: "2026-12-02T05:00:00Z",
  }),
  deal({
    stage: "lost",
    lost_reason: "no-response",
    stage_changed_at: "2026-12-01T08:00:00Z",
  }),
  deal({ stage: "lost", lost_reason: "timing", stage_changed_at: LAST_WEEK }),
];

const statValue = (strip: HTMLElement, label: string) =>
  Array.from(strip.querySelectorAll("span")).find(
    (span) => span.textContent === label,
  )?.nextElementSibling?.textContent;

describe("This-week strip", () => {
  it("counts this week's enquiries, median first response, trials, enrolled and lost by reason", async () => {
    const screen = await render(
      <StoryWrapper>
        <ThisWeekStrip deals={deals} now={NOW} />
      </StoryWrapper>,
    );

    const strip = screen.getByRole("region", { name: "This week" });
    await expect.element(strip).toBeVisible();
    const element = strip.element() as HTMLElement;
    expect(statValue(element, "Enquiries")).toBe("4");
    expect(statValue(element, "Median first response")).toBe("30 min");
    expect(statValue(element, "Trials")).toBe("2");
    expect(statValue(element, "Enrolled")).toBe("1");
    expect(statValue(element, "Lost")).toBe("3");
    await expect
      .element(screen.getByText("Price 2, No response 1"))
      .toBeVisible();
  });

  it("shows a dash for the median when no enquiry this week was answered", async () => {
    const screen = await render(
      <StoryWrapper>
        <ThisWeekStrip
          deals={[deal({ created_at: "2026-12-01T03:30:00Z" })]}
          now={NOW}
        />
      </StoryWrapper>,
    );

    const region = screen.getByRole("region", { name: "This week" });
    await expect.element(region).toBeVisible();
    const element = screen
      .getByRole("region", { name: "This week" })
      .element() as HTMLElement;
    await expect
      .poll(() => statValue(element, "Median first response"))
      .toBe("–");
  });
});
