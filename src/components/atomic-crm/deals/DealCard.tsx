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
        className={`py-3 transition-all duration-200 ${
          snapshot?.isDragging
            ? "opacity-90 transform rotate-1 shadow-lg"
            : "shadow-sm hover:shadow-md"
        }`}
      >
        <CardContent className="px-3 flex flex-col gap-1">
          <p className="text-sm font-medium">{deal.child_name || deal.name}</p>
          {course && <p className="text-xs text-muted-foreground">{course}</p>}
          {showNextAction && (
            <p
              className={cn(
                "text-xs",
                isOverdue
                  ? "text-destructive font-medium"
                  : "text-muted-foreground",
              )}
              data-overdue={isOverdue}
            >
              Next: {formatInZone(deal.next_action_at!, IST)}
              {isOverdue && " (overdue)"}
            </p>
          )}
          {days != null && (
            <p className="text-xs text-muted-foreground">
              {days} {days === 1 ? "day" : "days"} in stage
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
