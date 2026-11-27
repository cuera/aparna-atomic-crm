import { ResourceContextProvider } from "ra-core";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { buildDeal, createCrmDb, StoryWrapper } from "@/test/StoryWrapper";
import { createDataProvider } from "../providers/fakerest";
import type { Db } from "../providers/fakerest/dataGenerator/types";
import type { Deal } from "../types";
import DealList from "./DealList";
import { DealEdit } from "./DealEdit";

/** An MVP admission: no company, named after the child, with a next action. */
export const buildAdmission = (overrides: Partial<Deal>) =>
  buildDeal({
    company_id: undefined as unknown as Deal["company_id"],
    categories: [],
    name: "Asha",
    child_name: "Asha",
    next_action_at: "2030-01-01T10:00:00.000Z",
    ...overrides,
  });

// The test keeps the data provider, so it can read what was saved
const renderWithData = async (data: Partial<Db>, ui: React.ReactNode) => {
  const dataProvider = createDataProvider({
    db: createCrmDb(data),
    silent: true,
  });
  const screen = await render(
    <StoryWrapper dataProvider={dataProvider}>
      <ResourceContextProvider value="deals">{ui}</ResourceContextProvider>
    </StoryWrapper>,
  );
  return { screen, dataProvider };
};

export const renderBoard = (data: Partial<Db>) =>
  renderWithData(data, <DealList />);

export const renderEditForm = (deal: Deal) =>
  renderWithData({ deals: [deal] }, <DealEdit open id={String(deal.id)} />);

/** Moves a card the way a keyboard user does: lift, arrow keys, drop. */
export const dragCard = async (childName: string, arrows: string) => {
  const card = page
    .getByText(childName, { exact: true })
    .element()
    .closest<HTMLElement>("[data-rfd-drag-handle-draggable-id]");
  if (!card) throw new Error(`No card for ${childName}`);
  card.focus();
  await userEvent.keyboard(`{Space}${arrows}{Space}`);
};
