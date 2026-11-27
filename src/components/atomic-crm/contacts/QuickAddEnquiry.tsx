import { useQueryClient } from "@tanstack/react-query";
import {
  Form,
  required,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  type DataProvider,
  type Identifier,
} from "ra-core";
import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Plus } from "lucide-react";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

import { makeRoomAtTopOfStage } from "../deals/DealCreate";
import { ChildInputs, transformAdmission } from "../deals/DealInputs";
import {
  DEFAULT_TIMEZONE,
  normalisePhone,
  timezoneChoices,
  timezoneForCountry,
} from "../misc/phone";
import type { Contact, Deal } from "../types";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

type QuickAddValues = {
  parent_name: string;
  phone: string;
  timezone: string;
  child_name: string;
  child_grade?: string;
  board?: string;
  course?: string;
  source?: string;
  description?: string;
};

const validatePhone = (value: string) => {
  const result = normalisePhone(value);
  return result.ok ? undefined : result.error;
};

const findParentByPhone = async (
  dataProvider: DataProvider,
  e164: string,
): Promise<Contact | undefined> => {
  const { data } = await dataProvider.getList<Contact>("contacts", {
    filter: { "phone_e164@eq": e164 },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  return data[0];
};

const splitName = (fullName: string) => {
  const [first_name, ...rest] = fullName.trim().split(/\s+/);
  return { first_name, last_name: rest.join(" ") };
};

const parentName = (contact: Pick<Contact, "first_name" | "last_name">) =>
  [contact.first_name, contact.last_name].filter(Boolean).join(" ");

/** Board header button (M-202); M4 reuses it on Today. */
export const QuickAddEnquiryButton = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus />
        Quick add enquiry
      </Button>
      {open && <QuickAddEnquiryDialog onClose={() => setOpen(false)} />}
    </>
  );
};

export const QuickAddEnquiryDialog = ({ onClose }: { onClose: () => void }) => {
  const dataProvider = useDataProvider();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { identity } = useGetIdentity();

  const save = async (values: QuickAddValues) => {
    const phone = normalisePhone(values.phone);
    if (!phone.ok) return { phone: phone.error };

    let contactId: Identifier;
    let existing: Contact | undefined;
    try {
      // The number is unique among parents: a known number links the existing parent
      existing = await findParentByPhone(dataProvider, phone.e164);
      if (existing) {
        contactId = existing.id;
      } else {
        const now = new Date().toISOString();
        const { data: contact } = await dataProvider.create<Contact>(
          "contacts",
          {
            data: {
              ...splitName(values.parent_name),
              phone_e164: phone.e164,
              phone_jsonb: [{ number: phone.e164, type: "Home" }],
              email_jsonb: [],
              country: phone.country,
              timezone: values.timezone,
              whatsapp_opt_in: true,
              sales_id: identity?.id,
              first_seen: now,
              last_seen: now,
              tags: [],
            },
          },
        );
        contactId = contact.id;
      }
    } catch (error: unknown) {
      notify(errorMessage(error, "The parent could not be saved"), {
        type: "error",
      });
      return;
    }

    try {
      const { data: deal } = await dataProvider.create<Deal>("deals", {
        data: transformAdmission({
          child_name: values.child_name,
          child_grade: values.child_grade,
          board: values.board,
          course: values.course,
          source: values.source,
          description: values.description,
          stage: "enquiry",
          next_action_at: new Date(Date.now() + TWO_HOURS_MS).toISOString(),
          contact_ids: [contactId],
          sales_id: identity?.id,
          index: 0,
        }),
      });
      const { data: enquiries } = await dataProvider.getList<Deal>("deals", {
        filter: { stage: "enquiry" },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "index", order: "ASC" },
      });
      await makeRoomAtTopOfStage(deal, enquiries, dataProvider, queryClient);
    } catch (error: unknown) {
      // The parent exists now; saving again links it instead of creating a second one
      notify(errorMessage(error, "The enquiry could not be saved"), {
        type: "error",
      });
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["deals"] });
    await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    if (existing) {
      notify(
        `This number already belongs to ${parentName(existing)}: the enquiry was added to that parent`,
        { type: "warning" },
      );
    } else {
      notify("Enquiry added", { type: "success" });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="lg:max-w-2xl overflow-y-auto max-h-9/10">
        <DialogTitle>Quick add enquiry</DialogTitle>
        <Form
          resource="deals"
          defaultValues={{ timezone: DEFAULT_TIMEZONE }}
          onSubmit={(values: Partial<QuickAddValues>) =>
            save(values as QuickAddValues)
          }
        >
          <div className="flex flex-col gap-4">
            <TextInput
              source="parent_name"
              label="Parent name"
              validate={required()}
              helperText={false}
            />
            <TextInput
              source="phone"
              label="WhatsApp number"
              type="tel"
              validate={[required(), validatePhone]}
              helperText={false}
            />
            <PhoneGuess />
            <AutocompleteInput
              source="timezone"
              label="Time zone"
              choices={timezoneChoices()}
              validate={required()}
              helperText={false}
            />
            <ChildInputs descriptionLabel="Note" />
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton />
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

/** Shows the country guessed from the number, sets the time zone from it, and flags a known number. */
const PhoneGuess = () => {
  const phoneInput = useWatch({ name: "phone" });
  const { setValue } = useFormContext();
  const phone = normalisePhone(phoneInput);
  const country = phone.ok ? phone.country : null;
  const e164 = phone.ok ? phone.e164 : null;

  useEffect(() => {
    if (country) {
      setValue("timezone", timezoneForCountry(country), { shouldDirty: true });
    }
  }, [country, setValue]);

  const { data: matches } = useGetList<Contact>(
    "contacts",
    {
      filter: { "phone_e164@eq": e164 },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: !!e164 },
  );
  const existing = e164 ? matches?.[0] : undefined;

  if (!country && !existing) return null;
  return (
    <div className="text-sm flex flex-col gap-1">
      {country && <p className="text-muted-foreground">Country: {country}</p>}
      {existing && (
        <p role="status" className="text-amber-700 dark:text-amber-400">
          This number belongs to {parentName(existing)}. The enquiry will be
          linked to this parent.
        </p>
      )}
    </div>
  );
};

const SubmitButton = () => {
  const {
    formState: { isSubmitting },
  } = useFormContext();
  return (
    <Button type="submit" disabled={isSubmitting}>
      Save
    </Button>
  );
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message
    ? `${fallback}: ${error.message}`
    : fallback;
