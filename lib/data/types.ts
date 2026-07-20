/** Canonical schema for the manually curated CQD Photodiode Atlas dataset. */

export const PUBLICATION_TYPES = [
  "journal_article",
  "preprint",
  "demonstration",
] as const;
export type PublicationType = (typeof PUBLICATION_TYPES)[number];

export const NOISE_METHODS = [
  "measured_noise",
  "shot_noise_approximation",
  "calculated_shot_and_thermal_noise",
  "nep_from_minimum_detectable_power",
  "unspecified",
] as const;
export type NoiseMethod = (typeof NOISE_METHODS)[number];

export const NOISE_INSTRUMENTS = [
  "spectrum_analyzer",
  "lock_in_amplifier",
  "oscilloscope_fft",
  "transient_current_fft",
  "dedicated_noise_analyzer",
  "source_measure_unit",
  "other",
  "not_reported",
  "not_applicable",
] as const;
export type NoiseInstrument = (typeof NOISE_INSTRUMENTS)[number];

export const DETECTIVITY_EXTRACTION_METHODS = [
  "directly_reported",
  "calculated_from_reported_values",
  "graphically_extracted",
  "unspecified",
] as const;
export type DetectivityExtractionMethod =
  (typeof DETECTIVITY_EXTRACTION_METHODS)[number];

export const EXTENDED_METRIC_EXTRACTION_METHODS = [
  "directly_reported",
  "graphically_extracted",
  "calculated_from_reported_values",
  "not_reported",
  "ambiguous",
] as const;
export type ExtendedMetricExtractionMethod =
  (typeof EXTENDED_METRIC_EXTRACTION_METHODS)[number];

export const EXTENDED_METRICS_REVIEW_STATUSES = [
  "not_checked",
  "checked",
  "source_unavailable",
  "needs_review",
] as const;
export type ExtendedMetricsReviewStatus =
  (typeof EXTENDED_METRICS_REVIEW_STATUSES)[number];

export const RESPONSE_TIME_LIMITS = [
  "measured",
  "instrument_limited",
  "source_limited",
  "upper_bound",
  "lower_bound",
  "not_reported",
] as const;
export type ResponseTimeLimit = (typeof RESPONSE_TIME_LIMITS)[number];

export const BANDWIDTH_LIMITS = [
  "measured",
  "instrument_limited",
  "upper_bound",
  "lower_bound",
  "not_reported",
] as const;
export type BandwidthLimit = (typeof BANDWIDTH_LIMITS)[number];

export const CURATOR_STATUSES = ["reviewed", "pending_review"] as const;
export type CuratorStatus = (typeof CURATOR_STATUSES)[number];

export const FLAGS = ["green", "amber"] as const;
export type Flag = (typeof FLAGS)[number];

/**
 * Machine-readable caution reasons. Human-readable copy lives in
 * `AMBER_REASON_DETAILS`, so the UI never has to expose these keys directly.
 */
export const AMBER_REASONS = [
  "shot_noise_approximation",
  "lock_in_only_noise_measurement",
  "source_measure_unit_noise_measurement",
  "above_blip_limit",
] as const;
export type AmberReason = (typeof AMBER_REASONS)[number];

export interface Paper {
  paper_id: string;
  title: string;
  authors: string[];
  first_author: string;
  journal: string | null;
  publication_year: number;
  doi: string | null;
  publication_url: string | null;
  publication_type: PublicationType;
  peer_reviewed: boolean;
  notes: string | null;
}

export interface Device {
  device_id: string;
  paper_id: string;
  material_family: string;
  material_composition: string | null;
  device_architecture: string | null;
  device_stack: string | null;
  active_area_cm2: number | null;
  device_notes: string | null;
}

export interface Measurement {
  measurement_id: string;
  device_id: string;
  wavelength_nm: number;
  detectivity_jones: number;
  responsivity_a_w: number | null;
  responsivity_wavelength_nm?: number | null;
  responsivity_bias_v?: number | null;
  responsivity_temperature_k?: number | null;
  responsivity_source_location?: string | null;
  responsivity_extraction_method?: ExtendedMetricExtractionMethod | null;
  eqe_percent: number | null;
  temperature_k: number | null;
  bias_v: number | null;
  measurement_frequency_hz: number | null;
  response_time_s: number | null;
  rise_time_s?: number | null;
  fall_time_s?: number | null;
  response_time_definition?: string | null;
  response_time_wavelength_nm?: number | null;
  response_time_bias_v?: number | null;
  response_time_source_location?: string | null;
  response_time_limit?: ResponseTimeLimit | null;
  response_time_extraction_method?: ExtendedMetricExtractionMethod | null;
  bandwidth_hz: number | null;
  bandwidth_bias_v?: number | null;
  bandwidth_source_location?: string | null;
  bandwidth_limit?: BandwidthLimit | null;
  bandwidth_extraction_method?: ExtendedMetricExtractionMethod | null;
  linear_dynamic_range_db?: number | null;
  linear_dynamic_range_min?: number | null;
  linear_dynamic_range_max?: number | null;
  linear_dynamic_range_units?: string | null;
  linear_dynamic_range_definition?: string | null;
  linear_dynamic_range_source_location?: string | null;
  linear_dynamic_range_extraction_method?: ExtendedMetricExtractionMethod | null;
  extended_metrics_review_status?: ExtendedMetricsReviewStatus;
  extended_metrics_review_date?: string | null;
  extended_metrics_notes?: string | null;
  noise_method: NoiseMethod;
  noise_instruments: NoiseInstrument[];
  noise_instrument_details: string | null;
  noise_instrument_source: string | null;
  detectivity_extraction_method: DetectivityExtractionMethod;
  source_location: string | null;
  curator_status: CuratorStatus;
  flag: Flag;
  amber_reasons: AmberReason[];
  /** Curator-written context. Required for amber records and null for green. */
  amber_explanation: string | null;
  curator_notes: string | null;
  /** ISO 8601 calendar date (`YYYY-MM-DD`). */
  date_added: string;
  /** ISO 8601 calendar date (`YYYY-MM-DD`). */
  date_updated: string;
}

export interface AtlasEntities {
  papers: Paper[];
  devices: Device[];
  measurements: Measurement[];
}

export interface JoinedMeasurement {
  paper: Paper;
  device: Device;
  measurement: Measurement;
}

export interface AtlasData extends AtlasEntities {
  schema_version: 3;
  /** Human-facing release identifier for reproducible exports and citations. */
  dataset_version: string;
  /** Deterministic ISO timestamp derived from the latest `date_updated`. */
  generated_at: string;
  records: JoinedMeasurement[];
}

export type TemperatureCategory =
  "below_room_temperature" | "room_temperature" | "elevated" | "not_reported";

export type BiasCondition = "zero_bias" | "nonzero_bias" | "not_reported";

export interface NumericRange {
  min?: number;
  max?: number;
}

export interface AtlasFilters {
  search?: string;
  material_families?: readonly string[];
  wavelength_nm?: NumericRange;
  publication_year?: NumericRange;
  temperature_categories?: readonly TemperatureCategory[];
  bias_conditions?: readonly BiasCondition[];
  noise_methods?: readonly NoiseMethod[];
  flags?: readonly Flag[];
  publication_types?: readonly PublicationType[];
}

export type AtlasSortField =
  | "detectivity_jones"
  | "wavelength_nm"
  | "publication_year"
  | "material_family";

export type SortDirection = "asc" | "desc";

export interface ValidationIssue {
  entity: "papers" | "devices" | "measurements" | "csv" | "atlas";
  row?: number;
  field: string;
  code: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface CsvSourceRows {
  papers?: ReadonlyMap<string, number>;
  devices?: ReadonlyMap<string, number>;
  measurements?: ReadonlyMap<string, number>;
}

export interface CsvTexts {
  papers: string;
  devices: string;
  measurements: string;
}
