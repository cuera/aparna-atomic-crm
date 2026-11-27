import { Draggable } from "@hello-pangea/dnd";
import { useRedirect } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { formatInZone, IST } from "../misc/time";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { isOpenStage } from "./DealInputs";

const DAY_MS = 24 * 60 * 60 * 1000;

const daysInStage = (stageChangedAt: string, now = Date.now()) =>
  Math.max(0, Math.floor((now - new Date(stageChangedAt).getTime()) / DAY_MS));

export const DealCard = ({ deal, index }: { deal: Deal; index: number }) => {
  if (!deal) return null;

  return (
    <Draggable draggableId={String(deal.id)} index={index}>
      {(provided, snapshot) => (
        <DealCardContent provided={provided} snapshot={snapshot} deal={deal} />
      )}
    </Draggable>
  );
};

export const DealCardContent = ({
  provided,
  snapshot,
  deal,
}: {
  provided?: any;
  snapshot?: any;
  deal: Deal;
}) => {
  const { courses } = useConfigurationContext();
  const redirect = useRedirect();
  const handleClick = () => {
    redirect(`/deals/${deal.id}/show`, undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };
  const course = courses.find((c) => c.value === deal.course)?.label;
  const showNextAction = isOpenStage(deal.stage) && !!deal.next_action_at;
  const isOverdue =
    showNextAction && new Date(deal.next_action_at!).getTime() < Date.now();
  const days = deal.stage_changed_at
    ? daysInStage(deal.stage_changed_at)
    : null;

  return (
    <div
      className="cursor-pointer"
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      ref={provided?.innerRef}
      onClick={handleClick}
    >
      <Card
        className={cn(
          "gap-0 py-3 shadow-xs motion-safe:transition-[transform,opacity] motion-safe:duration-150",
          snapshot?.isDragging
            ? "opacity-95 shadow-lg ring-primary/40"
            : "motion-safe:hover:-translate-y-0.5 hover:shadow-md",
        )}
      >
        <CardContent className="flex flex-col gap-1 px-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <p className="min-w-0 text-sm font-semibold">
              {deal.child_name || deal.name}
            </p>
            {days != null && (
              <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {days} {days === 1 ? "day" : "days"} in stage
              </p>
            )}
          </div>
          {course && <p className="text-xs text-muted-foreground">{course}</p>}
          {showNextAction && (
            <p
              className={cn(
                "text-xs tabular-nums",
                isOverdue
                  ? "font-medium text-destructive"
                  : "text-muted-foreground",
              )}
              data-overdue={isOverdue}
            >
              Next: {formatInZone(deal.next_action_at!, IST)}
              {isOverdue && " (overdue)"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
