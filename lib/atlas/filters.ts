import type {
  AtlasFilterState,
  AtlasRecord,
  BiasCondition,
  NoiseMethod,
  PublicationFilter,
  PublicFlag,
  TemperatureCategory,
} from "./types";
import { biasCondition, temperatureCategory } from "../data/filter.ts";
import { NOISE_METHODS } from "./types.ts";

export { biasCondition, temperatureCategory };

export const DEFAULT_ATLAS_FILTERS: AtlasFilterState = {
  search: "",
  material: "all",
  wavelengthMin: undefined,
  wavelengthMax: undefined,
  year: undefined,
  temperature: "all",
  bias: "all",
  noiseMethod: "all",
  flag: "all",
  publicationType: "all",
};

const TEMPERATURE_CATEGORIES: readonly TemperatureCategory[] = [
  "below_room_temperature",
  "room_temperature",
  "elevated",
  "not_reported",
];
const BIAS_CONDITIONS: readonly BiasCondition[] = [
  "zero_bias",
  "nonzero_bias",
  "not_reported",
];
const FLAGS: readonly PublicFlag[] = ["green", "amber"];
const PUBLICATION_FILTERS: readonly PublicationFilter[] = [
  "peer_reviewed",
  "preprint",
  "demonstration",
];

function finiteNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function oneOf<T extends string>(
  value: string | null,
  values: readonly T[],
  fallback: T | "all" = "all",
): T | "all" {
  return value !== null && values.includes(value as T)
    ? (value as T)
    : fallback;
}

export function publicationCategory(record: AtlasRecord): PublicationFilter {
  const publicationType = record.paper.publicationType.toLowerCase();
  if (publicationType === "demonstration") return "demonstration";
  return !record.paper.peerReviewed || publicationType.includes("preprint")
    ? "preprint"
    : "peer_reviewed";
}

function searchableText(record: AtlasRecord): string {
  return [
    record.measurement.measurementId,
    record.device.materialFamily,
    record.device.materialComposition,
    record.device.deviceArchitecture,
    record.device.deviceStack,
    record.paper.title,
    record.paper.firstAuthor,
    ...record.paper.authors,
    record.paper.journal,
    record.paper.doi,
    record.paper.publicationUrl,
    record.paper.publicationYear,
  ]
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLocaleLowerCase();
}

export function recordMatchesFilters(
  record: AtlasRecord,
  filters: AtlasFilterState,
): boolean {
  const query = filters.search.trim().toLocaleLowerCase();
  if (query && !searchableText(record).includes(query)) return false;
  if (
    filters.material !== "all" &&
    record.device.materialFamily !== filters.material
  ) {
    return false;
  }
  if (
    filters.wavelengthMin !== undefined &&
    record.measurement.wavelengthNm < filters.wavelengthMin
  ) {
    return false;
  }
  if (
    filters.wavelengthMax !== undefined &&
    record.measurement.wavelengthNm > filters.wavelengthMax
  ) {
    return false;
  }
  if (
    filters.year !== undefined &&
    record.paper.publicationYear !== filters.year
  ) {
    return false;
  }
  if (
    filters.temperature !== "all" &&
    temperatureCategory(record.measurement.temperatureK) !== filters.temperature
  ) {
    return false;
  }
  if (
    filters.bias !== "all" &&
    biasCondition(record.measurement.biasV) !== filters.bias
  ) {
    return false;
  }
  if (
    filters.noiseMethod !== "all" &&
    record.measurement.noiseMethod !== filters.noiseMethod
  ) {
    return false;
  }
  if (filters.flag !== "all" && record.measurement.flag !== filters.flag) {
    return false;
  }
  if (
    filters.publicationType !== "all" &&
    publicationCategory(record) !== filters.publicationType
  ) {
    return false;
  }
  return true;
}

export function filterAtlasRecords(
  records: readonly AtlasRecord[],
  filters: AtlasFilterState,
): AtlasRecord[] {
  return records.filter((record) => recordMatchesFilters(record, filters));
}

/** Keep a material-route explorer constrained even if its query says otherwise. */
export function lockMaterialFilter(
  filters: AtlasFilterState,
  material?: string,
): AtlasFilterState {
  return material ? { ...filters, material } : filters;
}

export function parseAtlasFilters(
  params: URLSearchParams | Readonly<URLSearchParams>,
): AtlasFilterState {
  const year = finiteNumber(params.get("year"));
  return {
    search: params.get("q")?.trim() ?? "",
    material: params.get("material")?.trim() || "all",
    wavelengthMin: finiteNumber(params.get("wavelengthMin")),
    wavelengthMax: finiteNumber(params.get("wavelengthMax")),
    year: year === undefined ? undefined : Math.trunc(year),
    temperature:
      params.get("temperature") === "cryogenic"
        ? "below_room_temperature"
        : oneOf(params.get("temperature"), TEMPERATURE_CATEGORIES),
    bias:
      params.get("bias") === "biased"
        ? "nonzero_bias"
        : oneOf(params.get("bias"), BIAS_CONDITIONS),
    noiseMethod: oneOf(params.get("noise"), NOISE_METHODS) as
      NoiseMethod | "all",
    flag: oneOf(params.get("flag"), FLAGS),
    publicationType: oneOf(params.get("publication"), PUBLICATION_FILTERS),
  };
}

function setOrDelete(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined,
): void {
  if (value === undefined || value === "" || value === "all") {
    params.delete(key);
  } else {
    params.set(key, String(value));
  }
}

/**
 * Merge filter state into a URL query while preserving unrelated parameters.
 */
export function serializeAtlasFilters(
  filters: AtlasFilterState,
  existing: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const params = new URLSearchParams(existing);
  setOrDelete(params, "q", filters.search.trim());
  setOrDelete(params, "material", filters.material);
  setOrDelete(params, "wavelengthMin", filters.wavelengthMin);
  setOrDelete(params, "wavelengthMax", filters.wavelengthMax);
  setOrDelete(params, "year", filters.year);
  setOrDelete(params, "temperature", filters.temperature);
  setOrDelete(params, "bias", filters.bias);
  setOrDelete(params, "noise", filters.noiseMethod);
  setOrDelete(params, "flag", filters.flag);
  setOrDelete(params, "publication", filters.publicationType);
  return params;
}

export function countActiveFilters(filters: AtlasFilterState): number {
  return (
    Number(Boolean(filters.search.trim())) +
    Number(filters.material !== "all") +
    Number(filters.wavelengthMin !== undefined) +
    Number(filters.wavelengthMax !== undefined) +
    Number(filters.year !== undefined) +
    Number(filters.temperature !== "all") +
    Number(filters.bias !== "all") +
    Number(filters.noiseMethod !== "all") +
    Number(filters.flag !== "all") +
    Number(filters.publicationType !== "all")
  );
}

export function materialOptions(records: readonly AtlasRecord[]): string[] {
  return [...new Set(records.map((record) => record.device.materialFamily))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

export function yearOptions(records: readonly AtlasRecord[]): number[] {
  return [
    ...new Set(
      records
        .map((record) => record.paper.publicationYear)
        .filter(Number.isFinite),
    ),
  ].sort((left, right) => right - left);
}
