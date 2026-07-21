"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type ScatterPointItem,
  type TooltipContentProps,
} from "recharts";

import { atlasRecordsToCsv } from "@/lib/atlas/csv";
import {
  formatAmberReason,
  formatNoiseMethod,
  formatWithUnit,
  humanizeCode,
  NOT_REPORTED,
} from "@/lib/atlas/format";
import { materialColor } from "@/lib/atlas/materials";
import {
  ATLAS_METRICS,
  ATLAS_PLOT_PRESETS,
  availablePlotPresets,
  formatMetricValue,
  ldrValuePrefix,
  metricConditionSummary,
  metricDefinitionSummary,
  metricEvidenceSummary,
  metricLimitLabel,
  metricValue,
  recordsForPlotScope,
  recordsWithMetricPair,
} from "@/lib/atlas/metrics";
import {
  ATLAS_METRIC_KEYS,
  type AtlasFilterState,
  type AtlasMetricKey,
  type AtlasPlotMode,
  type AtlasRecord,
} from "@/lib/atlas/types";
import { DATASET_VERSION } from "@/lib/data";

import { MaterialLabel } from "./MaterialLabel";

type PlotConfiguration = Pick<
  AtlasFilterState,
  "plotMode" | "plotX" | "plotY" | "plotScope"
>;

export interface PerformanceExplorerProps extends PlotConfiguration {
  records: readonly AtlasRecord[];
  activeMaterial?: string;
  selectedMeasurementId?: string;
  onConfigChange: (changes: Partial<PlotConfiguration>) => void;
  onMaterialFilter?: (material: string) => void;
  onSelect: (record: AtlasRecord) => void;
}

interface PlotDatum {
  x: number;
  y: number;
  fill: string;
  record: AtlasRecord;
}

interface AxisDomain {
  domain: [number, number];
  ticks: number[];
}

const DEFAULT_PLOT_CONFIGURATION: PlotConfiguration = {
  plotMode: "performance_map",
  plotX: "wavelength",
  plotY: "detectivity",
  plotScope: "paper_maxima",
};

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

const WAVELENGTH_REGIONS = [
  { label: "NIR", start: 700, end: 1000, fill: "#eef6f8" },
  { label: "SWIR", start: 1000, end: 2500, fill: "#f5f2fa" },
  { label: "MWIR", start: 3000, end: 5000, fill: "#faf4ea" },
] as const;

function superscript(value: number): string {
  return String(value)
    .split("")
    .map((character) => SUPERSCRIPT_DIGITS[character] ?? character)
    .join("");
}

function decadeLabel(value: number): string {
  return `10${superscript(Math.round(Math.log10(value)))}`;
}

function niceStep(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  const niceFraction =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * 10 ** exponent;
}

function linearDomain(values: readonly number[]): AxisDomain {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = maximum - minimum;
  const padding =
    spread > 0 ? spread * 0.07 : Math.max(Math.abs(maximum) * 0.1, 1);
  const paddedMinimum = Math.max(0, minimum - padding);
  const paddedMaximum = maximum + padding;
  const step = niceStep((paddedMaximum - paddedMinimum) / 7);
  const domainMinimum = Math.max(0, Math.floor(paddedMinimum / step) * step);
  let domainMaximum = Math.ceil(paddedMaximum / step) * step;
  if (domainMaximum <= domainMinimum) domainMaximum = domainMinimum + step;

  const ticks: number[] = [];
  for (
    let tick = domainMinimum, index = 0;
    tick <= domainMaximum + step * 1e-8 && index < 12;
    tick += step, index += 1
  ) {
    ticks.push(Number(tick.toPrecision(12)));
  }

  return { domain: [domainMinimum, domainMaximum], ticks };
}

function logDomain(values: readonly number[]): AxisDomain {
  const minimumExponent = Math.floor(Math.log10(Math.min(...values)));
  let maximumExponent = Math.ceil(Math.log10(Math.max(...values)));
  if (maximumExponent <= minimumExponent) {
    maximumExponent = minimumExponent + 1;
  }
  const exponentStep = Math.max(
    1,
    Math.ceil((maximumExponent - minimumExponent) / 7),
  );
  const ticks: number[] = [];
  for (
    let exponent = minimumExponent;
    exponent <= maximumExponent;
    exponent += exponentStep
  ) {
    ticks.push(10 ** exponent);
  }
  if (ticks.at(-1) !== 10 ** maximumExponent) {
    ticks.push(10 ** maximumExponent);
  }

  return {
    domain: [10 ** minimumExponent, 10 ** maximumExponent],
    ticks,
  };
}

function axisDomain(
  values: readonly number[],
  metric: AtlasMetricKey,
): AxisDomain {
  if (!values.length) return { domain: [0, 1], ticks: [0, 1] };
  return ATLAS_METRICS[metric].scale === "log"
    ? logDomain(values)
    : linearDomain(values);
}

function compactNumber(value: number): string {
  const magnitude = Math.abs(value);
  const scales = [
    { minimum: 1e9, divisor: 1e9, suffix: "G" },
    { minimum: 1e6, divisor: 1e6, suffix: "M" },
    { minimum: 1e3, divisor: 1e3, suffix: "k" },
    { minimum: 1, divisor: 1, suffix: "" },
    { minimum: 1e-3, divisor: 1e-3, suffix: "m" },
    { minimum: 1e-6, divisor: 1e-6, suffix: "µ" },
    { minimum: 1e-9, divisor: 1e-9, suffix: "n" },
  ];
  const scale =
    scales.find((candidate) => magnitude >= candidate.minimum) ??
    scales.at(-1)!;
  return `${new Intl.NumberFormat("en-US", {
    maximumSignificantDigits: 3,
  }).format(value / scale.divisor)}${scale.suffix}`;
}

function axisTickFormatter(metric: AtlasMetricKey): (value: number) => string {
  if (ATLAS_METRICS[metric].scale === "log") return decadeLabel;
  if (metric === "wavelength") {
    return (value) =>
      new Intl.NumberFormat("en-US", {
        maximumFractionDigits: value < 10 ? 2 : 0,
      }).format(value);
  }
  return compactNumber;
}

function formattedDatumMetric(
  record: AtlasRecord,
  metric: AtlasMetricKey,
): string {
  const formatted = formatMetricValue(metricValue(record, metric), metric);
  const limit = metricLimitLabel(record, metric);
  const qualified =
    metric === "ldr" ? `${ldrValuePrefix(record)}${formatted}` : formatted;
  return limit ? `${qualified} · ${limit}` : qualified;
}

function datumFromPoint(point: ScatterPointItem): PlotDatum | undefined {
  const payload = point.payload as PlotDatum | undefined;
  return payload?.record ? payload : undefined;
}

function downloadCsv(
  records: readonly AtlasRecord[],
  xMetric: AtlasMetricKey,
  yMetric: AtlasMetricKey,
): void {
  const blob = new Blob([atlasRecordsToCsv(records)], {
    type: "text/csv;charset=utf-8",
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `cqd-photodiode-atlas-v${DATASET_VERSION}-${yMetric}-vs-${xMetric}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

function downloadPlotPng(
  container: HTMLDivElement | null,
  xMetric: AtlasMetricKey,
  yMetric: AtlasMetricKey,
): void {
  const source = container?.querySelector("svg");
  if (!source) return;
  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const width = source.viewBox.baseVal.width || source.clientWidth;
  const height = source.viewBox.baseVal.height || source.clientHeight;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const background = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect",
  );
  background.setAttribute("width", "100%");
  background.setAttribute("height", "100%");
  const chartBackground = container
    ? window.getComputedStyle(container).backgroundColor
    : "#ffffff";
  background.setAttribute(
    "fill",
    chartBackground === "rgba(0, 0, 0, 0)" || chartBackground === "transparent"
      ? "#ffffff"
      : chartBackground || "#ffffff",
  );
  clone.insertBefore(background, clone.firstChild);

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent =
    ".recharts-text{fill:#52615c;font-family:Arial,sans-serif;font-size:12px}.recharts-cartesian-axis-tick-value{font-weight:700}.performance-plot__axis-label{font-size:15px;font-weight:700}.notable-point-label{fill:#263c35;font-size:10px;font-weight:700;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}";
  clone.insertBefore(style, clone.firstChild);

  const serialized = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(
    new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }),
  );
  const image = new Image();
  image.onload = () => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      URL.revokeObjectURL(url);
      return;
    }
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `cqd-${yMetric}-vs-${xMetric}.png`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    }, "image/png");
  };
  image.onerror = () => URL.revokeObjectURL(url);
  image.src = url;
}

function usePrefersReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

function AtlasPoint({
  point,
  xMetric,
  yMetric,
  selectedMeasurementId,
  focusMeasurementId,
  showLabel,
  onHover,
  onSelect,
}: {
  point: ScatterPointItem;
  xMetric: AtlasMetricKey;
  yMetric: AtlasMetricKey;
  selectedMeasurementId?: string;
  focusMeasurementId?: string;
  showLabel: boolean;
  onHover: (measurementId?: string) => void;
  onSelect: (record: AtlasRecord) => void;
}) {
  const datum = datumFromPoint(point);
  if (!datum || point.cx === undefined || point.cy === undefined) return null;
  const { measurement, device, paper } = datum.record;
  const selected = measurement.measurementId === selectedMeasurementId;
  const hovered = measurement.measurementId === focusMeasurementId;
  const dimmed = Boolean(focusMeasurementId) && !hovered && !selected;
  const isShotNoise = measurement.noiseMethod === "shot_noise_approximation";
  const isCaution = measurement.flag === "amber";
  const stroke = isCaution ? "#9a4d06" : "#334b43";
  const accessibleLabel = `${device.materialFamily}; ${ATLAS_METRICS[yMetric].label}: ${formattedDatumMetric(
    datum.record,
    yMetric,
  )}; ${ATLAS_METRICS[xMetric].label}: ${formattedDatumMetric(
    datum.record,
    xMetric,
  )}; ${formatNoiseMethod(measurement.noiseMethod)}; ${
    isCaution ? "amber methodological caution" : "green review flag"
  }; ${paper.title}`;
  const activate = () => onSelect(datum.record);
  const common = {
    fill: datum.fill,
    stroke,
    fillOpacity: hovered || selected ? 0.95 : 0.68,
    strokeOpacity: 0.96,
    strokeWidth: selected ? 3 : isCaution ? 2.4 : 1.35,
    vectorEffect: "non-scaling-stroke" as const,
  };
  const radius = hovered || selected ? 7 : 5.5;

  return (
    <g
      className={`atlas-point atlas-point--${measurement.flag}${
        selected ? " atlas-point--selected" : ""
      }${hovered ? " atlas-point--hovered" : ""}${
        dimmed ? " atlas-point--dimmed" : ""
      }`}
      role="button"
      tabIndex={0}
      aria-label={accessibleLabel}
      aria-pressed={selected}
      onClick={activate}
      onMouseEnter={() => onHover(measurement.measurementId)}
      onMouseLeave={() => onHover(undefined)}
      onFocus={() => onHover(measurement.measurementId)}
      onBlur={() => onHover(undefined)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
    >
      <circle
        cx={point.cx}
        cy={point.cy}
        r="12"
        fill="transparent"
        stroke="none"
      />
      {selected ? (
        <circle
          cx={point.cx}
          cy={point.cy}
          r="11"
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          opacity="0.5"
        />
      ) : null}
      {isShotNoise ? (
        <path
          d={`M ${point.cx} ${point.cy - radius} L ${point.cx + radius} ${
            point.cy + radius * 0.8
          } L ${point.cx - radius} ${point.cy + radius * 0.8} Z`}
          {...common}
        />
      ) : isCaution ? (
        <path
          d={`M ${point.cx} ${point.cy - radius} L ${point.cx + radius} ${
            point.cy
          } L ${point.cx} ${point.cy + radius} L ${
            point.cx - radius
          } ${point.cy} Z`}
          {...common}
        />
      ) : (
        <circle cx={point.cx} cy={point.cy} r={radius} {...common} />
      )}
      {showLabel ? (
        <text
          className="notable-point-label"
          x={point.cx + 9}
          y={point.cy - 9}
          aria-hidden="true"
        >
          {paper.firstAuthor || "Unknown"} {paper.publicationYear}
        </text>
      ) : null}
    </g>
  );
}

function MetricEvidence({
  record,
  metric,
}: {
  record: AtlasRecord;
  metric: AtlasMetricKey;
}) {
  const conditions = metricConditionSummary(record, metric);
  const definition = metricDefinitionSummary(record, metric);
  return (
    <>
      {metric !== "detectivity" ? (
        <div>
          <dt>{ATLAS_METRICS[metric].shortLabel} conditions</dt>
          <dd>{conditions.length ? conditions.join(" · ") : NOT_REPORTED}</dd>
        </div>
      ) : null}
      <div>
        <dt>{ATLAS_METRICS[metric].shortLabel} evidence</dt>
        <dd>{metricEvidenceSummary(record, metric)}</dd>
      </div>
      {definition ? (
        <div>
          <dt>{ATLAS_METRICS[metric].shortLabel} definition</dt>
          <dd>{definition}</dd>
        </div>
      ) : null}
    </>
  );
}

function AtlasTooltip({
  active,
  payload,
  xMetric,
  yMetric,
}: TooltipContentProps & {
  xMetric: AtlasMetricKey;
  yMetric: AtlasMetricKey;
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload as PlotDatum | undefined;
  if (!datum?.record) return null;
  const { paper, device, measurement } = datum.record;
  const hasExtendedMetric = [xMetric, yMetric].some(
    (metric) => metric !== "wavelength" && metric !== "detectivity",
  );
  const evidenceMetrics = [
    ...new Set(
      [xMetric, yMetric].map((metric) =>
        metric === "wavelength" ? "detectivity" : metric,
      ),
    ),
  ];

  return (
    <div className="atlas-tooltip">
      <p className="atlas-tooltip__material">
        <MaterialLabel value={device.materialFamily} /> ·{" "}
        {paper.publicationYear}
      </p>
      <div className="atlas-tooltip__headline">
        <strong>{formattedDatumMetric(datum.record, yMetric)}</strong>
        <span>{formattedDatumMetric(datum.record, xMetric)}</span>
      </div>
      <dl>
        <div>
          <dt>Y · {ATLAS_METRICS[yMetric].shortLabel}</dt>
          <dd>{formattedDatumMetric(datum.record, yMetric)}</dd>
        </div>
        <div>
          <dt>X · {ATLAS_METRICS[xMetric].shortLabel}</dt>
          <dd>{formattedDatumMetric(datum.record, xMetric)}</dd>
        </div>
        {xMetric !== "wavelength" && yMetric !== "wavelength" ? (
          <div>
            <dt>D* wavelength</dt>
            <dd>{formatWithUnit(measurement.wavelengthNm, "nm")}</dd>
          </div>
        ) : null}
        <div>
          <dt>D* bias</dt>
          <dd>{formatWithUnit(measurement.biasV, "V")}</dd>
        </div>
        <div>
          <dt>D* temperature</dt>
          <dd>{formatWithUnit(measurement.temperatureK, "K")}</dd>
        </div>
        <div>
          <dt>Device active area</dt>
          <dd>
            {formatWithUnit(device.activeAreaCm2, "cm²", {
              maximumSignificantDigits: 4,
            })}
          </dd>
        </div>
        <div>
          <dt>Noise</dt>
          <dd>{formatNoiseMethod(measurement.noiseMethod)}</dd>
        </div>
        <div>
          <dt>Extended review</dt>
          <dd>{humanizeCode(measurement.extendedMetricsReviewStatus)}</dd>
        </div>
        <div>
          <dt>First author</dt>
          <dd>{paper.firstAuthor || NOT_REPORTED}</dd>
        </div>
        {evidenceMetrics.map((metric) => (
          <MetricEvidence key={metric} record={datum.record} metric={metric} />
        ))}
      </dl>
      {hasExtendedMetric ? (
        <small>
          Extended metrics may come from a different operating point than the D*
          record; compare the conditions and evidence above.
        </small>
      ) : null}
      {hasExtendedMetric && measurement.extendedMetricsNotes ? (
        <p className="atlas-tooltip__metric-note">
          {measurement.extendedMetricsNotes}
        </p>
      ) : null}
      {measurement.flag === "amber" ? (
        <p className="atlas-tooltip__warning">
          {measurement.amberReasons.length
            ? measurement.amberReasons.map(formatAmberReason).join(" ")
            : measurement.amberExplanation ||
              "This record carries a methodological caution."}
        </p>
      ) : null}
      <p className="atlas-tooltip__paper">{paper.title}</p>
      <small>Select for device architecture and full provenance.</small>
    </div>
  );
}

function MarkerLegend() {
  return (
    <div className="plot-legend__markers" aria-label="Plot marker legend">
      <span>
        <i className="plot-marker plot-marker--circle" aria-hidden="true" />
        Green / non-shot-noise
      </span>
      <span>
        <i className="plot-marker plot-marker--triangle" aria-hidden="true" />
        Shot-noise estimate
      </span>
      <span>
        <i className="plot-marker plot-marker--diamond" aria-hidden="true" />
        Other amber caution
      </span>
    </div>
  );
}

function PlotConfigurationPanel({
  panelId,
  plotMode,
  plotX,
  plotY,
  supportedPresets,
  activePresetKey,
  showNotableLabels,
  canExport,
  onConfigChange,
  onToggleLabels,
  onExportCsv,
  onExportPng,
}: {
  panelId: string;
  plotMode: AtlasPlotMode;
  plotX: AtlasMetricKey;
  plotY: AtlasMetricKey;
  supportedPresets: readonly (typeof ATLAS_PLOT_PRESETS)[number][];
  activePresetKey: string;
  showNotableLabels: boolean;
  canExport: boolean;
  onConfigChange: (changes: Partial<PlotConfiguration>) => void;
  onToggleLabels: () => void;
  onExportCsv: () => void;
  onExportPng: () => void;
}) {
  const changeAxis = (axis: "plotX" | "plotY", value: AtlasMetricKey) => {
    if (axis === "plotX") {
      onConfigChange(
        value === plotY ? { plotX: value, plotY: plotX } : { plotX: value },
      );
    } else {
      onConfigChange(
        value === plotX ? { plotX: plotY, plotY: value } : { plotY: value },
      );
    }
  };

  return (
    <div
      id={panelId}
      className="atlas-filters__advanced"
      role="region"
      aria-label="Plot configuration"
      style={{
        gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
        margin: "0 28px 18px",
      }}
    >
      {plotMode === "compare_metrics" ? (
        <>
          <label className="atlas-field">
            <span>Tradeoff preset</span>
            <select
              value={activePresetKey}
              onChange={(event) => {
                const preset = supportedPresets.find(
                  (candidate) => candidate.key === event.target.value,
                );
                if (preset) {
                  onConfigChange({
                    plotMode: "compare_metrics",
                    plotX: preset.x,
                    plotY: preset.y,
                  });
                }
              }}
            >
              <option value="custom">Custom axes</option>
              {supportedPresets.map((preset) => (
                <option value={preset.key} key={preset.key}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label className="atlas-field">
            <span>X axis</span>
            <select
              value={plotX}
              onChange={(event) =>
                changeAxis("plotX", event.target.value as AtlasMetricKey)
              }
            >
              {ATLAS_METRIC_KEYS.map((metric) => (
                <option value={metric} key={metric}>
                  {ATLAS_METRICS[metric].label}
                </option>
              ))}
            </select>
          </label>
          <label className="atlas-field">
            <span>Y axis</span>
            <select
              value={plotY}
              onChange={(event) =>
                changeAxis("plotY", event.target.value as AtlasMetricKey)
              }
            >
              {ATLAS_METRIC_KEYS.map((metric) => (
                <option value={metric} key={metric}>
                  {ATLAS_METRICS[metric].label}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 12 }}>
          Performance map keeps wavelength on X and specific detectivity on Y.
          Switch to Compare metrics to explore another tradeoff.
        </p>
      )}

      <div
        className="performance-plot__actions"
        aria-label="Plot display and export actions"
        style={{ alignItems: "end", justifyContent: "flex-start" }}
      >
        <button
          type="button"
          aria-pressed={showNotableLabels}
          onClick={onToggleLabels}
        >
          {showNotableLabels ? "Hide" : "Label"} notable points
        </button>
        <button type="button" disabled={!canExport} onClick={onExportCsv}>
          Export CSV
        </button>
        <button type="button" disabled={!canExport} onClick={onExportPng}>
          Export PNG
        </button>
        <button
          type="button"
          onClick={() => onConfigChange(DEFAULT_PLOT_CONFIGURATION)}
        >
          Reset plot
        </button>
      </div>
    </div>
  );
}

export function PerformanceExplorer({
  records,
  plotMode,
  plotX,
  plotY,
  plotScope,
  activeMaterial = "all",
  selectedMeasurementId,
  onConfigChange,
  onMaterialFilter,
  onSelect,
}: PerformanceExplorerProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const configPanelId = `performance-plot-config-${useId().replaceAll(":", "")}`;
  const [configOpen, setConfigOpen] = useState(false);
  const [showNotableLabels, setShowNotableLabels] = useState(false);
  const [hoveredMeasurementId, setHoveredMeasurementId] = useState<string>();
  const reducedMotion = usePrefersReducedMotion();

  const xMetric = plotMode === "performance_map" ? "wavelength" : plotX;
  const requestedYMetric =
    plotMode === "performance_map" ? "detectivity" : plotY;
  const yMetric =
    requestedYMetric === xMetric
      ? xMetric === "detectivity"
        ? "wavelength"
        : "detectivity"
      : requestedYMetric;

  const recordsInScope = useMemo(
    () => recordsForPlotScope(records, plotScope),
    [records, plotScope],
  );
  const { plotted: plottedRecords, excluded } = useMemo(
    () => recordsWithMetricPair(recordsInScope, xMetric, yMetric),
    [recordsInScope, xMetric, yMetric],
  );
  const data: PlotDatum[] = useMemo(
    () =>
      plottedRecords.map((record) => ({
        x: metricValue(record, xMetric)!,
        y: metricValue(record, yMetric)!,
        fill: materialColor(record.device.materialFamily),
        record,
      })),
    [plottedRecords, xMetric, yMetric],
  );
  const xDomain = useMemo(
    () =>
      axisDomain(
        data.map((datum) => datum.x),
        xMetric,
      ),
    [data, xMetric],
  );
  const yDomain = useMemo(
    () =>
      axisDomain(
        data.map((datum) => datum.y),
        yMetric,
      ),
    [data, yMetric],
  );
  const supportedPresets = useMemo(
    () => availablePlotPresets(recordsInScope),
    [recordsInScope],
  );
  const activePreset =
    plotMode === "compare_metrics"
      ? supportedPresets.find(
          (preset) => preset.x === xMetric && preset.y === yMetric,
        )
      : undefined;
  const materials = useMemo(
    () =>
      [
        ...new Set(
          plottedRecords.map((record) => record.device.materialFamily),
        ),
      ].sort((left, right) => left.localeCompare(right)),
    [plottedRecords],
  );
  const paperCount = new Set(
    plottedRecords.map((record) => record.paper.paperId),
  ).size;
  const flaggedCount = plottedRecords.filter(
    (record) => record.measurement.flag === "amber",
  ).length;
  const notableMeasurementIds = useMemo(() => {
    const identifiers = new Set<string>();
    for (const material of materials) {
      const candidates = data.filter(
        (datum) => datum.record.device.materialFamily === material,
      );
      if (!candidates.length) continue;
      const highest = candidates.reduce((best, candidate) =>
        candidate.y > best.y ? candidate : best,
      );
      identifiers.add(highest.record.measurement.measurementId);
    }
    for (const record of plottedRecords) {
      if (record.measurement.flag === "amber") {
        identifiers.add(record.measurement.measurementId);
      }
    }
    return identifiers;
  }, [data, materials, plottedRecords]);
  const selectedIsPlotted = plottedRecords.some(
    (record) => record.measurement.measurementId === selectedMeasurementId,
  );
  const hoveredIsPlotted = plottedRecords.some(
    (record) => record.measurement.measurementId === hoveredMeasurementId,
  );
  const focusMeasurementId =
    (hoveredIsPlotted ? hoveredMeasurementId : undefined) ??
    (selectedIsPlotted ? selectedMeasurementId : undefined);
  const scopeLabel =
    plotScope === "paper_maxima" ? "Maximum D* per paper" : "All measurements";
  const title =
    plotMode === "performance_map"
      ? "Detectivity across wavelength"
      : `${ATLAS_METRICS[yMetric].shortLabel} vs ${ATLAS_METRICS[xMetric].shortLabel}`;
  const subtitle =
    plotMode === "performance_map"
      ? `Specific detectivity versus operating wavelength · ${scopeLabel}`
      : `${activePreset?.label ?? "Custom metric comparison"} · ${scopeLabel}`;
  const showWavelengthRegions = xMetric === "wavelength" && data.length > 0;

  const renderPoint = (point: ScatterPointItem) => (
    <AtlasPoint
      point={point}
      xMetric={xMetric}
      yMetric={yMetric}
      selectedMeasurementId={selectedMeasurementId}
      focusMeasurementId={focusMeasurementId}
      showLabel={
        showNotableLabels &&
        notableMeasurementIds.has(
          datumFromPoint(point)?.record.measurement.measurementId ?? "",
        )
      }
      onHover={setHoveredMeasurementId}
      onSelect={onSelect}
    />
  );

  return (
    <section
      id="atlas-performance-plot"
      className="performance-plot"
      aria-labelledby="performance-plot-title"
    >
      <div className="performance-plot__heading">
        <div>
          <p className="section-kicker">
            {plotMode === "performance_map"
              ? "Performance map"
              : "Compare metrics"}
          </p>
          <h2 id="performance-plot-title">{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="performance-plot__actions">
          <div
            role="group"
            aria-label="Plot mode"
            style={{ display: "inline-flex", gap: 4 }}
          >
            <button
              type="button"
              aria-pressed={plotMode === "performance_map"}
              onClick={() =>
                onConfigChange({
                  plotMode: "performance_map",
                  plotX: "wavelength",
                  plotY: "detectivity",
                })
              }
            >
              Performance map
            </button>
            <button
              type="button"
              aria-pressed={plotMode === "compare_metrics"}
              onClick={() => onConfigChange({ plotMode: "compare_metrics" })}
            >
              Compare metrics
            </button>
          </div>
          <div
            role="group"
            aria-label="Measurement scope"
            style={{ display: "inline-flex", gap: 4 }}
          >
            <button
              type="button"
              aria-pressed={plotScope === "paper_maxima"}
              onClick={() => onConfigChange({ plotScope: "paper_maxima" })}
            >
              Max D* per paper
            </button>
            <button
              type="button"
              aria-pressed={plotScope === "all_measurements"}
              onClick={() => onConfigChange({ plotScope: "all_measurements" })}
            >
              All measurements
            </button>
          </div>
          <button
            type="button"
            aria-expanded={configOpen}
            aria-controls={configPanelId}
            onClick={() => setConfigOpen((open) => !open)}
          >
            {configOpen ? "Close" : "Configure"} plot
          </button>
        </div>
      </div>

      {configOpen ? (
        <PlotConfigurationPanel
          panelId={configPanelId}
          plotMode={plotMode}
          plotX={xMetric}
          plotY={yMetric}
          supportedPresets={supportedPresets}
          activePresetKey={activePreset?.key ?? "custom"}
          showNotableLabels={showNotableLabels}
          canExport={plottedRecords.length > 0}
          onConfigChange={onConfigChange}
          onToggleLabels={() => setShowNotableLabels((shown) => !shown)}
          onExportCsv={() => downloadCsv(plottedRecords, xMetric, yMetric)}
          onExportPng={() =>
            downloadPlotPng(chartRef.current, xMetric, yMetric)
          }
        />
      ) : null}

      <div className="performance-plot__meta">
        <div
          className="performance-plot__summary"
          aria-label="Plot summary"
          aria-live="polite"
        >
          <span>
            <strong>{plottedRecords.length}</strong>{" "}
            {plotScope === "paper_maxima"
              ? "paper maxima plotted"
              : "measurements plotted"}
          </span>
          <span>
            <strong>{excluded}</strong> excluded
          </span>
          <span>
            <strong>{paperCount}</strong> papers
          </span>
          <span>
            <strong>{materials.length}</strong> material classes
          </span>
          <span className={flaggedCount ? "has-flags" : undefined}>
            <strong>{flaggedCount}</strong> flagged
          </span>
        </div>
        {excluded ? (
          <p
            style={{
              margin: "0",
              padding: "8px 0 0",
              color: "var(--ink-soft)",
              fontSize: 11,
            }}
          >
            Excluded scoped records do not contain usable stored values for both
            selected metrics, or contain a non-positive value on a logarithmic
            axis.
          </p>
        ) : null}
        {plottedRecords.length ? (
          <div className="plot-legend">
            <div className="plot-legend__group">
              <span className="plot-legend__title">Material</span>
              <div
                className="plot-legend__materials"
                aria-label="Material colors"
              >
                {materials.map((material) => {
                  const active = activeMaterial === material;
                  return onMaterialFilter ? (
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        onMaterialFilter(active ? "all" : material)
                      }
                      key={material}
                    >
                      <i
                        aria-hidden="true"
                        style={{ backgroundColor: materialColor(material) }}
                      />
                      <MaterialLabel value={material} />
                    </button>
                  ) : (
                    <span key={material}>
                      <i
                        aria-hidden="true"
                        style={{ backgroundColor: materialColor(material) }}
                      />
                      <MaterialLabel value={material} />
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="plot-legend__group">
              <span className="plot-legend__title">Noise / review</span>
              <MarkerLegend />
            </div>
          </div>
        ) : null}
      </div>

      {plottedRecords.length ? (
        <div
          ref={chartRef}
          className="performance-plot__chart"
          role="group"
          aria-label={`Scatter plot of ${plottedRecords.length} ${
            plotScope === "paper_maxima" ? "paper maxima" : "measurements"
          }, ${ATLAS_METRICS[yMetric].label} by ${
            ATLAS_METRICS[xMetric].label
          }. Use Tab to focus individual points.`}
        >
          <p className="sr-only">
            Color identifies material family. A triangle identifies a shot-noise
            approximation even when the record is amber; a diamond identifies
            other amber methodological cautions.
          </p>
          {showWavelengthRegions ? (
            <div className="performance-plot__region-labels" aria-hidden="true">
              {WAVELENGTH_REGIONS.map((region) => {
                const start = Math.max(region.start, xDomain.domain[0]);
                const end = Math.min(region.end, xDomain.domain[1]);
                if (end < start) return null;
                return (
                  <span
                    key={region.label}
                    className="performance-plot__region-label"
                    style={{
                      left: `${
                        ((start - xDomain.domain[0]) /
                          (xDomain.domain[1] - xDomain.domain[0])) *
                        100
                      }%`,
                      width: `${
                        ((end - start) /
                          (xDomain.domain[1] - xDomain.domain[0])) *
                        100
                      }%`,
                    }}
                  >
                    {region.label}
                  </span>
                );
              })}
            </div>
          ) : null}
          <ResponsiveContainer width="100%" height={560} minWidth={280}>
            <ScatterChart margin={{ top: 34, right: 42, bottom: 38, left: 18 }}>
              {showWavelengthRegions
                ? WAVELENGTH_REGIONS.map((region) =>
                    region.end >= xDomain.domain[0] &&
                    region.start <= xDomain.domain[1] ? (
                      <ReferenceArea
                        key={region.label}
                        x1={Math.max(region.start, xDomain.domain[0])}
                        x2={Math.min(region.end, xDomain.domain[1])}
                        fill={region.fill}
                        fillOpacity={0.72}
                        strokeOpacity={0}
                      />
                    ) : null,
                  )
                : null}
              <CartesianGrid strokeDasharray="1 0" vertical={false} />
              <XAxis
                type="number"
                dataKey="x"
                scale={ATLAS_METRICS[xMetric].scale}
                domain={xDomain.domain}
                ticks={xDomain.ticks}
                allowDataOverflow
                tickFormatter={axisTickFormatter(xMetric)}
                tick={{ fontWeight: 700 }}
                tickLine={false}
                name={ATLAS_METRICS[xMetric].label}
                label={{
                  value: ATLAS_METRICS[xMetric].axisLabel,
                  position: "insideBottom",
                  offset: -20,
                  className: "performance-plot__axis-label",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                scale={ATLAS_METRICS[yMetric].scale}
                domain={yDomain.domain}
                ticks={yDomain.ticks}
                allowDataOverflow
                tickFormatter={axisTickFormatter(yMetric)}
                tick={{ fontWeight: 700 }}
                tickLine={false}
                width={88}
                name={ATLAS_METRICS[yMetric].label}
                label={{
                  value: ATLAS_METRICS[yMetric].axisLabel,
                  angle: -90,
                  position: "insideLeft",
                  offset: 7,
                  className: "performance-plot__axis-label",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              />
              <Tooltip
                content={(props) => (
                  <AtlasTooltip
                    {...props}
                    xMetric={xMetric}
                    yMetric={yMetric}
                  />
                )}
                cursor={{ strokeDasharray: "2 3" }}
                isAnimationActive={false}
              />
              <Scatter
                data={data}
                shape={renderPoint}
                isAnimationActive={reducedMotion ? false : "auto"}
                animationDuration={240}
                name="Photodiode measurements"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div
          ref={chartRef}
          className="performance-plot__chart performance-plot--empty"
          role="status"
        >
          <h2>No plottable measurements</h2>
          <p>
            {records.length
              ? `No records in this scope contain a usable stored ${ATLAS_METRICS[xMetric].shortLabel} and ${ATLAS_METRICS[yMetric].shortLabel} pair.`
              : "No measurements match the current filters."}
          </p>
        </div>
      )}
    </section>
  );
}
