import type {
  BiasCondition as CanonicalBiasCondition,
  JoinedMeasurement,
  NoiseInstrument as CanonicalNoiseInstrument,
  TemperatureCategory as CanonicalTemperatureCategory,
} from "@/lib/data/types";

export const NOISE_METHODS = [
  "measured_noise",
  "shot_noise_approximation",
  "calculated_shot_and_thermal_noise",
  "nep_from_minimum_detectable_power",
  "unspecified",
] as const;

export type NoiseMethod = (typeof NOISE_METHODS)[number];
export type NoiseInstrument = CanonicalNoiseInstrument;
export type PublicFlag = "green" | "amber";
export type TemperatureCategory = CanonicalTemperatureCategory;
export type BiasCondition = CanonicalBiasCondition;
export type PublicationFilter = "peer_reviewed" | "preprint" | "demonstration";
export type ExtendedReviewFilter = "all" | "checked" | "source_unavailable";
export type AtlasHistoryMode = "push" | "replace";

export const ATLAS_METRIC_KEYS = [
  "wavelength",
  "detectivity",
  "responsivity",
  "eqe",
  "response_time",
  "rise_time",
  "fall_time",
  "bandwidth",
  "ldr",
] as const;
export type AtlasMetricKey = (typeof ATLAS_METRIC_KEYS)[number];

export const ATLAS_PLOT_MODES = ["performance_map", "compare_metrics"] as const;
export type AtlasPlotMode = (typeof ATLAS_PLOT_MODES)[number];

export const ATLAS_PLOT_SCOPES = ["paper_maxima", "all_measurements"] as const;
export type AtlasPlotScope = (typeof ATLAS_PLOT_SCOPES)[number];

export const ATLAS_TABLE_VIEWS = [
  "overview",
  "optical",
  "speed",
  "methods",
] as const;
export type AtlasTableView = (typeof ATLAS_TABLE_VIEWS)[number];

export interface AtlasPaper {
  paperId: string;
  title: string;
  authors: string[];
  firstAuthor: string;
  journal: string | null;
  publicationYear: number;
  doi: string | null;
  publicationUrl: string | null;
  publicationType: string;
  peerReviewed: boolean;
  notes: string | null;
}

export interface AtlasDevice {
  deviceId: string;
  paperId: string;
  materialFamily: string;
  materialComposition: string;
  deviceArchitecture: string;
  deviceStack: string | null;
  activeAreaCm2: number | null;
  deviceNotes: string | null;
}

export interface AtlasMeasurement {
  measurementId: string;
  deviceId: string;
  wavelengthNm: number;
  detectivityJones: number;
  responsivityAW: number | null;
  responsivityWavelengthNm: number | null;
  responsivityBiasV: number | null;
  responsivityTemperatureK: number | null;
  responsivitySourceLocation: string | null;
  responsivityExtractionMethod: string | null;
  eqePercent: number | null;
  temperatureK: number | null;
  biasV: number | null;
  measurementFrequencyHz: number | null;
  responseTimeS: number | null;
  riseTimeS: number | null;
  fallTimeS: number | null;
  responseTimeDefinition: string | null;
  responseTimeWavelengthNm: number | null;
  responseTimeBiasV: number | null;
  responseTimeSourceLocation: string | null;
  responseTimeLimit: string | null;
  responseTimeExtractionMethod: string | null;
  bandwidthHz: number | null;
  bandwidthBiasV: number | null;
  bandwidthSourceLocation: string | null;
  bandwidthLimit: string | null;
  bandwidthExtractionMethod: string | null;
  linearDynamicRangeDb: number | null;
  linearDynamicRangeMin: number | null;
  linearDynamicRangeMax: number | null;
  linearDynamicRangeUnits: string | null;
  linearDynamicRangeDefinition: string | null;
  linearDynamicRangeSourceLocation: string | null;
  linearDynamicRangeExtractionMethod: string | null;
  extendedMetricsReviewStatus: string;
  extendedMetricsReviewDate: string | null;
  extendedMetricsNotes: string | null;
  noiseMethod: NoiseMethod;
  noiseInstruments: NoiseInstrument[];
  noiseInstrumentDetails: string | null;
  noiseInstrumentSource: string | null;
  detectivityExtractionMethod: string | null;
  sourceLocation: string | null;
  curatorStatus: string;
  flag: PublicFlag;
  amberReasons: string[];
  amberExplanation: string | null;
  curatorNotes: string | null;
  dateAdded: string | null;
  dateUpdated: string | null;
}

/**
 * Stable, presentation-focused view of a joined data record. Keeping this
 * adapter at the atlas boundary lets the UI survive a future move from CSVs
 * to a database without coupling components to storage details.
 */
export interface AtlasRecord {
  paper: AtlasPaper;
  device: AtlasDevice;
  measurement: AtlasMeasurement;
}

export interface AtlasFilterState {
  search: string;
  material: string;
  wavelengthMin?: number;
  wavelengthMax?: number;
  year?: number;
  temperature: TemperatureCategory | "all";
  bias: BiasCondition | "all";
  noiseMethod: NoiseMethod | "all";
  flag: PublicFlag | "all";
  publicationType: PublicationFilter | "all";
  hasResponsivity: boolean;
  hasEqe: boolean;
  hasTemporal: boolean;
  hasRiseTime: boolean;
  hasFallTime: boolean;
  hasBandwidth: boolean;
  hasLdr: boolean;
  extendedReview: ExtendedReviewFilter;
  ambiguousExtraction: boolean;
  responsivityMin?: number;
  eqeMin?: number;
  responseTimeMaxS?: number;
  riseTimeMaxS?: number;
  fallTimeMaxS?: number;
  bandwidthMinHz?: number;
  ldrMinDb?: number;
  plotMode: AtlasPlotMode;
  plotX: AtlasMetricKey;
  plotY: AtlasMetricKey;
  plotScope: AtlasPlotScope;
  tableView: AtlasTableView;
}

export type AtlasSortKey =
  | "material"
  | "wavelength"
  | "detectivity"
  | "responsivity"
  | "eqe"
  | "response_time"
  | "rise_time"
  | "fall_time"
  | "bandwidth"
  | "ldr"
  | "year";
export type SortDirection = "asc" | "desc";

export interface AtlasSortState {
  key: AtlasSortKey;
  direction: SortDirection;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(source: UnknownRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key];
    }
  }
  return undefined;
}

function textValue(
  source: UnknownRecord,
  keys: string[],
  fallback = "",
): string {
  const value = pick(source, ...keys);
  return value === undefined || value === null ? fallback : String(value);
}

function nullableText(source: UnknownRecord, keys: string[]): string | null {
  const value = textValue(source, keys).trim();
  return value ? value : null;
}

function numberValue(
  source: UnknownRecord,
  keys: string[],
  fallback = Number.NaN,
): number {
  const value = pick(source, ...keys);
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(source: UnknownRecord, keys: string[]): number | null {
  const value = numberValue(source, keys);
  return Number.isFinite(value) ? value : null;
}

function booleanValue(
  source: UnknownRecord,
  keys: string[],
  fallback: boolean,
): boolean {
  const value = pick(source, ...keys);
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (["true", "1", "yes"].includes(value.toLowerCase())) return true;
    if (["false", "0", "no"].includes(value.toLowerCase())) return false;
  }
  return fallback;
}

function listValue(source: UnknownRecord, keys: string[]): string[] {
  const value = pick(source, ...keys);
  if (Array.isArray(value)) {
    return value
      .map(String)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value !== "string" || !value.trim()) return [];
  const separator = value.includes(";") ? ";" : ",";
  return value
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function section(root: UnknownRecord, key: string): UnknownRecord {
  const nested = root[key];
  return isRecord(nested) ? nested : root;
}

function noiseMethodValue(source: UnknownRecord): NoiseMethod {
  const candidate = textValue(source, ["noise_method", "noiseMethod"]);
  return NOISE_METHODS.includes(candidate as NoiseMethod)
    ? (candidate as NoiseMethod)
    : "unspecified";
}

function flagValue(source: UnknownRecord): PublicFlag {
  return textValue(source, ["flag"]).toLowerCase() === "green"
    ? "green"
    : "amber";
}

/** Normalize either nested or flattened JoinedMeasurement records. */
export function normalizeJoinedMeasurement(
  joined: JoinedMeasurement,
): AtlasRecord {
  const root = joined as unknown as UnknownRecord;
  const paper = section(root, "paper");
  const device = section(root, "device");
  const measurement = section(root, "measurement");

  return {
    paper: {
      paperId: textValue(paper, ["paper_id", "paperId"]),
      title: textValue(paper, ["title"]),
      authors: listValue(paper, ["authors"]),
      firstAuthor: textValue(paper, ["first_author", "firstAuthor"]),
      journal: nullableText(paper, ["journal"]),
      publicationYear: numberValue(paper, [
        "publication_year",
        "publicationYear",
      ]),
      doi: nullableText(paper, ["doi"]),
      publicationUrl: nullableText(paper, [
        "publication_url",
        "publicationUrl",
      ]),
      publicationType: textValue(paper, [
        "publication_type",
        "publicationType",
      ]),
      peerReviewed: booleanValue(
        paper,
        ["peer_reviewed", "peerReviewed"],
        true,
      ),
      notes: nullableText(paper, ["notes"]),
    },
    device: {
      deviceId: textValue(device, ["device_id", "deviceId"]),
      paperId: textValue(device, ["paper_id", "paperId"]),
      materialFamily: textValue(device, ["material_family", "materialFamily"]),
      materialComposition: textValue(device, [
        "material_composition",
        "materialComposition",
      ]),
      deviceArchitecture: textValue(device, [
        "device_architecture",
        "deviceArchitecture",
      ]),
      deviceStack: nullableText(device, ["device_stack", "deviceStack"]),
      activeAreaCm2: nullableNumber(device, [
        "active_area_cm2",
        "activeAreaCm2",
      ]),
      deviceNotes: nullableText(device, ["device_notes", "deviceNotes"]),
    },
    measurement: {
      measurementId: textValue(measurement, [
        "measurement_id",
        "measurementId",
      ]),
      deviceId: textValue(measurement, ["device_id", "deviceId"]),
      wavelengthNm: numberValue(measurement, ["wavelength_nm", "wavelengthNm"]),
      detectivityJones: numberValue(measurement, [
        "detectivity_jones",
        "detectivityJones",
      ]),
      responsivityAW: nullableNumber(measurement, [
        "responsivity_a_w",
        "responsivityAW",
      ]),
      responsivityWavelengthNm: nullableNumber(measurement, [
        "responsivity_wavelength_nm",
        "responsivityWavelengthNm",
      ]),
      responsivityBiasV: nullableNumber(measurement, [
        "responsivity_bias_v",
        "responsivityBiasV",
      ]),
      responsivityTemperatureK: nullableNumber(measurement, [
        "responsivity_temperature_k",
        "responsivityTemperatureK",
      ]),
      responsivitySourceLocation: nullableText(measurement, [
        "responsivity_source_location",
        "responsivitySourceLocation",
      ]),
      responsivityExtractionMethod: nullableText(measurement, [
        "responsivity_extraction_method",
        "responsivityExtractionMethod",
      ]),
      eqePercent: nullableNumber(measurement, ["eqe_percent", "eqePercent"]),
      temperatureK: nullableNumber(measurement, [
        "temperature_k",
        "temperatureK",
      ]),
      biasV: nullableNumber(measurement, ["bias_v", "biasV"]),
      measurementFrequencyHz: nullableNumber(measurement, [
        "measurement_frequency_hz",
        "measurementFrequencyHz",
      ]),
      responseTimeS: nullableNumber(measurement, [
        "response_time_s",
        "responseTimeS",
      ]),
      riseTimeS: nullableNumber(measurement, ["rise_time_s", "riseTimeS"]),
      fallTimeS: nullableNumber(measurement, ["fall_time_s", "fallTimeS"]),
      responseTimeDefinition: nullableText(measurement, [
        "response_time_definition",
        "responseTimeDefinition",
      ]),
      responseTimeWavelengthNm: nullableNumber(measurement, [
        "response_time_wavelength_nm",
        "responseTimeWavelengthNm",
      ]),
      responseTimeBiasV: nullableNumber(measurement, [
        "response_time_bias_v",
        "responseTimeBiasV",
      ]),
      responseTimeSourceLocation: nullableText(measurement, [
        "response_time_source_location",
        "responseTimeSourceLocation",
      ]),
      responseTimeLimit: nullableText(measurement, [
        "response_time_limit",
        "responseTimeLimit",
      ]),
      responseTimeExtractionMethod: nullableText(measurement, [
        "response_time_extraction_method",
        "responseTimeExtractionMethod",
      ]),
      bandwidthHz: nullableNumber(measurement, ["bandwidth_hz", "bandwidthHz"]),
      bandwidthBiasV: nullableNumber(measurement, [
        "bandwidth_bias_v",
        "bandwidthBiasV",
      ]),
      bandwidthSourceLocation: nullableText(measurement, [
        "bandwidth_source_location",
        "bandwidthSourceLocation",
      ]),
      bandwidthLimit: nullableText(measurement, [
        "bandwidth_limit",
        "bandwidthLimit",
      ]),
      bandwidthExtractionMethod: nullableText(measurement, [
        "bandwidth_extraction_method",
        "bandwidthExtractionMethod",
      ]),
      linearDynamicRangeDb: nullableNumber(measurement, [
        "linear_dynamic_range_db",
        "linearDynamicRangeDb",
      ]),
      linearDynamicRangeMin: nullableNumber(measurement, [
        "linear_dynamic_range_min",
        "linearDynamicRangeMin",
      ]),
      linearDynamicRangeMax: nullableNumber(measurement, [
        "linear_dynamic_range_max",
        "linearDynamicRangeMax",
      ]),
      linearDynamicRangeUnits: nullableText(measurement, [
        "linear_dynamic_range_units",
        "linearDynamicRangeUnits",
      ]),
      linearDynamicRangeDefinition: nullableText(measurement, [
        "linear_dynamic_range_definition",
        "linearDynamicRangeDefinition",
      ]),
      linearDynamicRangeSourceLocation: nullableText(measurement, [
        "linear_dynamic_range_source_location",
        "linearDynamicRangeSourceLocation",
      ]),
      linearDynamicRangeExtractionMethod: nullableText(measurement, [
        "linear_dynamic_range_extraction_method",
        "linearDynamicRangeExtractionMethod",
      ]),
      extendedMetricsReviewStatus: textValue(
        measurement,
        ["extended_metrics_review_status", "extendedMetricsReviewStatus"],
        "not_checked",
      ),
      extendedMetricsReviewDate: nullableText(measurement, [
        "extended_metrics_review_date",
        "extendedMetricsReviewDate",
      ]),
      extendedMetricsNotes: nullableText(measurement, [
        "extended_metrics_notes",
        "extendedMetricsNotes",
      ]),
      noiseMethod: noiseMethodValue(measurement),
      noiseInstruments: listValue(measurement, [
        "noise_instruments",
        "noiseInstruments",
      ]) as NoiseInstrument[],
      noiseInstrumentDetails: nullableText(measurement, [
        "noise_instrument_details",
        "noiseInstrumentDetails",
      ]),
      noiseInstrumentSource: nullableText(measurement, [
        "noise_instrument_source",
        "noiseInstrumentSource",
      ]),
      detectivityExtractionMethod: nullableText(measurement, [
        "detectivity_extraction_method",
        "detectivityExtractionMethod",
      ]),
      sourceLocation: nullableText(measurement, [
        "source_location",
        "sourceLocation",
      ]),
      curatorStatus: textValue(measurement, [
        "curator_status",
        "curatorStatus",
      ]),
      flag: flagValue(measurement),
      amberReasons: listValue(measurement, ["amber_reasons", "amberReasons"]),
      amberExplanation: nullableText(measurement, [
        "amber_explanation",
        "amberExplanation",
      ]),
      curatorNotes: nullableText(measurement, [
        "curator_notes",
        "curatorNotes",
      ]),
      dateAdded: nullableText(measurement, ["date_added", "dateAdded"]),
      dateUpdated: nullableText(measurement, ["date_updated", "dateUpdated"]),
    },
  };
}
