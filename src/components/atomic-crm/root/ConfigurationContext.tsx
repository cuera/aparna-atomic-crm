import { useMemo } from "react";
import { useStore } from "ra-core";

import type { DealStage, LabeledValue, NoteStatus } from "../types";
import { defaultConfiguration } from "./defaultConfiguration";

export const CONFIGURATION_STORE_KEY = "app.configuration";

export interface ConfigurationContextValue {
  companySectors: LabeledValue[];
  currency: string;
  dealCategories: LabeledValue[];
  dealPipelineStatuses: string[];
  dealStages: DealStage[];
  noteStatuses: NoteStatus[];
  taskTypes: LabeledValue[];
  title: string;
  darkModeLogo: string;
  lightModeLogo: string;
  // MVP keys (M-101). Optional in a stored configuration (one saved before M1 lacks them);
  // useConfigurationContext always returns them, filled from the defaults.
  courses?: LabeledValue[];
  boards?: LabeledValue[];
  sources?: LabeledValue[];
  lostReasons?: LabeledValue[];
}

export const useConfigurationContext =
  (): Required<ConfigurationContextValue> => {
    const [config] = useStore<ConfigurationContextValue>(
      CONFIGURATION_STORE_KEY,
      defaultConfiguration,
    );
    // Merge with defaults so that missing fields in stored config
    // fall back to default values (e.g. when new settings are added)
    return useMemo(() => ({ ...defaultConfiguration, ...config }), [config]);
  };

export const useConfigurationUpdater = () => {
  const [, setConfig] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
  );
  return setConfig;
};
