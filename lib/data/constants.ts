import type {
  AmberReason,
  DetectivityExtractionMethod,
  NoiseMethod,
  PublicationType,
} from "./types.ts";

export const DEMONSTRATION_NOTICE =
  "Demonstration data—not a literature record" as const;

export const NOISE_METHOD_LABELS: Record<NoiseMethod, string> = {
  measured_noise: "Measured noise",
  shot_noise_approximation: "Shot-noise estimate",
  calculated_shot_and_thermal_noise: "Calculated shot and thermal noise",
  nep_from_minimum_detectable_power: "NEP from minimum detectable power",
  unspecified: "Noise method not specified",
};

/** True only when a source explicitly reports experimentally measured noise. */
export function isMeasuredNoiseMethod(method: NoiseMethod): boolean {
  return method === "measured_noise";
}

export const PUBLICATION_TYPE_LABELS: Record<PublicationType, string> = {
  journal_article: "Peer-reviewed paper",
  preprint: "Preprint",
  demonstration: "Demonstration record",
};

export const DETECTIVITY_EXTRACTION_METHOD_LABELS: Record<
  DetectivityExtractionMethod,
  string
> = {
  directly_reported: "Directly reported",
  calculated_from_reported_values: "Calculated from reported values",
  graphically_extracted: "Estimated from a graph",
  unspecified: "Not specified",
};

export interface AmberReasonDetail {
  label: string;
  explanation: string;
}

export const AMBER_REASON_DETAILS: Record<AmberReason, AmberReasonDetail> = {
  shot_noise_approximation: {
    label: "Shot-noise estimate",
    explanation:
      "Detectivity was calculated using a shot-noise approximation rather than a measured total-noise spectrum.",
  },
  calculated_noise: {
    label: "Calculated noise",
    explanation:
      "Noise was calculated from shot- and thermal-noise terms rather than measured directly.",
  },
  noise_method_unspecified: {
    label: "Noise method unclear",
    explanation: "The publication does not clearly identify the noise method.",
  },
  missing_measurement_frequency: {
    label: "Frequency not reported",
    explanation: "The noise-measurement frequency was not reported.",
  },
  missing_bias: {
    label: "Bias not reported",
    explanation: "The applied bias was not reported.",
  },
  missing_temperature: {
    label: "Temperature not reported",
    explanation: "The operating temperature was not reported.",
  },
  missing_active_area: {
    label: "Active area not reported",
    explanation: "The device active area was not reported.",
  },
  missing_source_location: {
    label: "Source location not reported",
    explanation:
      "The page, figure, table, or supporting-information location was not recorded.",
  },
  estimated_from_graph: {
    label: "Estimated from graph",
    explanation: "The value was estimated from a plotted figure.",
  },
  calculated_from_reported_values: {
    label: "Calculated by curator",
    explanation:
      "Detectivity was calculated from values reported by the publication rather than stated directly.",
  },
  detectivity_extraction_unspecified: {
    label: "Extraction method unclear",
    explanation: "How the detectivity value was obtained is not specified.",
  },
  pending_human_review: {
    label: "Review pending",
    explanation: "The record has not yet received full human-curator review.",
  },
  champion_device: {
    label: "Champion device",
    explanation:
      "The publication identifies this as a champion device, which may affect comparability.",
  },
  incomplete_measurement_conditions: {
    label: "Conditions incomplete",
    explanation: "Important measurement conditions are incomplete or unclear.",
  },
  preprint: {
    label: "Preprint",
    explanation: "The source is a preprint and has not been peer reviewed.",
  },
};

export function amberReasonsToExplanation(
  reasons: readonly AmberReason[],
): string {
  return reasons
    .map((reason) => AMBER_REASON_DETAILS[reason].explanation)
    .join(" ");
}
