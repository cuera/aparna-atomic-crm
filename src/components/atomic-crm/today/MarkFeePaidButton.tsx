import { useMutation } from "@tanstack/react-query";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import { useState } from "react";
import { IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { CrmDataProvider } from "../providers/types";
import type { Deal } from "../types";
import { formatDateKey, formatPaise } from "../whatsapp/templates";

interface MarkFeePaidButtonProps {
  /** The admission as shown on screen: its next_fee_due is the compare-and-set value. */
  deal: Pick<Deal, "id" | "next_fee_due" | "fee_amount_paise" | "child_name">;
}

/** M-305: marks the shown fee as paid through mark_fee_paid (compare-and-set, M-109). */
export const MarkFeePaidButton = ({ deal }: MarkFeePaidButtonProps) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const shownDue = deal.next_fee_due;

  const { mutate, isPending } = useMutation({
    mutationFn: (due: string) => dataProvider.markFeePaid(deal.id, due),
    onSuccess: (applied) => {
      setOpen(false);
      refresh();
      if (applied) {
        notify("Fee marked as paid.", { type: "success" });
      } else {
        notify(
          "This fee was already marked as paid. The screen is now up to date.",
          { type: "warning" },
        );
      }
    },
    onError: () => {
      notify("Could not mark the fee as paid. Please try again.", {
        type: "error",
      });
    },
  });

  if (!shownDue) return null;

  const amount =
    deal.fee_amount_paise != null ? formatPaise(deal.fee_amount_paise) : null;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="flex items-center gap-2 h-9"
        onClick={() => setOpen(true)}
      >
        <IndianRupee className="w-4 h-4" />
        Mark fee paid
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark fee paid?</DialogTitle>
            <DialogDescription>
              {amount ? `${amount} ` : "The fee "}due on{" "}
              {formatDateKey(shownDue)}
              {deal.child_name ? ` for ${deal.child_name}` : ""}. The next due
              date moves forward by one fee period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={isPending} onClick={() => mutate(shownDue)}>
              Yes, mark paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
