import {
  formatNumber,
  formatScientific,
  formatWithUnit,
  humanizeCode,
  NOT_REPORTED,
} from "./format.ts";
import { maxDetectivityPerPaper } from "./coverage.ts";
import type { AtlasMetricKey, AtlasPlotScope, AtlasRecord } from "./types.ts";

export interface AtlasMetricDefinition {
  key: AtlasMetricKey;
  label: string;
  shortLabel: string;
  axisLabel: string;
  unit: string;
  scale: "linear" | "log";
}

export const ATLAS_METRICS: Record<AtlasMetricKey, AtlasMetricDefinition> = {
  wavelength: {
    key: "wavelength",
    label: "Measurement wavelength",
    shortLabel: "Wavelength",
    axisLabel: "Measurement wavelength (nm)",
    unit: "nm",
    scale: "linear",
  },
  detectivity: {
    key: "detectivity",
    label: "Specific detectivity, D*",
    shortLabel: "D*",
    axisLabel: "Specific detectivity, D* (Jones)",
    unit: "Jones",
    scale: "log",
  },
  responsivity: {
    key: "responsivity",
    label: "Responsivity",
    shortLabel: "Responsivity",
    axisLabel: "Responsivity (A W⁻¹)",
    unit: "A W⁻¹",
    scale: "linear",
  },
  eqe: {
    key: "eqe",
    label: "External quantum efficiency",
    shortLabel: "EQE",
    axisLabel: "External quantum efficiency (%)",
    unit: "%",
    scale: "linear",
  },
  response_time: {
    key: "response_time",
    label: "Generic response time",
    shortLabel: "Response time",
    axisLabel: "Generic response time (s)",
    unit: "s",
    scale: "log",
  },
  rise_time: {
    key: "rise_time",
    label: "Rise time",
    shortLabel: "Rise time",
    axisLabel: "Rise time (s)",
    unit: "s",
    scale: "log",
  },
  fall_time: {
    key: "fall_time",
    label: "Fall or decay time",
    shortLabel: "Fall time",
    axisLabel: "Fall or decay time (s)",
    unit: "s",
    scale: "log",
  },
  bandwidth: {
    key: "bandwidth",
    label: "Explicit −3 dB bandwidth",
    shortLabel: "−3 dB bandwidth",
    axisLabel: "Explicit −3 dB bandwidth (Hz)",
    unit: "Hz",
    scale: "log",
  },
  ldr: {
    key: "ldr",
    label: "Linear dynamic range",
    shortLabel: "LDR",
    axisLabel: "Linear dynamic range (dB)",
    unit: "dB",
    scale: "linear",
  },
};

export const ATLAS_PLOT_PRESETS = [
  {
    key: "dstar-wavelength",
    label: "D* vs wavelength",
    x: "wavelength",
    y: "detectivity",
  },
  {
    key: "dstar-responsivity",
    label: "D* vs responsivity",
    x: "responsivity",
    y: "detectivity",
  },
  {
    key: "dstar-response",
    label: "D* vs response time",
    x: "response_time",
    y: "detectivity",
  },
  {
    key: "dstar-bandwidth",
    label: "D* vs bandwidth",
    x: "bandwidth",
    y: "detectivity",
  },
  { key: "dstar-ldr", label: "D* vs LDR", x: "ldr", y: "detectivity" },
  {
    key: "responsivity-bandwidth",
    label: "Responsivity vs bandwidth",
    x: "bandwidth",
    y: "responsivity",
  },
] as const satisfies readonly {
  key: string;
  label: string;
  x: AtlasMetricKey;
  y: AtlasMetricKey;
}[];

export function metricValue(
  record: AtlasRecord,
  metric: AtlasMetricKey,
): number | null {
  const measurement = record.measurement;
  switch (metric) {
    case "wavelength":
      return measurement.wavelengthNm;
    case "detectivity":
      return measurement.detectivityJones;
    case "responsivity":
      return measurement.responsivityAW;
    case "eqe":
      return measurement.eqePercent;
    case "response_time":
      return measurement.responseTimeS;
    case "rise_time":
      return measurement.riseTimeS;
    case "fall_time":
      return measurement.fallTimeS;
    case "bandwidth":
      return measurement.bandwidthHz;
    case "ldr":
      return measurement.linearDynamicRangeDb;
  }
}

export function isPlottableMetricValue(
  value: number | null,
  metric: AtlasMetricKey,
): value is number {
  if (value === null || !Number.isFinite(value)) return false;
  return ATLAS_METRICS[metric].scale === "log" ? value > 0 : value >= 0;
}

export function recordsWithMetricPair(
  records: readonly AtlasRecord[],
  xMetric: AtlasMetricKey,
  yMetric: AtlasMetricKey,
): { plotted: AtlasRecord[]; excluded: number } {
  const plotted = records.filter(
    (record) =>
      isPlottableMetricValue(metricValue(record, xMetric), xMetric) &&
      isPlottableMetricValue(metricValue(record, yMetric), yMetric),
  );
  return { plotted, excluded: records.length - plotted.length };
}

export function recordsForPlotScope(
  records: readonly AtlasRecord[],
  scope: AtlasPlotScope,
): AtlasRecord[] {
  return scope === "paper_maxima"
    ? maxDetectivityPerPaper(records)
    : [...records];
}

export function availablePlotPresets(records: readonly AtlasRecord[]) {
  return ATLAS_PLOT_PRESETS.filter(
    (preset) =>
      recordsWithMetricPair(records, preset.x, preset.y).plotted.length > 0,
  );
}

export function metricSource(
  record: AtlasRecord,
  metric: AtlasMetricKey,
): string | null {
  const measurement = record.measurement;
  switch (metric) {
    case "responsivity":
      return measurement.responsivitySourceLocation;
    case "response_time":
    case "rise_time":
    case "fall_time":
      return measurement.responseTimeSourceLocation;
    case "bandwidth":
      return measurement.bandwidthSourceLocation;
    case "ldr":
      return measurement.linearDynamicRangeSourceLocation;
    case "eqe":
      return null;
    default:
      return measurement.sourceLocation;
  }
}

export function metricExtractionMethod(
  record: AtlasRecord,
  metric: AtlasMetricKey,
): string | null {
  const measurement = record.measurement;
  switch (metric) {
    case "responsivity":
      return measurement.responsivityExtractionMethod;
    case "response_time":
    case "rise_time":
    case "fall_time":
      return measurement.responseTimeExtractionMethod;
    case "bandwidth":
      return measurement.bandwidthExtractionMethod;
    case "ldr":
      return measurement.linearDynamicRangeExtractionMethod;
    case "detectivity":
    case "wavelength":
      return measurement.detectivityExtractionMethod;
    case "eqe":
      return null;
  }
}

export function hasAmbiguousExtendedMetric(record: AtlasRecord): boolean {
  const measurement = record.measurement;
  return [
    measurement.responsivityExtractionMethod,
    measurement.responseTimeExtractionMethod,
    measurement.bandwidthExtractionMethod,
    measurement.linearDynamicRangeExtractionMethod,
  ].includes("ambiguous");
}

export function hasTemporalMetric(record: AtlasRecord): boolean {
  const measurement = record.measurement;
  return (
    measurement.responseTimeS !== null ||
    measurement.riseTimeS !== null ||
    measurement.fallTimeS !== null
  );
}

function engineeringValue(value: number, unit: string): string {
  const magnitudes = [
    { threshold: 1e9, scale: 1e9, prefix: "G" },
    { threshold: 1e6, scale: 1e6, prefix: "M" },
    { threshold: 1e3, scale: 1e3, prefix: "k" },
    { threshold: 1, scale: 1, prefix: "" },
    { threshold: 1e-3, scale: 1e-3, prefix: "m" },
    { threshold: 1e-6, scale: 1e-6, prefix: "µ" },
    { threshold: 1e-9, scale: 1e-9, prefix: "n" },
  ];
  const magnitude =
    magnitudes.find((candidate) => Math.abs(value) >= candidate.threshold) ??
    magnitudes.at(-1)!;
  return `${formatNumber(value / magnitude.scale, {
    maximumSignificantDigits: 4,
  })} ${magnitude.prefix}${unit}`;
}

export function formatMetricValue(
  value: number | null,
  metric: AtlasMetricKey,
): string {
  if (value === null || !Number.isFinite(value)) return NOT_REPORTED;
  switch (metric) {
    case "detectivity":
      return `${formatScientific(value)} Jones`;
    case "response_time":
    case "rise_time":
    case "fall_time":
      return engineeringValue(value, "s");
    case "bandwidth":
      return engineeringValue(value, "Hz");
    case "wavelength":
      return formatWithUnit(value, "nm", { maximumFractionDigits: 2 });
    case "responsivity":
      return formatWithUnit(value, "A W⁻¹", {
        maximumSignificantDigits: 4,
      });
    case "eqe":
      return formatWithUnit(value, "%", { maximumSignificantDigits: 4 });
    case "ldr":
      return formatWithUnit(value, "dB", { maximumSignificantDigits: 4 });
  }
}

export function metricEvidenceSummary(
  record: AtlasRecord,
  metric: AtlasMetricKey,
): string {
  const method = metricExtractionMethod(record, metric);
  const source = metricSource(record, metric);
  const extended = metric !== "wavelength" && metric !== "detectivity";
  if (
    extended &&
    record.measurement.extendedMetricsReviewStatus === "source_unavailable"
  ) {
    return [
      method ? humanizeCode(method) : null,
      source,
      "Source unavailable · value unverified",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (!method && !source) {
    if (!extended) return NOT_REPORTED;
    switch (record.measurement.extendedMetricsReviewStatus) {
      case "source_unavailable":
        return "Source unavailable · value unverified";
      case "needs_review":
        return "Metric-specific provenance needs review";
      case "not_checked":
        return "Metric-specific provenance not checked";
      default:
        return "Metric-specific provenance not stored";
    }
  }
  return [method ? humanizeCode(method) : null, source]
    .filter(Boolean)
    .join(" · ");
}

export function ldrValuePrefix(record: AtlasRecord): string {
  const definition =
    record.measurement.linearDynamicRangeDefinition?.trim() ?? "";
  if (/\blower bound\b/i.test(definition) || />\s*\d/.test(definition)) {
    return ">";
  }
  if (/\bupper bound\b/i.test(definition) || /<\s*\d/.test(definition)) {
    return "<";
  }
  return "";
}

export function metricDefinitionSummary(
  record: AtlasRecord,
  metric: AtlasMetricKey,
): string | null {
  switch (metric) {
    case "response_time":
    case "rise_time":
    case "fall_time":
      return record.measurement.responseTimeDefinition;
    case "ldr":
      return record.measurement.linearDynamicRangeDefinition;
    default:
      return null;
  }
}

export function metricLimitLabel(
  record: AtlasRecord,
  metric: AtlasMetricKey,
): string | null {
  const measurement = record.measurement;
  const limit =
    metric === "bandwidth"
      ? measurement.bandwidthLimit
      : metric === "response_time" ||
          metric === "rise_time" ||
          metric === "fall_time"
        ? measurement.responseTimeLimit
        : null;
  if (!limit || limit === "measured" || limit === "not_reported") return null;
  return humanizeCode(limit);
}

export function metricConditionSummary(
  record: AtlasRecord,
  metric: AtlasMetricKey,
): string[] {
  const measurement = record.measurement;
  switch (metric) {
    case "wavelength":
    case "detectivity":
      return [
        formatWithUnit(measurement.wavelengthNm, "nm"),
        formatWithUnit(measurement.biasV, "V"),
        formatWithUnit(measurement.temperatureK, "K"),
      ].filter((value) => value !== NOT_REPORTED);
    case "responsivity":
      return [
        formatWithUnit(measurement.responsivityWavelengthNm, "nm"),
        formatWithUnit(measurement.responsivityBiasV, "V"),
        formatWithUnit(measurement.responsivityTemperatureK, "K"),
      ].filter((value) => value !== NOT_REPORTED);
    case "response_time":
    case "rise_time":
    case "fall_time":
      return [
        formatWithUnit(measurement.responseTimeWavelengthNm, "nm"),
        formatWithUnit(measurement.responseTimeBiasV, "V"),
      ].filter((value) => value !== NOT_REPORTED);
    case "bandwidth":
      return [formatWithUnit(measurement.bandwidthBiasV, "V")].filter(
        (value) => value !== NOT_REPORTED,
      );
    case "eqe":
    case "ldr":
      // The current schema has no metric-specific operating-condition fields
      // for these values. Showing D* conditions here would imply a match the
      // source data does not establish.
      return [];
  }
}
