import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import isEqual from "lodash/isEqual";
import pick from "lodash/pick";
import {
  Form,
  useDataProvider,
  useListContext,
  useNotify,
  type DataProvider,
} from "ra-core";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { DealColumn } from "./DealColumn";
import {
  FeeInputs,
  LostReasonInput,
  NextActionInput,
  TrialAtInput,
  isOpenStage,
} from "./DealInputs";
import type { DealsByStage } from "./stages";
import { getDealsByStage } from "./stages";

export const DealListContent = () => {
  const { dealStages } = useConfigurationContext();
  const { data: unorderedDeals, isPending, refetch } = useListContext<Deal>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  const [dealsByStage, setDealsByStage] = useState<DealsByStage>(
    getDealsByStage([], dealStages),
  );

  useEffect(() => {
    if (unorderedDeals) {
      const newDealsByStage = getDealsByStage(unorderedDeals, dealStages);
      if (!isEqual(newDealsByStage, dealsByStage)) {
        setDealsByStage(newDealsByStage);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unorderedDeals]);

  if (isPending) return null;

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, source } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceStage = source.droppableId;
    const destinationStage = destination.droppableId;
    const sourceDeal = dealsByStage[sourceStage][source.index]!;
    const destinationDeal = dealsByStage[destinationStage][
      destination.index
    ] ?? {
      stage: destinationStage,
      index: undefined, // undefined if dropped after the last item
    };

    const move: PendingMove = {
      deal: sourceDeal,
      source: { stage: sourceStage, index: source.index },
      destination: { stage: destinationStage, index: destination.index },
      destinationDeal,
    };

    // Some stages need data first (M-203, M-204, M-206): ask before moving the card
    if (
      sourceStage !== destinationStage &&
      fieldsNeededToEnter(sourceDeal, destinationStage).length > 0
    ) {
      setPendingMove(move);
      return;
    }
    applyMove(move, {});
  };

  const applyMove = (move: PendingMove, stageData: Partial<Deal>) => {
    // compute local state change synchronously
    setDealsByStage(
      updateDealStageLocal(
        move.deal,
        move.source,
        move.destination,
        dealsByStage,
      ),
    );

    // persist the changes
    updateDealStage(move.deal, move.destinationDeal, dataProvider, stageData)
      .catch((error: unknown) => {
        notify(
          error instanceof Error ? error.message : "ra.notification.http_error",
          { type: "error" },
        );
      })
      .finally(() => {
        refetch();
      });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {pendingMove && (
        <StageDataDialog
          move={pendingMove}
          onCancel={() => setPendingMove(null)}
          onConfirm={(stageData) => {
            applyMove(pendingMove, stageData);
            setPendingMove(null);
          }}
        />
      )}
      <div className="flex gap-4">
        {dealStages.map((stage) => (
          <DealColumn
            stage={stage.value}
            deals={dealsByStage[stage.value]}
            key={stage.value}
          />
        ))}
      </div>
    </DragDropContext>
  );
};

type PendingMove = {
  deal: Deal;
  source: { stage: string; index: number };
  destination: { stage: string; index?: number };
  destinationDeal: { stage: string; index?: number };
};

type StageField = "lost_reason" | "trial_at" | "fees" | "next_action_at";

const FIELDS_BY_STAGE_FIELD: Record<StageField, (keyof Deal)[]> = {
  lost_reason: ["lost_reason"],
  trial_at: ["trial_at"],
  fees: ["fee_amount_paise", "fee_period", "next_fee_due"],
  next_action_at: ["next_action_at"],
};

/** What the board asks for before an admission enters a stage. */
const fieldsNeededToEnter = (deal: Deal, stage: string): StageField[] => {
  const fields: StageField[] = [];
  if (stage === "lost") fields.push("lost_reason");
  if (stage === "trial_booked") fields.push("trial_at");
  if (stage === "enrolled") fields.push("fees");
  if (isOpenStage(stage) && !deal.next_action_at) fields.push("next_action_at");
  return fields;
};

const StageDataDialog = ({
  move,
  onCancel,
  onConfirm,
}: {
  move: PendingMove;
  onCancel: () => void;
  onConfirm: (stageData: Partial<Deal>) => void;
}) => {
  const { dealStages } = useConfigurationContext();
  const stage = move.destination.stage;
  const fields = fieldsNeededToEnter(move.deal, stage);
  const stageLabel = dealStages.find((s) => s.value === stage)?.label ?? stage;
  const keys = fields.flatMap((field) => FIELDS_BY_STAGE_FIELD[field]);

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Move to {stageLabel}</DialogTitle>
        <DialogDescription>
          {move.deal.child_name || move.deal.name}
        </DialogDescription>
        <Form
          defaultValues={{ ...pick(move.deal, keys), stage }}
          onSubmit={(values: Partial<Deal>) => onConfirm(pick(values, keys))}
        >
          <div className="flex flex-col gap-4">
            {fields.includes("lost_reason") && <LostReasonInput />}
            {fields.includes("trial_at") && <TrialAtInput />}
            {fields.includes("fees") && <FeeInputs />}
            {fields.includes("next_action_at") && <NextActionInput />}
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Move</Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const updateDealStageLocal = (
  sourceDeal: Deal,
  source: { stage: string; index: number },
  destination: {
    stage: string;
    index?: number; // undefined if dropped after the last item
  },
  dealsByStage: DealsByStage,
) => {
  if (source.stage === destination.stage) {
    // moving deal inside the same column
    const column = dealsByStage[source.stage];
    column.splice(source.index, 1);
    column.splice(destination.index ?? column.length + 1, 0, sourceDeal);
    return {
      ...dealsByStage,
      [destination.stage]: column,
    };
  } else {
    // moving deal across columns
    const sourceColumn = dealsByStage[source.stage];
    const destinationColumn = dealsByStage[destination.stage];
    sourceColumn.splice(source.index, 1);
    destinationColumn.splice(
      destination.index ?? destinationColumn.length + 1,
      0,
      sourceDeal,
    );
    return {
      ...dealsByStage,
      [source.stage]: sourceColumn,
      [destination.stage]: destinationColumn,
    };
  }
};

const updateDealStage = async (
  source: Deal,
  destination: {
    stage: string;
    index?: number; // undefined if dropped after the last item
  },
  dataProvider: DataProvider,
  stageData: Partial<Deal> = {},
) => {
  if (source.stage === destination.stage) {
    // moving deal inside the same column
    // Fetch all the deals in this stage (because the list may be filtered, but we need to update even non-filtered deals)
    const { data: columnDeals } = await dataProvider.getList("deals", {
      sort: { field: "index", order: "ASC" },
      pagination: { page: 1, perPage: 100 },
      filter: { stage: source.stage },
    });
    const destinationIndex = destination.index ?? columnDeals.length + 1;

    if (source.index > destinationIndex) {
      // deal moved up, eg
      // dest   src
      //  <------
      // [4, 7, 23, 5]
      await Promise.all([
        // for all deals between destinationIndex and source.index, increase the index
        ...columnDeals
          .filter(
            (deal) =>
              deal.index >= destinationIndex && deal.index < source.index,
          )
          .map((deal) =>
            dataProvider.update("deals", {
              id: deal.id,
              data: { index: deal.index + 1 },
              previousData: deal,
            }),
          ),
        // for the deal that was moved, update its index
        dataProvider.update("deals", {
          id: source.id,
          data: { index: destinationIndex },
          previousData: source,
        }),
      ]);
    } else {
      // deal moved down, e.g
      // src   dest
      //  ------>
      // [4, 7, 23, 5]
      await Promise.all([
        // for all deals between source.index and destinationIndex, decrease the index
        ...columnDeals
          .filter(
            (deal) =>
              deal.index <= destinationIndex && deal.index > source.index,
          )
          .map((deal) =>
            dataProvider.update("deals", {
              id: deal.id,
              data: { index: deal.index - 1 },
              previousData: deal,
            }),
          ),
        // for the deal that was moved, update its index
        dataProvider.update("deals", {
          id: source.id,
          data: { index: destinationIndex },
          previousData: source,
        }),
      ]);
    }
  } else {
    // moving deal across columns
    // Fetch all the deals in both stages (because the list may be filtered, but we need to update even non-filtered deals)
    const [{ data: sourceDeals }, { data: destinationDeals }] =
      await Promise.all([
        dataProvider.getList("deals", {
          sort: { field: "index", order: "ASC" },
          pagination: { page: 1, perPage: 100 },
          filter: { stage: source.stage },
        }),
        dataProvider.getList("deals", {
          sort: { field: "index", order: "ASC" },
          pagination: { page: 1, perPage: 100 },
          filter: { stage: destination.stage },
        }),
      ]);
    const destinationIndex = destination.index ?? destinationDeals.length + 1;

    await Promise.all([
      // decrease index on the deals after the source index in the source columns
      ...sourceDeals
        .filter((deal) => deal.index > source.index)
        .map((deal) =>
          dataProvider.update("deals", {
            id: deal.id,
            data: { index: deal.index - 1 },
            previousData: deal,
          }),
        ),
      // increase index on the deals after the destination index in the destination columns
      ...destinationDeals
        .filter((deal) => deal.index >= destinationIndex)
        .map((deal) =>
          dataProvider.update("deals", {
            id: deal.id,
            data: { index: deal.index + 1 },
            previousData: deal,
          }),
        ),
      // change the dragged deal to take the destination index and column
      dataProvider.update("deals", {
        id: source.id,
        data: {
          ...stageData,
          index: destinationIndex,
          stage: destination.stage,
        },
        previousData: source,
      }),
    ]);
  }
};
