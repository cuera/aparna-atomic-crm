import { useGetList, useGetOne } from "ra-core";
import { render } from "vitest-browser-react";
import { buildDeal, StoryWrapper } from "@/test/StoryWrapper";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import type { Db } from "../providers/fakerest/dataGenerator/types";
import { getDataProvider } from "../providers/supabase/dataProvider";
import type { Deal, DealNote } from "../types";
import { MarkFeePaidButton } from "./MarkFeePaidButton";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("../providers/supabase/supabase", () => ({
  getSupabaseClient: () => ({ rpc }),
}));

vi.hoisted(() => {
  window._atomicCrmConfig = {
    supabaseUrl: "http://localhost:54321",
    supabasePublishableKey: "test-key",
  };
});

const enrolledDeal = buildDeal({
  id: 1,
  stage: "enrolled",
  child_name: "Riya",
  fee_amount_paise: 250000,
  fee_period: "monthly",
  next_fee_due: "2026-01-31",
});

const FeeProbe = () => {
  const { data: deal } = useGetOne<Deal>("deals", { id: 1 });
  const { data: notes } = useGetList<DealNote>("deal_notes", {
    filter: { deal_id: 1 },
  });
  return (
    <p>
      next due {deal?.next_fee_due}, {notes?.length ?? 0} fee note(s):{" "}
      {notes?.map((note) => note.text).join(" | ")}
    </p>
  );
};

describe("Mark fee paid", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("advances one period and logs one note when the same shown date is submitted twice", async () => {
    // Arrange: two buttons that both show the same (soon stale) due date, like two open tabs
    const screen = await render(
      <StoryWrapper data={{ deals: [enrolledDeal] }}>
        <div data-testid="tab-1">
          <MarkFeePaidButton deal={enrolledDeal} />
        </div>
        <div data-testid="tab-2">
          <MarkFeePaidButton deal={enrolledDeal} />
        </div>
        <FeeProbe />
      </StoryWrapper>,
    );

    // Act: first submit
    await screen
      .getByTestId("tab-1")
      .getByRole("button", { name: "Mark fee paid" })
      .click();
    await expect
      .element(screen.getByText(/₹2,500 due on 31 Jan 2026 for Riya/))
      .toBeVisible();
    await screen.getByRole("button", { name: "Yes, mark paid" }).click();
    await expect.element(screen.getByText("Fee marked as paid.")).toBeVisible();

    // Act: second submit with the same shown date
    await screen
      .getByTestId("tab-2")
      .getByRole("button", { name: "Mark fee paid" })
      .click();
    await screen.getByRole("button", { name: "Yes, mark paid" }).click();

    // Assert: told it was already updated; one advance (31 Jan -> 28 Feb), one note with the amount
    await expect
      .element(screen.getByText(/already marked as paid/))
      .toBeVisible();
    await expect
      .element(
        screen.getByText(
          "next due 2026-02-28, 1 fee note(s): Fee paid: ₹2500.00, due 2026-01-31, next due 2026-02-28",
        ),
      )
      .toBeVisible();
  });

  it("applies once in demo mode when two calls race with the same shown date", async () => {
    const dataProvider = createDataProvider({
      db: {
        deals: [{ ...enrolledDeal, fee_period: "quarterly" }],
        deal_notes: [],
        sales: [],
      } as unknown as Db,
      latency: 5,
      silent: true,
    });

    const results = await Promise.all([
      dataProvider.markFeePaid(1, "2026-01-31"),
      dataProvider.markFeePaid(1, "2026-01-31"),
    ]);

    expect(results.sort()).toEqual([false, true]);
    const { data: deal } = await dataProvider.getOne<Deal>("deals", { id: 1 });
    expect(deal.next_fee_due).toBe("2026-04-30");
    const { total } = await dataProvider.getList("deal_notes", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(1);
  });

  it("calls mark_fee_paid with the shown due date and passes its boolean through", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null, status: 200 });

    await expect(getDataProvider().markFeePaid(7, "2026-12-01")).resolves.toBe(
      false,
    );
    expect(rpc).toHaveBeenCalledWith("mark_fee_paid", {
      p_deal_id: 7,
      p_shown_due: "2026-12-01",
    });
  });

  it("rejects when the database call returns an error instead of reporting 'already updated'", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "no fee period" },
      status: 400,
    });

    await expect(
      getDataProvider().markFeePaid(7, "2026-12-01"),
    ).rejects.toMatchObject({ status: 400 });
  });
});
