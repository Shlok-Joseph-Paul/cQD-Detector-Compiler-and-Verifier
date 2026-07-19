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
  lock_in_only_noise_measurement: {
    label: "Lock-in-only noise measurement",
    explanation:
      "Noise was acquired using only a lock-in amplifier, which warrants caution when comparing the reported detectivity with full-spectrum noise measurements.",
  },
  source_measure_unit_noise_measurement: {
    label: "Source-measure-unit noise measurement",
    explanation:
      "Noise was acquired using a source measure unit or parameter analyzer rather than a dedicated noise-measurement instrument.",
  },
  above_blip_limit: {
    label: "Potentially above the BLIP limit",
    explanation:
      "The reported detectivity appears substantially above a plausible background-limited infrared photodetection limit and warrants manual review.",
  },
};

export function amberReasonsToExplanation(
  reasons: readonly AmberReason[],
): string {
  return reasons
    .map((reason) => AMBER_REASON_DETAILS[reason].explanation)
    .join(" ");
}
