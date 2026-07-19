import type { BiasCondition, NoiseMethod, TemperatureCategory } from "./types";

export const NOT_REPORTED = "Not reported";

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "-": "⁻",
  "+": "⁺",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

export const NOISE_METHOD_LABELS: Record<NoiseMethod, string> = {
  measured_noise: "Measured noise",
  shot_noise_approximation: "Shot-noise approximation",
  calculated_shot_and_thermal_noise: "Calculated shot and thermal noise",
  nep_from_minimum_detectable_power: "NEP from minimum detectable power",
  unspecified: "Unspecified",
};

export const TEMPERATURE_LABELS: Record<TemperatureCategory, string> = {
  below_room_temperature: "Below room-temperature band (<273 K)",
  room_temperature: "Room-temperature band (273–323 K)",
  elevated: "Elevated (>323 K)",
  not_reported: "Not reported",
};

export const BIAS_LABELS: Record<BiasCondition, string> = {
  zero_bias: "Zero bias",
  nonzero_bias: "Applied bias",
  not_reported: "Not reported",
};

export const AMBER_REASON_LABELS: Record<string, string> = {
  shot_noise_approximation:
    "Detectivity was calculated using a shot-noise approximation rather than a measured total-noise spectrum.",
  above_blip_limit:
    "The reported detectivity appears substantially above a plausible BLIP limit and warrants manual review.",
};

function superscript(value: number): string {
  return String(value)
    .split("")
    .map((character) => SUPERSCRIPT_DIGITS[character] ?? character)
    .join("");
}

/** Format a finite number with a consistent, human-readable scientific style. */
export function formatScientific(
  value: number | null | undefined,
  fractionDigits = 2,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return NOT_REPORTED;
  }
  if (value === 0) return (0).toFixed(fractionDigits);

  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / 10 ** exponent;
  return `${mantissa.toFixed(fractionDigits)} × 10${superscript(exponent)}`;
}

export function formatCompactScientific(
  value: number | null | undefined,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return NOT_REPORTED;
  }
  return value.toExponential(1).replace("e+", "e");
}

export function formatNumber(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return NOT_REPORTED;
  }
  return new Intl.NumberFormat("en-US", options).format(value);
}

export function formatWithUnit(
  value: number | null | undefined,
  unit: string,
  options?: Intl.NumberFormatOptions,
): string {
  const formatted = formatNumber(value, options);
  return formatted === NOT_REPORTED ? formatted : `${formatted} ${unit}`;
}

export function formatNoiseMethod(method: NoiseMethod): string {
  return NOISE_METHOD_LABELS[method] ?? humanizeCode(method);
}

export function humanizeCode(code: string): string {
  const words = code.trim().replaceAll("_", " ").replaceAll("-", " ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : NOT_REPORTED;
}

export function formatAmberReason(reason: string): string {
  return AMBER_REASON_LABELS[reason] ?? humanizeCode(reason);
}

export function formatAuthors(authors: readonly string[]): string {
  return authors.length ? authors.join(", ") : NOT_REPORTED;
}

export function doiLink(doi: string | null): string | null {
  if (!doi) return null;
  const normalizedDoi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  return `https://doi.org/${normalizedDoi}`;
}

export interface PublicationLinks {
  doiUrl: string | null;
  sourceUrl: string | null;
}

/** Keep DOI resolution and an explicitly curated source URL distinguishable. */
export function publicationLinks(
  doi: string | null,
  publicationUrl: string | null,
): PublicationLinks {
  return {
    doiUrl: doiLink(doi),
    sourceUrl: publicationUrl,
  };
}

/** @deprecated Prefer publicationLinks when the UI needs an accurate label. */
export function publicationLink(
  doi: string | null,
  publicationUrl: string | null,
): string | null {
  return publicationUrl ?? doiLink(doi);
}
