import { ShowBase, useGetList, useGetMany, type Identifier } from "ra-core";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { QuickAddEnquiryButton } from "../contacts/QuickAddEnquiry";
import { DashboardStepper } from "../dashboard/DashboardStepper";
import { DealShowContent } from "../deals/DealShow";
import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import {
  formatInZone,
  formatIstAndParent,
  IST,
  istDateKey,
} from "../misc/time";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Deal } from "../types";
import {
  formatDateKey,
  formatPaise,
  type TemplateKey,
} from "../whatsapp/templates";
import { WhatsAppSend } from "../whatsapp/WhatsAppSend";
import { MarkFeePaidButton } from "./MarkFeePaidButton";
import { ThisWeekStrip } from "./ThisWeekStrip";
import {
  buildTodaySections,
  formatWaiting,
  type TodaySections,
} from "./todaySections";

const MINUTE_MS = 60 * 1000;
const ADMISSION_PARAM = "admission";

/** The current time, refreshed every minute (the "waiting" timers). */
const useNow = (): Date => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), MINUTE_MS);
    return () => clearInterval(interval);
  }, []);
  return now;
};

/** overdue = red (late or error); waiting = amber (a clock is running). */
type Tone = "overdue" | "waiting";

const toneClass: Record<Tone, string> = {
  overdue: "text-destructive",
  waiting: "text-warning",
};

interface RowProps {
  deal: Deal;
  parent?: Contact;
  detail: ReactNode;
  tone?: Tone;
  keys?: readonly TemplateKey[];
  extra?: ReactNode;
}

const TodayRow = ({ deal, parent, detail, tone, keys, extra }: RowProps) => {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  params.set(ADMISSION_PARAM, String(deal.id));
  const parentName = parent
    ? `${parent.first_name} ${parent.last_name}`.trim()
    : null;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b py-3 last:border-b-0">
      <Link
        to={{ search: params.toString() }}
        className="flex min-w-36 flex-1 flex-col gap-0.5 rounded-md hover:underline"
      >
        <span className="text-base font-semibold">
          {deal.child_name || deal.name}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {parentName ? `${parentName} · ` : ""}
          <span className={cn(tone && ["font-medium", toneClass[tone]])}>
            {detail}
          </span>
        </span>
      </Link>
      <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
        <WhatsAppSend deal={deal} keys={keys} />
        {extra}
      </div>
    </li>
  );
};

const Section = ({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) => (
  <Card className="gap-0 py-4 shadow-xs">
    <CardContent className="gap-0">
      <section aria-label={title}>
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
          {title}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {count}
          </span>
        </h2>
        {count === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <ul>{children}</ul>
        )}
      </section>
    </CardContent>
  </Card>
);

const AdmissionDialog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const id = searchParams.get(ADMISSION_PARAM);
  const close = () => {
    const params = new URLSearchParams(searchParams);
    params.delete(ADMISSION_PARAM);
    setSearchParams(params);
  };
  return (
    <Dialog open={id != null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="lg:max-w-4xl p-4 overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        {id ? (
          <ShowBase resource="deals" id={id}>
            <DealShowContent />
          </ShowBase>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

const firstParentId = (deal: Deal): Identifier | undefined =>
  deal.contact_ids?.[0];

const shownDeals = (sections: TodaySections): Deal[] =>
  Object.values(sections).flat();

const TodayHeader = () => (
  <div className="flex flex-wrap items-center justify-between gap-2">
    <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
    {/* M-403: the board's quick-add, reused as is */}
    <QuickAddEnquiryButton />
  </div>
);

/** M-301: the landing page; replaces the desktop and the mobile dashboard. */
export const TodayPage = () => {
  const now = useNow();
  const { courses } = useConfigurationContext();
  // ponytail: one list of all non-archived admissions; fine at MVP volume (hundreds).
  const {
    data: deals,
    isPending,
    error,
  } = useGetList<Deal>("deals", {
    filter: { "archived_at@is": null },
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "created_at", order: "ASC" },
  });
  const { total: totalContacts, isPending: isPendingContacts } =
    useGetList<Contact>("contacts", { pagination: { page: 1, perPage: 1 } });

  const sections = buildTodaySections(deals ?? [], now);
  const parentIds = [
    ...new Set(
      shownDeals(sections)
        .map(firstParentId)
        .filter((id): id is Identifier => id != null),
    ),
  ];
  const { data: parents } = useGetMany<Contact>(
    "contacts",
    { ids: parentIds },
    { enabled: parentIds.length > 0 },
  );
  const parentOf = (deal: Deal) =>
    parents?.find((parent) => parent.id === firstParentId(deal));

  if (isPending || isPendingContacts) {
    return (
      <div className="flex flex-col gap-2 mt-2">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <p className="text-destructive mt-4">
        Could not load today's list. Please refresh the page.
      </p>
    );
  }
  const today = istDateKey(now);
  const courseLabel = (deal: Deal) =>
    courses?.find((course) => course.value === deal.course)?.label ??
    deal.course;

  return (
    <div className="flex flex-col gap-4 mt-1">
      <TodayHeader />
      {/* A brand-new CRM: the onboarding steps above the (empty) sections, so
          the first enquiry lands where it will live (M5). */}
      {!totalContacts ? <DashboardStepper step={1} /> : null}
      <ThisWeekStrip deals={deals} now={now} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Section title="New" count={sections.newEnquiries.length}>
          {sections.newEnquiries.map((deal) => (
            <TodayRow
              key={deal.id}
              deal={deal}
              parent={parentOf(deal)}
              tone="waiting"
              detail={`waiting ${formatWaiting(deal.created_at, now)}${courseLabel(deal) ? ` · ${courseLabel(deal)}` : ""}`}
              keys={["welcome"]}
            />
          ))}
        </Section>
        <Section title="Follow-ups due" count={sections.followUps.length}>
          {sections.followUps.map((deal) => {
            const isOverdue =
              Date.parse(deal.next_action_at ?? "") < now.getTime();
            return (
              <TodayRow
                key={deal.id}
                deal={deal}
                parent={parentOf(deal)}
                tone={isOverdue ? "overdue" : undefined}
                detail={`${isOverdue ? "overdue since" : "due"} ${formatInZone(deal.next_action_at!, IST)}`}
              />
            );
          })}
        </Section>
        <Section
          title="Trials today and tomorrow"
          count={sections.trials.length}
        >
          {sections.trials.map((deal) => (
            <TodayRow
              key={deal.id}
              deal={deal}
              parent={parentOf(deal)}
              detail={`trial ${formatIstAndParent(deal.trial_at!, parentOf(deal)?.timezone)}`}
              keys={["trial_reminder"]}
            />
          ))}
        </Section>
        <Section title="Payment pending" count={sections.paymentPending.length}>
          {sections.paymentPending.map((deal) => (
            <TodayRow
              key={deal.id}
              deal={deal}
              parent={parentOf(deal)}
              detail={
                deal.next_action_at
                  ? `next action ${formatInZone(deal.next_action_at, IST)}`
                  : "payment pending"
              }
              keys={["payment_link", "payment_followup"]}
            />
          ))}
        </Section>
        <Section title="Fees due" count={sections.fees.length}>
          {sections.fees.map((deal) => {
            const isOverdue = (deal.next_fee_due ?? "") < today;
            const amount =
              deal.fee_amount_paise != null
                ? `${formatPaise(deal.fee_amount_paise)} `
                : "";
            return (
              <TodayRow
                key={deal.id}
                deal={deal}
                parent={parentOf(deal)}
                tone={isOverdue ? "overdue" : undefined}
                detail={`${amount}${isOverdue ? "overdue since" : "due"} ${formatDateKey(deal.next_fee_due!)}`}
                keys={["fee_reminder"]}
                extra={<MarkFeePaidButton deal={deal} />}
              />
            );
          })}
        </Section>
      </div>
      <AdmissionDialog />
    </div>
  );
};

/** The mobile landing page: Today inside the mobile header and content frame. */
export const MobileTodayPage = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  return (
    <>
      <MobileHeader>
        <div className="flex items-center gap-2 py-3 text-foreground no-underline">
          <span className="grid size-8 place-items-center rounded-lg bg-blush">
            <img
              className="[.light_&]:hidden h-5"
              src={darkModeLogo}
              alt={title}
            />
            <img
              className="[.dark_&]:hidden h-5"
              src={lightModeLogo}
              alt={title}
            />
          </span>
          <span className="text-base font-semibold">{title}</span>
        </div>
      </MobileHeader>
      <MobileContent>
        <TodayPage />
      </MobileContent>
    </>
  );
};
