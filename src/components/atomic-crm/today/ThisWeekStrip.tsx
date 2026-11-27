import { Card, CardContent } from "@/components/ui/card";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { buildWeekStats, formatMinutes } from "./todaySections";

interface ThisWeekStripProps {
  deals: Deal[];
  now: Date;
}

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex flex-col">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-lg font-semibold">{value}</span>
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
    <Card>
      <CardContent>
        <section
          aria-label="This week"
          className="flex flex-wrap gap-x-8 gap-y-3"
        >
          <h2 className="w-full text-sm font-semibold">This week</h2>
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
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Lost</span>
            <span className="text-lg font-semibold">{lostTotal}</span>
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
