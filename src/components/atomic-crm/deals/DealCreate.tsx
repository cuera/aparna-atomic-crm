import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  CreateBase,
  Form,
  useCreateContext,
  useDataProvider,
  useGetIdentity,
  useListContext,
  useRedirect,
  type DataProvider,
  type GetListResult,
} from "ra-core";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { FormToolbar } from "../layout/FormToolbar";
import type { Deal } from "../types";
import { DealInputs, transformAdmission } from "./DealInputs";

// Mirrors the database default for next_action_at (now + 1 day), so the field starts filled
const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

/**
 * A new admission takes index 0 in its stage: shift the others down by one.
 * Uses dataProvider.update(), which does not update the cache, so the cached list is patched too.
 */
// eslint-disable-next-line react-refresh/only-export-components -- shared admission rule, used by the board, the forms and quick-add
export const makeRoomAtTopOfStage = async (
  deal: Deal,
  allDeals: Deal[],
  dataProvider: DataProvider,
  queryClient: QueryClient,
) => {
  const deals = allDeals.filter(
    (d: Deal) => d.stage === deal.stage && d.id !== deal.id,
  );
  await Promise.all(
    deals.map(async (oldDeal) =>
      dataProvider.update("deals", {
        id: oldDeal.id,
        data: { index: oldDeal.index + 1 },
        previousData: oldDeal,
      }),
    ),
  );
  const dealsById = deals.reduce(
    (acc, d) => ({
      ...acc,
      [d.id]: { ...d, index: d.index + 1 },
    }),
    {} as { [key: string]: Deal },
  );
  queryClient.setQueriesData<GetListResult | undefined>(
    { queryKey: ["deals", "getList"] },
    (res) => {
      if (!res) return res;
      return {
        ...res,
        data: res.data.map((d: Deal) => dealsById[d.id] || d),
      };
    },
    { updatedAt: Date.now() },
  );
};

export const DealCreate = ({ open }: { open: boolean }) => {
  const redirect = useRedirect();
  const dataProvider = useDataProvider();
  const { data: allDeals } = useListContext<Deal>();

  const handleClose = () => {
    redirect("/deals");
  };

  const queryClient = useQueryClient();

  const onSuccess = async (deal: Deal) => {
    if (allDeals) {
      await makeRoomAtTopOfStage(deal, allDeals, dataProvider, queryClient);
    }
    redirect("/deals");
  };

  const { identity } = useGetIdentity();

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="lg:max-w-4xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        <CreateBase
          resource="deals"
          mutationOptions={{ onSuccess }}
          transform={transformAdmission}
        >
          <CreateHeader />
          <Form
            defaultValues={{
              sales_id: identity?.id,
              contact_ids: [],
              index: 0,
              next_action_at: tomorrow(),
            }}
          >
            <DealInputs />
            <FormToolbar />
          </Form>
        </CreateBase>
      </DialogContent>
    </Dialog>
  );
};

const CreateHeader = () => {
  const { defaultTitle } = useCreateContext();
  return (
    <DialogTitle className="text-xl font-semibold">{defaultTitle}</DialogTitle>
  );
};
