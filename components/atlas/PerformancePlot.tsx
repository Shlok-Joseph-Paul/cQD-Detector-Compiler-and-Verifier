"use client";

import { useRef, useState } from "react";
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
import { maxDetectivityPerPaper } from "@/lib/atlas/coverage";
import {
  formatAmberReason,
  formatNoiseMethod,
  formatScientific,
  formatWithUnit,
  NOT_REPORTED,
} from "@/lib/atlas/format";
import { materialColor } from "@/lib/atlas/materials";
import type { AtlasRecord } from "@/lib/atlas/types";
import { DATASET_VERSION } from "@/lib/data";

import { MaterialLabel } from "./MaterialLabel";

interface PlotDatum {
  wavelength: number;
  detectivity: number;
  fill: string;
  record: AtlasRecord;
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "-": "⁻",
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

function decadeLabel(value: number): string {
  const exponent = Math.round(Math.log10(value));
  const superscript = String(exponent)
    .split("")
    .map((digit) => SUPERSCRIPT_DIGITS[digit] ?? digit)
    .join("");
  return `10${superscript}`;
}

function downloadCsv(records: readonly AtlasRecord[]): void {
  const blob = new Blob([atlasRecordsToCsv(records)], {
    type: "text/csv;charset=utf-8",
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `cqd-photodiode-atlas-v${DATASET_VERSION}-map.csv`;
  anchor.click();
  URL.revokeObjectURL(href);
}

async function downloadPlotPng(container: HTMLDivElement | null) {
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
  background.setAttribute("fill", "#ffffff");
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
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "cqd-detectivity-performance-map.png";
      anchor.click();
      URL.revokeObjectURL(href);
    }, "image/png");
  };
  image.src = url;
}

export interface PerformancePlotProps {
  records: readonly AtlasRecord[];
  activeMaterial?: string;
  selectedMeasurementId?: string;
  onMaterialFilter?: (material: string) => void;
  onSelect: (record: AtlasRecord) => void;
}

function plotDomain(records: readonly AtlasRecord[]): {
  x: [number, number];
  xTicks: number[];
  y: [number, number];
  yTicks: number[];
} {
  const wavelengths = records.map((record) => record.measurement.wavelengthNm);
  const detectivities = records.map(
    (record) => record.measurement.detectivityJones,
  );
  const xMin = Math.min(...wavelengths);
  const xMax = Math.max(...wavelengths);
  const xPadding =
    xMin === xMax ? Math.max(Math.abs(xMin) * 0.08, 25) : (xMax - xMin) * 0.05;
  const paddedXMin = Math.max(0, xMin - xPadding);
  const paddedXMax = xMax + xPadding;
  const rawXStep = (paddedXMax - paddedXMin) / 8;
  const xSteps = [25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  const xStep = xSteps.find((step) => step >= rawXStep) ?? 10000;
  const roundedXMin = Math.max(0, Math.floor(paddedXMin / xStep) * xStep);
  const roundedXMax = Math.ceil(paddedXMax / xStep) * xStep;
  const xTicks: number[] = [];
  for (let value = roundedXMin; value <= roundedXMax; value += xStep) {
    xTicks.push(value);
  }
  const minExponent = Math.floor(Math.log10(Math.min(...detectivities)));
  let maxExponent = Math.ceil(Math.log10(Math.max(...detectivities)));
  if (maxExponent === minExponent) maxExponent += 1;
  const exponentStep = Math.max(1, Math.ceil((maxExponent - minExponent) / 7));
  const yTicks: number[] = [];
  for (
    let exponent = minExponent;
    exponent <= maxExponent;
    exponent += exponentStep
  ) {
    yTicks.push(10 ** exponent);
  }
  if (yTicks.at(-1) !== 10 ** maxExponent) yTicks.push(10 ** maxExponent);

  return {
    x: [roundedXMin, roundedXMax],
    xTicks,
    y: [10 ** minExponent, 10 ** maxExponent],
    yTicks,
  };
}

function datumFromPoint(point: ScatterPointItem): PlotDatum | undefined {
  const payload = point.payload as PlotDatum | undefined;
  return payload?.record ? payload : undefined;
}

function AtlasPoint({
  point,
  selectedMeasurementId,
  hoveredMeasurementId,
  showLabel,
  onHover,
  onSelect,
}: {
  point: ScatterPointItem;
  selectedMeasurementId?: string;
  hoveredMeasurementId?: string;
  showLabel: boolean;
  onHover: (measurementId?: string) => void;
  onSelect: (record: AtlasRecord) => void;
}) {
  const datum = datumFromPoint(point);
  if (!datum || point.cx === undefined || point.cy === undefined) return null;
  const { measurement, device, paper } = datum.record;
  const selected = measurement.measurementId === selectedMeasurementId;
  const hovered = measurement.measurementId === hoveredMeasurementId;
  const dimmed = Boolean(hoveredMeasurementId) && !hovered;
  const isShotNoise = measurement.noiseMethod === "shot_noise_approximation";
  const isCaution = measurement.flag === "amber";
  const stroke = isCaution ? "#9a4d06" : "#334b43";
  const accessibleLabel = `${device.materialFamily}, ${formatWithUnit(
    measurement.wavelengthNm,
    "nanometers",
  )}, detectivity ${formatScientific(measurement.detectivityJones)} Jones, ${
    measurement.flag
  } flag, ${paper.title}`;
  const activate = () => onSelect(datum.record);
  const common = {
    fill: datum.fill,
    stroke,
    fillOpacity: hovered ? 0.95 : 0.7,
    strokeOpacity: 0.96,
    strokeWidth: selected ? 3 : isCaution ? 2.5 : 1.35,
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
      {isCaution ? (
        <path
          d={`M ${point.cx} ${point.cy - radius} L ${point.cx + radius} ${point.cy} L ${
            point.cx
          } ${point.cy + radius} L ${point.cx - radius} ${point.cy} Z`}
          {...common}
        />
      ) : isShotNoise ? (
        <path
          d={`M ${point.cx} ${point.cy - radius} L ${point.cx + radius} ${
            point.cy + radius * 0.8
          } L ${point.cx - radius} ${point.cy + radius * 0.8} Z`}
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

function AtlasTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload.length) return null;
  const datum = payload[0]?.payload as PlotDatum | undefined;
  if (!datum?.record) return null;
  const { paper, device, measurement } = datum.record;

  return (
    <div className="atlas-tooltip">
      <p className="atlas-tooltip__material">
        <MaterialLabel value={device.materialFamily} /> ·{" "}
        {paper.publicationYear}
      </p>
      <div className="atlas-tooltip__headline">
        <strong>{formatScientific(measurement.detectivityJones)} Jones</strong>
        <span>{formatWithUnit(measurement.wavelengthNm, "nm")}</span>
      </div>
      <dl>
        <div>
          <dt>First author</dt>
          <dd>{paper.firstAuthor || NOT_REPORTED}</dd>
        </div>
        <div>
          <dt>Bias</dt>
          <dd>{formatWithUnit(measurement.biasV, "V")}</dd>
        </div>
        <div>
          <dt>Temperature</dt>
          <dd>{formatWithUnit(measurement.temperatureK, "K")}</dd>
        </div>
        <div>
          <dt>Noise</dt>
          <dd>{formatNoiseMethod(measurement.noiseMethod)}</dd>
        </div>
        <div>
          <dt>Flag</dt>
          <dd>{measurement.flag === "green" ? "Green" : "Amber"}</dd>
        </div>
      </dl>
      {measurement.flag === "amber" && measurement.amberReasons.length ? (
        <p className="atlas-tooltip__warning">
          {measurement.amberReasons.map(formatAmberReason).join(" ")}
        </p>
      ) : null}
      <p className="atlas-tooltip__paper">{paper.title}</p>
      <small>
        Select for device architecture, provenance, and full context.
      </small>
    </div>
  );
}

function MarkerLegend() {
  return (
    <div className="plot-legend__markers" aria-label="Plot marker legend">
      <span>
        <i className="plot-marker plot-marker--circle" aria-hidden="true" />
        Measured noise
      </span>
      <span>
        <i className="plot-marker plot-marker--triangle" aria-hidden="true" />
        Shot-noise estimate
      </span>
      <span>
        <i className="plot-marker plot-marker--diamond" aria-hidden="true" />
        Methodological caution
      </span>
    </div>
  );
}

export function PerformancePlot({
  records,
  activeMaterial = "all",
  selectedMeasurementId,
  onMaterialFilter,
  onSelect,
}: PerformancePlotProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [showNotableLabels, setShowNotableLabels] = useState(false);
  const [showPaperMaximums, setShowPaperMaximums] = useState(true);
  const [hoveredMeasurementId, setHoveredMeasurementId] = useState<string>();
  const validRecords = records.filter(
    (record) =>
      Number.isFinite(record.measurement.wavelengthNm) &&
      record.measurement.wavelengthNm > 0 &&
      Number.isFinite(record.measurement.detectivityJones) &&
      record.measurement.detectivityJones > 0,
  );

  if (!validRecords.length) {
    return (
      <section
        id="atlas-performance-plot"
        className="performance-plot performance-plot--empty"
        aria-labelledby="performance-plot-title"
      >
        <h2 id="performance-plot-title">Performance map</h2>
        <p>No measurements match the current filters.</p>
      </section>
    );
  }

  const plottedRecords = showPaperMaximums
    ? maxDetectivityPerPaper(validRecords)
    : validRecords;
  const domain = plotDomain(plottedRecords);
  const data: PlotDatum[] = plottedRecords.map((record) => ({
    wavelength: record.measurement.wavelengthNm,
    detectivity: record.measurement.detectivityJones,
    fill: materialColor(record.device.materialFamily),
    record,
  }));
  const materials = [
    ...new Set(plottedRecords.map((record) => record.device.materialFamily)),
  ].sort((left, right) => left.localeCompare(right));
  const paperCount = new Set(
    plottedRecords.map((record) => record.paper.paperId),
  ).size;
  const flaggedCount = plottedRecords.filter(
    (record) => record.measurement.flag === "amber",
  ).length;
  const notableMeasurementIds = new Set<string>();
  for (const material of materials) {
    const candidates = plottedRecords.filter(
      (record) => record.device.materialFamily === material,
    );
    const highest = candidates.reduce((best, record) =>
      record.measurement.detectivityJones > best.measurement.detectivityJones
        ? record
        : best,
    );
    notableMeasurementIds.add(highest.measurement.measurementId);
  }
  for (const record of plottedRecords) {
    if (record.measurement.flag === "amber") {
      notableMeasurementIds.add(record.measurement.measurementId);
    }
  }

  const renderPoint = (point: ScatterPointItem) => (
    <AtlasPoint
      point={point}
      selectedMeasurementId={selectedMeasurementId}
      hoveredMeasurementId={hoveredMeasurementId}
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
          <p className="section-kicker">Curated dataset</p>
          <h2 id="performance-plot-title">Detectivity across wavelength</h2>
          <p>Specific detectivity versus operating wavelength</p>
        </div>
        <div className="performance-plot__actions">
          <button
            type="button"
            aria-pressed={showPaperMaximums}
            onClick={() => setShowPaperMaximums((shown) => !shown)}
            title="Show only the highest detectivity measurement remaining for each paper"
          >
            {showPaperMaximums ? "All measurements" : "Maximum D* per paper"}
          </button>
          <button
            type="button"
            aria-pressed={showNotableLabels}
            onClick={() => setShowNotableLabels((shown) => !shown)}
          >
            {showNotableLabels ? "Hide" : "Label"} notable points
          </button>
          <button type="button" onClick={() => downloadCsv(plottedRecords)}>
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => void downloadPlotPng(chartRef.current)}
          >
            Export PNG
          </button>
        </div>
      </div>

      <div className="performance-plot__meta">
        <div className="performance-plot__summary" aria-label="Plot summary">
          <span>
            <strong>{plottedRecords.length}</strong>{" "}
            {showPaperMaximums ? "paper maxima" : "measurements"}
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
                    onClick={() => onMaterialFilter(active ? "all" : material)}
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
            <span className="plot-legend__title">Noise method</span>
            <MarkerLegend />
          </div>
        </div>
      </div>

      <div
        ref={chartRef}
        className="performance-plot__chart"
        role="group"
        aria-label={`Scatter plot of ${plottedRecords.length} ${
          showPaperMaximums ? "paper maxima" : "measurements"
        } by wavelength and specific detectivity. Use Tab to focus points.`}
      >
        <div className="performance-plot__region-labels" aria-hidden="true">
          {WAVELENGTH_REGIONS.map((region) => {
            const start = Math.max(region.start, domain.x[0]);
            const end = Math.min(region.end, domain.x[1]);
            if (end < start) return null;
            return (
              <span
                key={region.label}
                className="performance-plot__region-label"
                style={{
                  left: `${((start - domain.x[0]) / (domain.x[1] - domain.x[0])) * 100}%`,
                  width: `${((end - start) / (domain.x[1] - domain.x[0])) * 100}%`,
                }}
              >
                {region.label}
              </span>
            );
          })}
        </div>
        <ResponsiveContainer width="100%" height={560} minWidth={280}>
          <ScatterChart margin={{ top: 34, right: 42, bottom: 36, left: 16 }}>
            {WAVELENGTH_REGIONS.map((region) =>
              region.end >= domain.x[0] && region.start <= domain.x[1] ? (
                <ReferenceArea
                  key={region.label}
                  x1={Math.max(region.start, domain.x[0])}
                  x2={Math.min(region.end, domain.x[1])}
                  fill={region.fill}
                  fillOpacity={0.72}
                  strokeOpacity={0}
                />
              ) : null,
            )}
            <CartesianGrid strokeDasharray="1 0" vertical={false} />
            <XAxis
              type="number"
              dataKey="wavelength"
              domain={domain.x}
              ticks={domain.xTicks}
              tickFormatter={(value: number) => value.toLocaleString("en-US")}
              tick={{ fontWeight: 700 }}
              tickLine={false}
              name="Wavelength"
              label={{
                value: "Measurement wavelength (nm)",
                position: "insideBottom",
                offset: -18,
                className: "performance-plot__axis-label",
                fontSize: 15,
                fontWeight: 700,
              }}
            />
            <YAxis
              type="number"
              dataKey="detectivity"
              scale="log"
              domain={domain.y}
              ticks={domain.yTicks}
              allowDataOverflow
              tickFormatter={decadeLabel}
              tick={{ fontWeight: 700 }}
              tickLine={false}
              width={82}
              name="Specific detectivity"
              label={{
                value: "Specific detectivity, D* (Jones)",
                angle: -90,
                position: "insideLeft",
                offset: 6,
                className: "performance-plot__axis-label",
                fontSize: 15,
                fontWeight: 700,
              }}
            />
            <Tooltip
              content={AtlasTooltip}
              cursor={{ strokeDasharray: "2 3" }}
              isAnimationActive={false}
            />
            <Scatter
              data={data}
              shape={renderPoint}
              isAnimationActive="auto"
              name="CQD photodiode measurements"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
