import type {
  AtlasFilterState,
  AtlasMetricKey,
  AtlasPlotMode,
  AtlasPlotScope,
  AtlasRecord,
  AtlasTableView,
  BiasCondition,
  ExtendedReviewFilter,
  NoiseMethod,
  PublicationFilter,
  PublicFlag,
  TemperatureCategory,
} from "./types";
import { biasCondition, temperatureCategory } from "../data/filter.ts";
import { hasAmbiguousExtendedMetric, hasTemporalMetric } from "./metrics.ts";
import {
  ATLAS_METRIC_KEYS,
  ATLAS_PLOT_MODES,
  ATLAS_PLOT_SCOPES,
  ATLAS_TABLE_VIEWS,
  NOISE_METHODS,
} from "./types.ts";

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
  hasResponsivity: false,
  hasEqe: false,
  hasTemporal: false,
  hasRiseTime: false,
  hasFallTime: false,
  hasBandwidth: false,
  hasLdr: false,
  extendedReview: "all",
  ambiguousExtraction: false,
  responsivityMin: undefined,
  eqeMin: undefined,
  responseTimeMaxS: undefined,
  riseTimeMaxS: undefined,
  fallTimeMaxS: undefined,
  bandwidthMinHz: undefined,
  ldrMinDb: undefined,
  plotMode: "performance_map",
  plotX: "wavelength",
  plotY: "detectivity",
  plotScope: "paper_maxima",
  tableView: "overview",
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

function nonnegativeNumber(value: string | null): number | undefined {
  const parsed = finiteNumber(value);
  return parsed !== undefined && parsed >= 0 ? parsed : undefined;
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

function selectedValue<T extends string>(
  value: string | null,
  values: readonly T[],
  fallback: T,
): T {
  return value !== null && values.includes(value as T)
    ? (value as T)
    : fallback;
}

function enabled(
  params: URLSearchParams | Readonly<URLSearchParams>,
  key: string,
) {
  return params.get(key) === "1";
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
  const measurement = record.measurement;
  if (filters.hasResponsivity && measurement.responsivityAW === null)
    return false;
  if (filters.hasEqe && measurement.eqePercent === null) return false;
  if (filters.hasTemporal && !hasTemporalMetric(record)) return false;
  if (filters.hasRiseTime && measurement.riseTimeS === null) return false;
  if (filters.hasFallTime && measurement.fallTimeS === null) return false;
  if (filters.hasBandwidth && measurement.bandwidthHz === null) return false;
  if (
    filters.hasLdr &&
    measurement.linearDynamicRangeDb === null &&
    measurement.linearDynamicRangeMin === null &&
    measurement.linearDynamicRangeMax === null
  ) {
    return false;
  }
  if (
    filters.extendedReview !== "all" &&
    measurement.extendedMetricsReviewStatus !== filters.extendedReview
  ) {
    return false;
  }
  if (filters.ambiguousExtraction && !hasAmbiguousExtendedMetric(record))
    return false;
  if (
    filters.responsivityMin !== undefined &&
    (measurement.responsivityAW === null ||
      measurement.responsivityAW < filters.responsivityMin)
  ) {
    return false;
  }
  if (
    filters.eqeMin !== undefined &&
    (measurement.eqePercent === null || measurement.eqePercent < filters.eqeMin)
  ) {
    return false;
  }
  if (
    filters.responseTimeMaxS !== undefined &&
    (measurement.responseTimeS === null ||
      measurement.responseTimeS > filters.responseTimeMaxS)
  ) {
    return false;
  }
  if (
    filters.riseTimeMaxS !== undefined &&
    (measurement.riseTimeS === null ||
      measurement.riseTimeS > filters.riseTimeMaxS)
  ) {
    return false;
  }
  if (
    filters.fallTimeMaxS !== undefined &&
    (measurement.fallTimeS === null ||
      measurement.fallTimeS > filters.fallTimeMaxS)
  ) {
    return false;
  }
  if (
    filters.bandwidthMinHz !== undefined &&
    (measurement.bandwidthHz === null ||
      measurement.bandwidthHz < filters.bandwidthMinHz)
  ) {
    return false;
  }
  if (
    filters.ldrMinDb !== undefined &&
    (measurement.linearDynamicRangeDb === null ||
      measurement.linearDynamicRangeDb < filters.ldrMinDb)
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

/** Convert a user-facing threshold into the normalized units stored in data. */
export function normalizeMetricFilterValue(
  displayValue: number,
  displayScale: number,
): number | undefined {
  if (
    !Number.isFinite(displayValue) ||
    displayValue < 0 ||
    !Number.isFinite(displayScale) ||
    displayScale <= 0
  ) {
    return undefined;
  }
  return displayValue / displayScale;
}

/** Clear advanced metric constraints without changing the current view. */
export function clearMetricFilters(
  filters: AtlasFilterState,
): AtlasFilterState {
  return {
    ...filters,
    hasResponsivity: false,
    hasEqe: false,
    hasTemporal: false,
    hasRiseTime: false,
    hasFallTime: false,
    hasBandwidth: false,
    hasLdr: false,
    extendedReview: "all",
    ambiguousExtraction: false,
    responsivityMin: undefined,
    eqeMin: undefined,
    responseTimeMaxS: undefined,
    riseTimeMaxS: undefined,
    fallTimeMaxS: undefined,
    bandwidthMinHz: undefined,
    ldrMinDb: undefined,
  };
}

/** Reset filtering criteria while retaining graph and table view choices. */
export function resetAtlasFilterCriteria(
  current: AtlasFilterState,
  base: AtlasFilterState = DEFAULT_ATLAS_FILTERS,
): AtlasFilterState {
  return {
    ...base,
    plotMode: current.plotMode,
    plotX: current.plotX,
    plotY: current.plotY,
    plotScope: current.plotScope,
    tableView: current.tableView,
  };
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
  const plotX = selectedValue(
    params.get("xMetric"),
    ATLAS_METRIC_KEYS,
    "wavelength",
  ) as AtlasMetricKey;
  let plotY = selectedValue(
    params.get("yMetric"),
    ATLAS_METRIC_KEYS,
    "detectivity",
  ) as AtlasMetricKey;
  if (plotX === plotY)
    plotY = plotX === "detectivity" ? "wavelength" : "detectivity";
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
    hasResponsivity: enabled(params, "hasResponsivity"),
    hasEqe: enabled(params, "hasEqe"),
    hasTemporal: enabled(params, "hasTemporal"),
    hasRiseTime: enabled(params, "hasRise"),
    hasFallTime: enabled(params, "hasFall"),
    hasBandwidth: enabled(params, "hasBandwidth"),
    hasLdr: enabled(params, "hasLdr"),
    extendedReview: selectedValue(
      params.get("extendedReview"),
      ["all", "checked", "source_unavailable"] as const,
      "all",
    ) as ExtendedReviewFilter,
    ambiguousExtraction: enabled(params, "ambiguous"),
    responsivityMin: nonnegativeNumber(
      params.get("responsivityMinAW") ?? params.get("responsivityMin"),
    ),
    eqeMin: nonnegativeNumber(
      params.get("eqeMinPercent") ?? params.get("eqeMin"),
    ),
    responseTimeMaxS: nonnegativeNumber(params.get("responseMaxS")),
    riseTimeMaxS: nonnegativeNumber(params.get("riseMaxS")),
    fallTimeMaxS: nonnegativeNumber(params.get("fallMaxS")),
    bandwidthMinHz: nonnegativeNumber(params.get("bandwidthMinHz")),
    ldrMinDb: nonnegativeNumber(params.get("ldrMinDb")),
    plotMode: selectedValue(
      params.get("plot"),
      ATLAS_PLOT_MODES,
      "performance_map",
    ) as AtlasPlotMode,
    plotX,
    plotY,
    plotScope: selectedValue(
      params.get("scope"),
      ATLAS_PLOT_SCOPES,
      "paper_maxima",
    ) as AtlasPlotScope,
    tableView: selectedValue(
      params.get("table"),
      ATLAS_TABLE_VIEWS,
      "overview",
    ) as AtlasTableView,
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

function setBoolean(
  params: URLSearchParams,
  key: string,
  value: boolean,
): void {
  if (value) params.set(key, "1");
  else params.delete(key);
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
  setBoolean(params, "hasResponsivity", filters.hasResponsivity);
  setBoolean(params, "hasEqe", filters.hasEqe);
  setBoolean(params, "hasTemporal", filters.hasTemporal);
  setBoolean(params, "hasRise", filters.hasRiseTime);
  setBoolean(params, "hasFall", filters.hasFallTime);
  setBoolean(params, "hasBandwidth", filters.hasBandwidth);
  setBoolean(params, "hasLdr", filters.hasLdr);
  setOrDelete(params, "extendedReview", filters.extendedReview);
  setBoolean(params, "ambiguous", filters.ambiguousExtraction);
  params.delete("responsivityMin");
  params.delete("eqeMin");
  setOrDelete(params, "responsivityMinAW", filters.responsivityMin);
  setOrDelete(params, "eqeMinPercent", filters.eqeMin);
  setOrDelete(params, "responseMaxS", filters.responseTimeMaxS);
  setOrDelete(params, "riseMaxS", filters.riseTimeMaxS);
  setOrDelete(params, "fallMaxS", filters.fallTimeMaxS);
  setOrDelete(params, "bandwidthMinHz", filters.bandwidthMinHz);
  setOrDelete(params, "ldrMinDb", filters.ldrMinDb);
  setOrDelete(
    params,
    "plot",
    filters.plotMode === "performance_map" ? undefined : filters.plotMode,
  );
  setOrDelete(
    params,
    "xMetric",
    filters.plotX === "wavelength" ? undefined : filters.plotX,
  );
  setOrDelete(
    params,
    "yMetric",
    filters.plotY === "detectivity" ? undefined : filters.plotY,
  );
  setOrDelete(
    params,
    "scope",
    filters.plotScope === "paper_maxima" ? undefined : filters.plotScope,
  );
  setOrDelete(
    params,
    "table",
    filters.tableView === "overview" ? undefined : filters.tableView,
  );
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
    Number(filters.publicationType !== "all") +
    Number(filters.hasResponsivity) +
    Number(filters.hasEqe) +
    Number(filters.hasTemporal) +
    Number(filters.hasRiseTime) +
    Number(filters.hasFallTime) +
    Number(filters.hasBandwidth) +
    Number(filters.hasLdr) +
    Number(filters.extendedReview !== "all") +
    Number(filters.ambiguousExtraction) +
    Number(filters.responsivityMin !== undefined) +
    Number(filters.eqeMin !== undefined) +
    Number(filters.responseTimeMaxS !== undefined) +
    Number(filters.riseTimeMaxS !== undefined) +
    Number(filters.fallTimeMaxS !== undefined) +
    Number(filters.bandwidthMinHz !== undefined) +
    Number(filters.ldrMinDb !== undefined)
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
