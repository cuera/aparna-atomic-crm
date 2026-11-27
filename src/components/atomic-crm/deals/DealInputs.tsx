import { required, useTranslate, type Validator } from "ra-core";
import { useWatch } from "react-hook-form";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import { ReferenceArrayInput } from "@/components/admin/reference-array-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { NumberInput } from "@/components/admin/number-input";
import { DateInput } from "@/components/admin/date-input";
import { DateTimeInput } from "@/components/admin/date-time-input";
import { SelectInput } from "@/components/admin/select-input";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { AutocompleteCompanyInput } from "../companies/AutocompleteCompanyInput.tsx";
import { AutocompleteContactInput } from "../contacts/AutocompleteContactInput.tsx";
import type { Deal } from "../types";
import { validateClosingDate } from "./dealUtils";

// The database check deals_open_needs_next_action closes exactly these stages (MVP.md section 4)
const CLOSED_STAGES = ["enrolled", "lost"];

// eslint-disable-next-line react-refresh/only-export-components -- shared admission rule, used by the board, the forms and quick-add
export const isOpenStage = (stage: string | undefined) =>
  !!stage && !CLOSED_STAGES.includes(stage);

const isBlank = (value: unknown) =>
  value == null || (typeof value === "string" && value.trim() === "");

// Required only while the form's stage matches: the same rule serves the edit form and the board prompt
const requiredWhenStage =
  (matches: (stage: string | undefined) => boolean): Validator =>
  (value, values) =>
    matches(values?.stage) && isBlank(value)
      ? "ra.validation.required"
      : undefined;

const FEE_PERIODS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

// The form shows rupees; the database stores paise (bigint, never floats)
const formatPaise = (paise: number | null | undefined) =>
  paise == null ? "" : String(paise / 100);
const parseRupees = (rupees: string) =>
  rupees === "" || rupees == null ? null : Math.round(Number(rupees) * 100);
const validateFeeAmount: Validator = (value) =>
  value != null && !(Number.isFinite(value) && value >= 0)
    ? "Enter an amount of 0 or more"
    : undefined;

/** The hidden admission name follows the child's name (the DB trigger does the same). */
// eslint-disable-next-line react-refresh/only-export-components -- shared admission rule, used by the board, the forms and quick-add
export const transformAdmission = <T extends Partial<Deal>>(data: T): T => ({
  ...data,
  name: data.child_name?.trim() || data.name,
});

export const DealInputs = () => {
  const isMobile = useIsMobile();
  return (
    <div className="flex flex-col gap-10 p-1">
      <ChildInputs />

      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <DealLinkedToInputs />
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <DealMiscInputs />
      </div>
    </div>
  );
};

export const ChildInputs = ({
  descriptionLabel,
}: {
  descriptionLabel?: string;
}) => {
  const { boards, courses, sources } = useConfigurationContext();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <TextInput
        source="child_name"
        label="Child name"
        validate={required()}
        helperText={false}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextInput source="child_grade" label="Grade" helperText={false} />
        <SelectInput
          source="board"
          label="Board"
          choices={boards}
          optionText="label"
          optionValue="value"
          helperText={false}
        />
        <SelectInput
          source="course"
          label="Course"
          choices={courses}
          optionText="label"
          optionValue="value"
          helperText={false}
        />
        <SelectInput
          source="source"
          label="Source"
          choices={sources}
          optionText="label"
          optionValue="value"
          helperText={false}
        />
      </div>
      <TextInput
        source="description"
        label={descriptionLabel}
        multiline
        rows={3}
        helperText={false}
      />
    </div>
  );
};

const DealLinkedToInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <h6 className="text-lg font-semibold">
        {translate("resources.deals.inputs.linked_to")}
      </h6>
      <ReferenceInput source="company_id" reference="companies">
        <AutocompleteCompanyInput
          label="resources.deals.fields.company_id"
          modal
        />
      </ReferenceInput>

      <ReferenceArrayInput source="contact_ids" reference="contacts_summary">
        <AutocompleteContactInput label="resources.deals.fields.contact_ids" />
      </ReferenceArrayInput>
    </div>
  );
};

const DealMiscInputs = () => {
  const { dealStages, dealCategories } = useConfigurationContext();
  const translate = useTranslate();
  const stage = useWatch({ name: "stage" });
  return (
    <div className="flex flex-col gap-4 flex-1">
      <h6 className="text-lg font-semibold">
        {translate("resources.deals.field_categories.misc")}
      </h6>

      <SelectInput
        source="stage"
        choices={dealStages}
        optionText="label"
        optionValue="value"
        defaultValue="enquiry"
        helperText={false}
        validate={required()}
      />
      <NextActionInput />
      {stage === "lost" && <LostReasonInput />}
      <TrialAtInput />
      <FeeInputs />

      <AutocompleteArrayInput
        source="categories"
        choices={dealCategories}
        optionText="label"
        optionValue="value"
        helperText={false}
      />
      <NumberInput
        source="amount"
        defaultValue={0}
        helperText={false}
        validate={required()}
      />
      <DateInput
        validate={validateClosingDate}
        source="expected_closing_date"
        helperText={false}
      />
    </div>
  );
};

export const NextActionInput = () => (
  <DateTimeInput
    source="next_action_at"
    label="Next action"
    validate={requiredWhenStage(isOpenStage)}
    helperText={false}
  />
);

export const LostReasonInput = () => {
  const { lostReasons } = useConfigurationContext();
  return (
    <SelectInput
      source="lost_reason"
      label="Lost reason"
      choices={lostReasons}
      optionText="label"
      optionValue="value"
      validate={requiredWhenStage((stage) => stage === "lost")}
      helperText={false}
    />
  );
};

export const TrialAtInput = () => (
  <DateTimeInput
    source="trial_at"
    label="Trial at"
    validate={requiredWhenStage((stage) => stage === "trial_booked")}
    helperText={false}
  />
);

const requiredWhenEnrolled = requiredWhenStage((stage) => stage === "enrolled");

export const FeeInputs = () => (
  <>
    <TextInput
      source="fee_amount_paise"
      label="Fee amount (₹)"
      type="number"
      min={0}
      step="any"
      format={formatPaise}
      parse={parseRupees}
      validate={[requiredWhenEnrolled, validateFeeAmount]}
      helperText={false}
    />
    <SelectInput
      source="fee_period"
      label="Fee period"
      choices={FEE_PERIODS}
      optionText="label"
      optionValue="value"
      validate={requiredWhenEnrolled}
      helperText={false}
    />
    <DateInput
      source="next_fee_due"
      label="Next fee due"
      validate={requiredWhenEnrolled}
      helperText={false}
    />
  </>
);
