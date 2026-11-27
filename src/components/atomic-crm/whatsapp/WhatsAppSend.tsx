import { useMutation } from "@tanstack/react-query";
import { ChevronDown, MessageCircle } from "lucide-react";
import {
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRefresh,
} from "ra-core";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { fromIstInputValue, toIstInputValue } from "../misc/time";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Deal } from "../types";
import {
  buildMessage,
  defaultFollowUp,
  TEMPLATE_KEYS,
  TEMPLATES,
  waDigits,
  waMeUrl,
  type TemplateKey,
} from "./templates";

type Step =
  | { kind: "idle" }
  | { kind: "link"; key: TemplateKey }
  | { kind: "sent"; key: TemplateKey; followUp: string };

interface WhatsAppSendProps {
  deal: Deal;
  /** One key renders a direct button; several render a menu. */
  keys?: readonly TemplateKey[];
}

const PAYMENT_LINK_PATTERN = /^https:\/\/\S+$/;

const blockedReason = (
  parentId: unknown,
  parent: Contact | undefined,
): string | null => {
  if (parentId == null) return "No parent is linked to this admission.";
  if (!parent) return null;
  if (parent.whatsapp_opt_in === false)
    return "The parent has opted out of WhatsApp messages.";
  if (!waDigits(parent.phone_e164)) return "The parent has no WhatsApp number.";
  return null;
};

/**
 * M-304: opens wa.me with a filled template in a new tab, then asks "Sent?" and
 * logs the note, the first response and the next follow-up.
 */
export const WhatsAppSend = ({
  deal,
  keys = TEMPLATE_KEYS,
}: WhatsAppSendProps) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const { identity } = useGetIdentity();
  const { courses } = useConfigurationContext();
  const reasonId = useId();
  const [step, setStep] = useState<Step>({ kind: "idle" });

  const parentId = deal.contact_ids?.[0];
  const { data: parent } = useGetOne<Contact>(
    "contacts",
    { id: parentId! },
    { enabled: parentId != null },
  );
  const reason = blockedReason(parentId, parent);
  const digits = waDigits(parent?.phone_e164);
  const isDisabled = reason != null || !parent || !digits;

  const openWhatsApp = (key: TemplateKey, paymentLink?: string) => {
    if (!parent || !digits) return;
    const text = buildMessage(key, {
      parentFirstName: parent.first_name,
      childName: deal.child_name || deal.name,
      trialAt: deal.trial_at,
      parentTimeZone: parent.timezone,
      course:
        courses?.find((course) => course.value === deal.course)?.label ??
        deal.course,
      feeAmountPaise: deal.fee_amount_paise,
      nextFeeDue: deal.next_fee_due,
      paymentLink,
    });
    window.open(waMeUrl(digits, text), "_blank", "noopener,noreferrer");
    setStep({
      kind: "sent",
      key,
      followUp: toIstInputValue(
        defaultFollowUp(key, { now: new Date(), trialAt: deal.trial_at }),
      ),
    });
  };

  const pick = (key: TemplateKey) => {
    if (TEMPLATES[key].needsPaymentLink) {
      setStep({ kind: "link", key });
    } else {
      openWhatsApp(key);
    }
  };

  const { mutate: logSend, isPending } = useMutation({
    mutationFn: async ({
      key,
      nextActionAt,
    }: {
      key: TemplateKey;
      nextActionAt: Date;
    }) => {
      const now = new Date().toISOString();
      await dataProvider.create("deal_notes", {
        data: {
          deal_id: deal.id,
          text: `WhatsApp: ${key}`,
          date: now,
          sales_id: identity?.id,
        },
      });
      await dataProvider.update<Deal>("deals", {
        id: deal.id,
        data: {
          next_action_at: nextActionAt.toISOString(),
          ...(deal.first_response_at ? {} : { first_response_at: now }),
        },
        previousData: deal,
      });
    },
    onSuccess: () => {
      setStep({ kind: "idle" });
      notify("WhatsApp message logged.", { type: "success" });
      refresh();
    },
    onError: () => {
      notify("Could not log the WhatsApp message. Please try again.", {
        type: "error",
      });
    },
  });

  const handleLinkSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step.kind !== "link") return;
    const link = String(
      new FormData(event.currentTarget).get("payment_link") ?? "",
    ).trim();
    if (!PAYMENT_LINK_PATTERN.test(link)) {
      notify("Paste the Razorpay payment link (it starts with https://).", {
        type: "warning",
      });
      return;
    }
    openWhatsApp(step.key, link);
  };

  const handleSentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step.kind !== "sent") return;
    const nextActionAt = fromIstInputValue(step.followUp);
    if (!nextActionAt) {
      notify("Choose the next follow-up date and time.", { type: "warning" });
      return;
    }
    logSend({ key: step.key, nextActionAt });
  };

  const close = () => setStep({ kind: "idle" });

  return (
    <div className="flex flex-col items-start gap-1">
      {keys.length === 1 ? (
        <Button
          size="sm"
          variant="outline"
          className="flex items-center gap-2 h-9"
          disabled={isDisabled}
          aria-describedby={reason ? reasonId : undefined}
          onClick={() => pick(keys[0])}
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp: {TEMPLATES[keys[0]].label}
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={isDisabled}
            aria-describedby={reason ? reasonId : undefined}
            render={
              <Button
                size="sm"
                variant="outline"
                className="flex items-center gap-2 h-9"
              />
            }
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
            <ChevronDown className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {keys.map((key) => (
              <DropdownMenuItem key={key} onClick={() => pick(key)}>
                {TEMPLATES[key].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {reason ? (
        <p id={reasonId} className="text-xs text-muted-foreground">
          {reason}
        </p>
      ) : null}

      <Dialog
        open={step.kind !== "idle"}
        onOpenChange={(open) => !open && close()}
      >
        <DialogContent>
          {step.kind === "link" ? (
            <form onSubmit={handleLinkSubmit} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>{TEMPLATES[step.key].label}</DialogTitle>
                <DialogDescription>
                  Paste the Razorpay payment link to send with the message.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${reasonId}-link`}>
                  Razorpay payment link
                </Label>
                <Input
                  id={`${reasonId}-link`}
                  name="payment_link"
                  type="url"
                  required
                  placeholder="https://rzp.io/..."
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit">Open WhatsApp</Button>
              </DialogFooter>
            </form>
          ) : null}
          {step.kind === "sent" ? (
            <form onSubmit={handleSentSubmit} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Sent?</DialogTitle>
                <DialogDescription>
                  Log the "{TEMPLATES[step.key].label}" message and set the next
                  follow-up.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${reasonId}-follow-up`}>
                  Next follow-up (IST)
                </Label>
                <Input
                  id={`${reasonId}-follow-up`}
                  type="datetime-local"
                  required
                  value={step.followUp}
                  onChange={(event) =>
                    setStep({ ...step, followUp: event.target.value })
                  }
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close}>
                  Not sent
                </Button>
                <Button type="submit" disabled={isPending}>
                  Yes, sent
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};
