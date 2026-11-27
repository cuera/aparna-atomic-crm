import { useGetList, useStore, useTranslate } from "ra-core";
import { matchPath, useLocation } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { DealCardContent } from "./DealCard";
import { DealEdit } from "./DealEdit";
import { DealShow } from "./DealShow";

const STAGE_STORE_KEY = "deals.mobile.stage";

/**
 * The admissions board on a phone (ADR-A21 reversed): one stage at a time,
 * picked from a row of stage chips with counts. A card opens the admission;
 * its Edit form changes the stage and asks for the same stage data as the
 * board (lost reason, trial time, fees).
 */
const DealListMobile = () => {
  const translate = useTranslate();
  const location = useLocation();
  const { dealStages } = useConfigurationContext();
  const [selected, setSelected] = useStore<string>(
    STAGE_STORE_KEY,
    dealStages[0]?.value,
  );
  const {
    data: deals,
    isPending,
    error,
  } = useGetList<Deal>("deals", {
    filter: { "archived_at@is": null },
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "index", order: "DESC" },
  });

  const matchShow = matchPath("/deals/:id/show", location.pathname);
  const matchEdit = matchPath("/deals/:id", location.pathname);
  const stage = dealStages.some((s) => s.value === selected)
    ? selected
    : dealStages[0]?.value;
  const inStage = (value: string) =>
    (deals ?? []).filter((deal) => deal.stage === value);
  const shown = inStage(stage);

  return (
    <>
      <MobileHeader>
        <h1 className="text-xl font-semibold">
          {translate("resources.deals.name", { smart_count: 2 })}
        </h1>
      </MobileHeader>
      <MobileContent>
        <div
          role="group"
          aria-label="Stages"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3"
        >
          {dealStages.map(({ value, label }) => {
            const isSelected = value === stage;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelected(value)}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap",
                  isSelected
                    ? "bg-blush text-blush-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {label}
                <span className="tabular-nums">
                  {isPending ? "–" : inStage(value).length}
                </span>
              </button>
            );
          })}
        </div>
        {isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <p className="text-destructive">
            Could not load admissions. Please refresh the page.
          </p>
        ) : shown.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {shown.map((deal) => (
              <DealCardContent key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </MobileContent>
      <DealEdit open={!!matchEdit && !matchShow} id={matchEdit?.params.id} />
      <DealShow open={!!matchShow} id={matchShow?.params.id} />
    </>
  );
};

export default DealListMobile;
