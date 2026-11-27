import { Card, CardContent } from "@/components/ui/card";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { buildWeekStats, formatMinutes } from "./todaySections";

interface ThisWeekStripProps {
  deals: Deal[];
  now: Date;
}

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-xl font-semibold tabular-nums">{value}</span>
  </div>
);

/** M-306: this week (Monday 00:00 IST onwards) at a glance. */
export const ThisWeekStrip = ({ deals, now }: ThisWeekStripProps) => {
  const { lostReasons } = useConfigurationContext();
  const stats = buildWeekStats(deals, now);
  const lostTotal = stats.lostByReason.reduce((sum, row) => sum + row.count, 0);
  const lostDetail = stats.lostByReason
    .map(
      ({ reason, count }) =>
        `${lostReasons?.find((item) => item.value === reason)?.label ?? reason ?? "No reason"} ${count}`,
    )
    .join(", ");

  return (
    <Card className="gap-0 py-4 shadow-xs">
      <CardContent>
        <section
          aria-label="This week"
          className="grid grid-cols-3 gap-x-4 gap-y-4 sm:grid-cols-[repeat(5,auto)] sm:justify-start sm:gap-x-12"
        >
          <h2 className="col-span-full text-sm font-medium text-muted-foreground">
            This week
          </h2>
          <Stat label="Enquiries" value={stats.enquiries} />
          <Stat
            label="Median first response"
            value={
              stats.medianFirstResponseMinutes == null
                ? "–"
                : formatMinutes(stats.medianFirstResponseMinutes)
            }
          />
          <Stat label="Trials" value={stats.trials} />
          <Stat label="Enrolled" value={stats.enrolled} />
          <div className="col-span-2 flex flex-col gap-0.5 sm:col-span-1">
            <span className="text-xs text-muted-foreground">Lost</span>
            <span className="text-xl font-semibold tabular-nums">
              {lostTotal}
            </span>
            {lostDetail ? (
              <span className="text-xs text-muted-foreground">
                {lostDetail}
              </span>
            ) : null}
          </div>
        </section>
      </CardContent>
    </Card>
  );
};
