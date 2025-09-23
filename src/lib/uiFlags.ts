const truthyValues = new Set(['1', 'true', 'yes', 'on']);

type FeatureKey = 'responses' | 'runs' | 'builder' | 'settings';

type FeatureConfig = Record<FeatureKey, { mode: string; enabled: boolean }>;

function normalize(value?: string | null): string {
  return (value || '').toLowerCase();
}

function isTruthy(value?: string | null): boolean {
  const normalised = normalize(value);
  if (!normalised) return false;
  if (truthyValues.has(normalised)) return true;
  // Accept "mui" as an alias for enabling the React experience to stay consistent with legacy flag usage
  return normalised === 'mui';
}

const modes: FeatureConfig = {
  responses: {
    mode: normalize(process.env.UI_RESPONSES_UI_MODE),
    enabled: normalize(process.env.UI_RESPONSES_UI_MODE) === 'mui',
  },
  runs: {
    mode: normalize(process.env.UI_RUNS_UI_MODE),
    enabled: isTruthy(process.env.UI_RUNS_UI_MODE) || isTruthy(process.env.UI_REACT_RUNS),
  },
  builder: {
    mode: normalize(process.env.UI_BUILDER_UI_MODE),
    enabled: isTruthy(process.env.UI_BUILDER_UI_MODE) || isTruthy(process.env.UI_REACT_BUILDER),
  },
  settings: {
    mode: normalize(process.env.UI_SETTINGS_UI_MODE),
    enabled: isTruthy(process.env.UI_SETTINGS_UI_MODE) || isTruthy(process.env.UI_REACT_SETTINGS),
  },
};

export function useReactUi(feature: FeatureKey): boolean {
  const config = modes[feature];
  return feature === 'responses' ? config.enabled : config.enabled || config.mode === 'mui';
}

export function getUiModes(): FeatureConfig {
  return modes;
}

export const runsReactEnabled = useReactUi('runs');
export const builderReactEnabled = useReactUi('builder');
export const settingsReactEnabled = useReactUi('settings');
export const responsesReactEnabled = useReactUi('responses');

