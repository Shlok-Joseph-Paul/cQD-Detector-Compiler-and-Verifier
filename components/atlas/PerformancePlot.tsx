"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type ScatterPointItem,
  type TooltipContentProps,
} from "recharts";

import {
  formatAmberReason,
  formatCompactScientific,
  formatNoiseMethod,
  formatScientific,
  formatWithUnit,
  NOT_REPORTED,
} from "@/lib/atlas/format";
import { materialColor } from "@/lib/atlas/materials";
import type { AtlasRecord } from "@/lib/atlas/types";

import { MaterialLabel } from "./MaterialLabel";

interface PlotDatum {
  wavelength: number;
  detectivity: number;
  fill: string;
  record: AtlasRecord;
}

export interface PerformancePlotProps {
  records: readonly AtlasRecord[];
  selectedMeasurementId?: string;
  onSelect: (record: AtlasRecord) => void;
}

function plotDomain(records: readonly AtlasRecord[]): {
  x: [number, number];
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
    x: [Math.max(0, xMin - xPadding), xMax + xPadding],
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
  onSelect,
}: {
  point: ScatterPointItem;
  selectedMeasurementId?: string;
  onSelect: (record: AtlasRecord) => void;
}) {
  const datum = datumFromPoint(point);
  if (!datum || point.cx === undefined || point.cy === undefined) return null;
  const { measurement, device, paper } = datum.record;
  const selected = measurement.measurementId === selectedMeasurementId;
  const isShotNoise = measurement.noiseMethod === "shot_noise_approximation";
  const isMeasuredNoise = measurement.noiseMethod === "measured_noise";
  const stroke = measurement.flag === "green" ? "#17633f" : "#a95d00";
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
    strokeWidth: selected ? 4 : 2.5,
    strokeDasharray: measurement.flag === "amber" ? "3 2" : undefined,
    vectorEffect: "non-scaling-stroke" as const,
  };

  return (
    <g
      className={`atlas-point atlas-point--${measurement.flag}${
        selected ? " atlas-point--selected" : ""
      }`}
      role="button"
      tabIndex={0}
      aria-label={accessibleLabel}
      aria-pressed={selected}
      onClick={activate}
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
          r="10"
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          opacity="0.5"
        />
      ) : null}
      {isShotNoise ? (
        <path
          d={`M ${point.cx} ${point.cy - 6} L ${point.cx + 6} ${point.cy} L ${
            point.cx
          } ${point.cy + 6} L ${point.cx - 6} ${point.cy} Z`}
          {...common}
        />
      ) : isMeasuredNoise ? (
        <circle cx={point.cx} cy={point.cy} r="5.5" {...common} />
      ) : (
        <rect
          x={point.cx - 5}
          y={point.cy - 5}
          width="10"
          height="10"
          rx="1"
          {...common}
        />
      )}
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
      <strong>{paper.title}</strong>
      <dl>
        <div>
          <dt>First author</dt>
          <dd>{paper.firstAuthor || NOT_REPORTED}</dd>
        </div>
        <div>
          <dt>Architecture</dt>
          <dd>{device.deviceArchitecture || NOT_REPORTED}</dd>
        </div>
        <div>
          <dt>Wavelength</dt>
          <dd>{formatWithUnit(measurement.wavelengthNm, "nm")}</dd>
        </div>
        <div>
          <dt>D*</dt>
          <dd>{formatScientific(measurement.detectivityJones)} Jones</dd>
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
      <small>Click the point for links and full context.</small>
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
        <i className="plot-marker plot-marker--diamond" aria-hidden="true" />
        Shot-noise estimate
      </span>
      <span>
        <i className="plot-marker plot-marker--square" aria-hidden="true" />
        Other / unspecified noise
      </span>
      <span className="plot-legend__flag plot-legend__flag--green">Green</span>
      <span className="plot-legend__flag plot-legend__flag--amber">Amber</span>
    </div>
  );
}

export function PerformancePlot({
  records,
  selectedMeasurementId,
  onSelect,
}: PerformancePlotProps) {
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

  const domain = plotDomain(validRecords);
  const data: PlotDatum[] = validRecords.map((record) => ({
    wavelength: record.measurement.wavelengthNm,
    detectivity: record.measurement.detectivityJones,
    fill: materialColor(record.device.materialFamily),
    record,
  }));
  const materials = [
    ...new Set(validRecords.map((record) => record.device.materialFamily)),
  ].sort((left, right) => left.localeCompare(right));

  const renderPoint = (point: ScatterPointItem) => (
    <AtlasPoint
      point={point}
      selectedMeasurementId={selectedMeasurementId}
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
          <p className="section-kicker">Detectivity landscape</p>
          <h2 id="performance-plot-title">Performance map</h2>
        </div>
        <p>One point per reported measurement · logarithmic D* axis</p>
      </div>

      <div
        className="performance-plot__chart"
        role="group"
        aria-label={`Scatter plot of ${validRecords.length} measurements by wavelength and specific detectivity. Use Tab to focus points.`}
      >
        <ResponsiveContainer width="100%" height={460} minWidth={280}>
          <ScatterChart margin={{ top: 20, right: 24, bottom: 28, left: 10 }}>
            <CartesianGrid strokeDasharray="2 4" vertical={false} />
            <XAxis
              type="number"
              dataKey="wavelength"
              domain={domain.x}
              tickFormatter={(value: number) => value.toLocaleString("en-US")}
              tickLine={false}
              name="Wavelength"
              unit=" nm"
              label={{
                value: "Measurement wavelength (nm)",
                position: "insideBottom",
                offset: -18,
              }}
            />
            <YAxis
              type="number"
              dataKey="detectivity"
              scale="log"
              domain={domain.y}
              ticks={domain.yTicks}
              allowDataOverflow
              tickFormatter={(value: number) => formatCompactScientific(value)}
              tickLine={false}
              width={76}
              name="Specific detectivity"
              unit=" Jones"
              label={{
                value: "Specific detectivity, D* (Jones)",
                angle: -90,
                position: "insideLeft",
                offset: 6,
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

      <div className="plot-legend">
        <div className="plot-legend__materials" aria-label="Material colors">
          {materials.map((material) => (
            <span key={material}>
              <i
                aria-hidden="true"
                style={{ backgroundColor: materialColor(material) }}
              />
              <MaterialLabel value={material} />
            </span>
          ))}
        </div>
        <MarkerLegend />
      </div>
    </section>
  );
}
