import type { FrequencyMatchStatus, NoiseMethod } from "./types.ts";

export interface FrequencyMatchInput {
  noiseMethod?: NoiseMethod | null;
  measurementFrequencyHz: number | null | undefined;
  responsivityAW: number | null | undefined;
  responsivityFrequencyHz: number | null | undefined;
  eqePercent: number | null | undefined;
  eqeFrequencyHz: number | null | undefined;
}

function sameFrequency(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= scale * 1e-9;
}

/**
 * Compare only explicitly reported frequencies. Unknown conditions remain
 * unestablished rather than being treated as a mismatch.
 */
export function deriveFrequencyMatchStatus({
  noiseMethod,
  measurementFrequencyHz,
  responsivityAW,
  responsivityFrequencyHz,
  eqePercent,
  eqeFrequencyHz,
}: FrequencyMatchInput): FrequencyMatchStatus {
  if (
    noiseMethod != null &&
    noiseMethod !== "measured_noise" &&
    noiseMethod !== "unspecified"
  ) {
    return "not_applicable";
  }

  const signalFrequency =
    responsivityAW != null
      ? responsivityFrequencyHz
      : eqePercent != null
        ? eqeFrequencyHz
        : undefined;

  if (responsivityAW == null && eqePercent == null) return "not_applicable";
  if (measurementFrequencyHz == null) return "not_established";
  if (signalFrequency == null) return "not_established";
  if (!sameFrequency(signalFrequency, measurementFrequencyHz)) {
    return "not_matched";
  }
  return "matched";
}
