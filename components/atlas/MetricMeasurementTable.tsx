"use client";

import Link from "next/link";
import {
  Fragment,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { atlasRecordsToCsv } from "@/lib/atlas/csv";
import {
  formatNoiseInstruments,
  formatNoiseMethod,
  formatNumber,
  formatScientific,
  formatWithUnit,
  humanizeCode,
  NOT_REPORTED,
} from "@/lib/atlas/format";
import { ldrValuePrefix } from "@/lib/atlas/metrics";
import { sortAtlasRecords } from "@/lib/atlas/sort";
import type {
  AtlasMeasurement,
  AtlasRecord,
  AtlasSortKey,
  AtlasSortState,
  AtlasTableView,
} from "@/lib/atlas/types";
import { DATASET_VERSION } from "@/lib/data";

import { AmberReasons, FlagBadge, ShotNoiseBadge } from "./AtlasBadges";
import { MaterialLabel } from "./MaterialLabel";

export interface MetricMeasurementTableProps {
  records: readonly AtlasRecord[];
  view: AtlasTableView;
  onViewChange: (view: AtlasTableView) => void;
}

interface TableViewOption {
  value: AtlasTableView;
  label: string;
  description: string;
}

const TABLE_VIEWS: readonly TableViewOption[] = [
  {
    value: "overview",
    label: "Overview",
    description: "Core detectivity conditions and public review state.",
  },
  {
    value: "optical",
    label: "Optical",
    description:
      "Responsivity, EQE, and linearity with metric-specific conditions kept separate from the D* row.",
  },
  {
    value: "speed",
    label: "Speed",
    description:
      "Reported response, rise, and fall times alongside explicit −3 dB bandwidth.",
  },
  {
    value: "methods",
    label: "Methods",
    description:
      "Noise, extraction, review, and source provenance for each record.",
  },
] as const;

const DEFAULT_SORT: Record<AtlasTableView, AtlasSortState> = {
  overview: { key: "detectivity", direction: "desc" },
  optical: { key: "responsivity", direction: "desc" },
  speed: { key: "response_time", direction: "asc" },
  methods: { key: "year", direction: "desc" },
};

const VIEW_SORT_KEYS: Record<AtlasTableView, readonly AtlasSortKey[]> = {
  overview: ["year", "material", "wavelength", "detectivity"],
  optical: ["year", "material", "wavelength", "responsivity", "eqe", "ldr"],
  speed: [
    "year",
    "material",
    "response_time",
    "rise_time",
    "fall_time",
    "bandwidth",
  ],
  methods: ["year"],
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  not_checked: "Not checked",
  checked: "Checked",
  source_unavailable: "Source unavailable",
  needs_review: "Needs review",
};

const EXTRACTION_METHOD_LABELS: Record<string, string> = {
  directly_reported: "Directly reported",
  graphically_extracted: "Graphically extracted",
  calculated_from_reported_values: "Calculated from reported values",
  not_reported: NOT_REPORTED,
  ambiguous: "Ambiguous extraction",
  unspecified: "Unspecified",
};

function isTableView(value: AtlasTableView): value is AtlasTableView {
  return TABLE_VIEWS.some((option) => option.value === value);
}

function nextSort(current: AtlasSortState, key: AtlasSortKey): AtlasSortState {
  if (current.key === key) {
    return {
      key,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }

  const ascendingByDefault = [
    "material",
    "response_time",
    "rise_time",
    "fall_time",
  ].includes(key);
  return { key, direction: ascendingByDefault ? "asc" : "desc" };
}

function ariaSort(
  sort: AtlasSortState,
  key: AtlasSortKey,
): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

function SortButton({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: AtlasSortKey;
  sort: AtlasSortState;
  onSort: (key: AtlasSortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <button
      className={`table-sort${active ? " table-sort--active" : ""}`}
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}${
        active
          ? `, currently ${sort.direction === "asc" ? "ascending" : "descending"}`
          : ""
      }`}
    >
      {label}
      <span aria-hidden="true">
        {active ? (sort.direction === "asc" ? " ↑" : " ↓") : " ↕"}
      </span>
    </button>
  );
}

function downloadCsv(records: readonly AtlasRecord[]): void {
  const blob = new Blob([atlasRecordsToCsv(records)], {
    type: "text/csv;charset=utf-8",
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `cqd-photodiode-atlas-v${DATASET_VERSION}-filtered.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

function reviewStatusLabel(status: string): string {
  return REVIEW_STATUS_LABELS[status] ?? humanizeCode(status);
}

function extractionMethodLabel(
  method: string | null,
  reviewStatus?: string,
): string {
  if (method) return EXTRACTION_METHOD_LABELS[method] ?? humanizeCode(method);
  return reviewStatus ? missingExtendedMetric(reviewStatus) : "Unspecified";
}

function missingExtendedMetric(
  reviewStatus: string,
  extractionMethod?: string | null,
): string {
  if (extractionMethod === "ambiguous") return "Ambiguous extraction";
  if (reviewStatus === "source_unavailable") return "Source unavailable";
  if (reviewStatus === "needs_review") return "Needs review";
  return reviewStatus === "checked" ? NOT_REPORTED : "Not checked";
}

function metricStatusClass(
  reviewStatus: string,
  extractionMethod?: string | null,
): string {
  if (extractionMethod === "ambiguous") return "ambiguous";
  if (reviewStatus === "source_unavailable") return "source-unavailable";
  if (reviewStatus === "needs_review") return "needs-review";
  return reviewStatus === "checked" ? "not-reported" : "not-checked";
}

function MetricDisplay({
  formattedValue,
  reviewStatus,
  extractionMethod,
}: {
  formattedValue: string | null;
  reviewStatus: string;
  extractionMethod?: string | null;
}) {
  if (formattedValue === null) {
    const statusClass = metricStatusClass(reviewStatus, extractionMethod);
    return (
      <span
        className={`measurement-table__metric-status measurement-table__metric-status--${statusClass}`}
      >
        {missingExtendedMetric(reviewStatus, extractionMethod)}
      </span>
    );
  }

  return (
    <span className="measurement-table__metric-value">
      <span>{formattedValue}</span>
      {extractionMethod === "ambiguous" ? (
        <small className="measurement-table__metric-note">
          Ambiguous extraction
        </small>
      ) : reviewStatus === "source_unavailable" ? (
        <small className="measurement-table__metric-note">
          Source unavailable · value unverified
        </small>
      ) : reviewStatus === "needs_review" ? (
        <small className="measurement-table__metric-note">Needs review</small>
      ) : null}
    </span>
  );
}

function compactNumber(value: number): string {
  const absolute = Math.abs(value);
  if (absolute !== 0 && (absolute < 0.001 || absolute >= 100_000)) {
    return formatScientific(value);
  }
  return formatNumber(value, { maximumSignificantDigits: 4 });
}

function formatDuration(value: number): string {
  const absolute = Math.abs(value);
  if (absolute === 0) return "0 s";
  if (absolute < 1e-6) return `${compactNumber(value * 1e9)} ns`;
  if (absolute < 1e-3) return `${compactNumber(value * 1e6)} µs`;
  if (absolute < 1) return `${compactNumber(value * 1e3)} ms`;
  return `${compactNumber(value)} s`;
}

function formatFrequency(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1e9) return `${compactNumber(value / 1e9)} GHz`;
  if (absolute >= 1e6) return `${compactNumber(value / 1e6)} MHz`;
  if (absolute >= 1e3) return `${compactNumber(value / 1e3)} kHz`;
  return `${compactNumber(value)} Hz`;
}

function boundPrefix(limit: string | null): string {
  if (limit === "lower_bound") return "≥";
  if (limit === "upper_bound") return "≤";
  return "";
}

function limitSuffix(limit: string | null): string {
  if (limit === "instrument_limited") return " (instrument-limited)";
  if (limit === "source_limited") return " (source-limited)";
  return "";
}

function formatTemporal(value: number, limit: string | null): string {
  return `${boundPrefix(limit)}${formatDuration(value)}${limitSuffix(limit)}`;
}

function formatBandwidth(value: number, limit: string | null): string {
  return `${boundPrefix(limit)}${formatFrequency(value)}${limitSuffix(limit)}`;
}

function formatLdr(record: AtlasRecord): string | null {
  const { measurement } = record;
  if (measurement.linearDynamicRangeDb !== null) {
    return `${ldrValuePrefix(record)}${compactNumber(
      measurement.linearDynamicRangeDb,
    )} dB`;
  }

  const minimum = measurement.linearDynamicRangeMin;
  const maximum = measurement.linearDynamicRangeMax;
  const unit = measurement.linearDynamicRangeUnits
    ? ` ${measurement.linearDynamicRangeUnits}`
    : "";
  if (minimum !== null && maximum !== null) {
    return `${compactNumber(minimum)}–${compactNumber(maximum)}${unit}`;
  }
  if (minimum !== null) return `≥${compactNumber(minimum)}${unit}`;
  if (maximum !== null) return `≤${compactNumber(maximum)}${unit}`;
  return null;
}

function conditionValue(
  label: string,
  value: number | null,
  unit: string,
  maximumFractionDigits = 3,
): string | null {
  return value === null
    ? null
    : `${label} ${formatWithUnit(value, unit, { maximumFractionDigits })}`;
}

function conditionLine(label: string, values: Array<string | null>): ReactNode {
  const reported = values.filter((value): value is string => value !== null);
  return (
    <span className="measurement-table__condition-line">
      <strong>{label}</strong>
      {reported.length ? reported.join(" · ") : "Conditions not reported"}
    </span>
  );
}

function definitionLine(label: string, value: string | null): ReactNode {
  return (
    <span className="measurement-table__condition-line">
      <strong>{label}</strong>
      {value || NOT_REPORTED}
    </span>
  );
}

function DstarConditions({ measurement }: { measurement: AtlasMeasurement }) {
  return conditionLine("D* row", [
    conditionValue("λ", measurement.wavelengthNm, "nm", 2),
    conditionValue("bias", measurement.biasV, "V", 4),
    conditionValue("T", measurement.temperatureK, "K", 2),
  ]);
}

function OpticalConditions({ measurement }: { measurement: AtlasMeasurement }) {
  return (
    <span className="measurement-table__conditions">
      {conditionLine("Responsivity", [
        conditionValue("λ", measurement.responsivityWavelengthNm, "nm", 2),
        conditionValue("bias", measurement.responsivityBiasV, "V", 4),
        conditionValue("T", measurement.responsivityTemperatureK, "K", 2),
      ])}
      {definitionLine(
        "LDR definition",
        measurement.linearDynamicRangeDefinition,
      )}
      <DstarConditions measurement={measurement} />
    </span>
  );
}

function SpeedConditions({ measurement }: { measurement: AtlasMeasurement }) {
  return (
    <span className="measurement-table__conditions">
      {conditionLine("Temporal", [
        conditionValue("λ", measurement.responseTimeWavelengthNm, "nm", 2),
        conditionValue("bias", measurement.responseTimeBiasV, "V", 4),
      ])}
      {definitionLine(
        "Temporal definition",
        measurement.responseTimeDefinition,
      )}
      {conditionLine("Bandwidth", [
        conditionValue("bias", measurement.bandwidthBiasV, "V", 4),
      ])}
      <DstarConditions measurement={measurement} />
    </span>
  );
}

function hasAmbiguousExtraction(measurement: AtlasMeasurement): boolean {
  return [
    measurement.responsivityExtractionMethod,
    measurement.responseTimeExtractionMethod,
    measurement.bandwidthExtractionMethod,
    measurement.linearDynamicRangeExtractionMethod,
  ].includes("ambiguous");
}

function ReviewStatus({ measurement }: { measurement: AtlasMeasurement }) {
  const status = measurement.extendedMetricsReviewStatus;
  const statusClass = metricStatusClass(status);
  return (
    <span className="measurement-table__review-status">
      <span
        className={`measurement-table__metric-status measurement-table__metric-status--${statusClass}`}
      >
        {reviewStatusLabel(status)}
      </span>
      {measurement.extendedMetricsReviewDate ? (
        <small>Reviewed {measurement.extendedMetricsReviewDate}</small>
      ) : null}
      {hasAmbiguousExtraction(measurement) ? (
        <small>Ambiguous extraction present</small>
      ) : null}
    </span>
  );
}

function MetricMethods({ measurement }: { measurement: AtlasMeasurement }) {
  const status = measurement.extendedMetricsReviewStatus;
  const methods = [
    ["Responsivity", measurement.responsivityExtractionMethod],
    ["Temporal", measurement.responseTimeExtractionMethod],
    ["Bandwidth", measurement.bandwidthExtractionMethod],
    ["LDR", measurement.linearDynamicRangeExtractionMethod],
  ] as const;

  return (
    <dl className="measurement-table__method-list">
      {methods.map(([label, method]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{extractionMethodLabel(method, status)}</dd>
        </div>
      ))}
    </dl>
  );
}

function sourceCount(measurement: AtlasMeasurement): number {
  return new Set(
    [
      measurement.sourceLocation,
      measurement.responsivitySourceLocation,
      measurement.responseTimeSourceLocation,
      measurement.bandwidthSourceLocation,
      measurement.linearDynamicRangeSourceLocation,
      measurement.noiseInstrumentSource,
    ].filter((source): source is string => Boolean(source)),
  ).size;
}

function PaperCell({
  record,
  expanded,
  detailsId,
  onToggle,
}: {
  record: AtlasRecord;
  expanded: boolean;
  detailsId: string;
  onToggle: () => void;
}) {
  const { paper, measurement } = record;
  const paperHref = `/papers/${encodeURIComponent(paper.paperId)}`;
  const detailHref = `/measurements/${encodeURIComponent(
    measurement.measurementId,
  )}`;

  return (
    <th
      scope="row"
      data-label="Paper"
      className="measurement-table__paper measurement-table__paper--primary"
    >
      <span className="measurement-table__paper-heading">
        <button
          className="measurement-table__expand"
          type="button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`${expanded ? "Collapse" : "Expand"} details for ${paper.title}`}
          onClick={onToggle}
        >
          <span aria-hidden="true">{expanded ? "−" : "+"}</span>
        </button>
        <Link className="measurement-table__paper-title" href={paperHref}>
          {paper.title}
        </Link>
      </span>
      <small>
        {paper.firstAuthor || NOT_REPORTED}, {paper.publicationYear}
      </small>
      <Link className="measurement-table__record-link" href={detailHref}>
        Measurement record
      </Link>
    </th>
  );
}

function MaterialCell({ record }: { record: AtlasRecord }) {
  return (
    <td data-label="Material">
      <MaterialLabel value={record.device.materialFamily} />
    </td>
  );
}

function OverviewCells({ record }: { record: AtlasRecord }) {
  const { measurement } = record;
  return (
    <>
      <MaterialCell record={record} />
      <td data-label="Wavelength">
        {formatWithUnit(measurement.wavelengthNm, "nm", {
          maximumFractionDigits: 2,
        })}
      </td>
      <td data-label="D*" className="measurement-table__dstar">
        {formatScientific(measurement.detectivityJones)} Jones
      </td>
      <td data-label="Temperature">
        {formatWithUnit(measurement.temperatureK, "K", {
          maximumFractionDigits: 2,
        })}
      </td>
      <td data-label="Bias">
        {formatWithUnit(measurement.biasV, "V", {
          maximumFractionDigits: 4,
        })}
      </td>
      <td data-label="Review flag" className="measurement-table__review-cell">
        <FlagBadge flag={measurement.flag} />
        <ReviewStatus measurement={measurement} />
      </td>
    </>
  );
}

function OpticalCells({ record }: { record: AtlasRecord }) {
  const { measurement } = record;
  return (
    <>
      <MaterialCell record={record} />
      <td data-label="Wavelength">
        {formatWithUnit(measurement.wavelengthNm, "nm", {
          maximumFractionDigits: 2,
        })}
      </td>
      <td data-label="Responsivity">
        <MetricDisplay
          formattedValue={
            measurement.responsivityAW === null
              ? null
              : `${compactNumber(measurement.responsivityAW)} A W⁻¹`
          }
          reviewStatus={measurement.extendedMetricsReviewStatus}
          extractionMethod={measurement.responsivityExtractionMethod}
        />
      </td>
      <td data-label="EQE">
        <MetricDisplay
          formattedValue={
            measurement.eqePercent === null
              ? null
              : `${compactNumber(measurement.eqePercent)}%`
          }
          reviewStatus={measurement.extendedMetricsReviewStatus}
        />
      </td>
      <td data-label="LDR">
        <MetricDisplay
          formattedValue={formatLdr(record)}
          reviewStatus={measurement.extendedMetricsReviewStatus}
          extractionMethod={measurement.linearDynamicRangeExtractionMethod}
        />
      </td>
      <td
        data-label="Metric conditions"
        className="measurement-table__conditions-cell"
      >
        <OpticalConditions measurement={measurement} />
      </td>
    </>
  );
}

function SpeedCells({ record }: { record: AtlasRecord }) {
  const { measurement } = record;
  return (
    <>
      <MaterialCell record={record} />
      <td data-label="Response time">
        <MetricDisplay
          formattedValue={
            measurement.responseTimeS === null
              ? null
              : formatTemporal(
                  measurement.responseTimeS,
                  measurement.responseTimeLimit,
                )
          }
          reviewStatus={measurement.extendedMetricsReviewStatus}
          extractionMethod={measurement.responseTimeExtractionMethod}
        />
      </td>
      <td data-label="Rise time">
        <MetricDisplay
          formattedValue={
            measurement.riseTimeS === null
              ? null
              : formatTemporal(
                  measurement.riseTimeS,
                  measurement.responseTimeLimit,
                )
          }
          reviewStatus={measurement.extendedMetricsReviewStatus}
          extractionMethod={measurement.responseTimeExtractionMethod}
        />
      </td>
      <td data-label="Fall time">
        <MetricDisplay
          formattedValue={
            measurement.fallTimeS === null
              ? null
              : formatTemporal(
                  measurement.fallTimeS,
                  measurement.responseTimeLimit,
                )
          }
          reviewStatus={measurement.extendedMetricsReviewStatus}
          extractionMethod={measurement.responseTimeExtractionMethod}
        />
      </td>
      <td data-label="Explicit −3 dB bandwidth">
        <MetricDisplay
          formattedValue={
            measurement.bandwidthHz === null
              ? null
              : formatBandwidth(
                  measurement.bandwidthHz,
                  measurement.bandwidthLimit,
                )
          }
          reviewStatus={measurement.extendedMetricsReviewStatus}
          extractionMethod={measurement.bandwidthExtractionMethod}
        />
      </td>
      <td
        data-label="Metric conditions"
        className="measurement-table__conditions-cell"
      >
        <SpeedConditions measurement={measurement} />
      </td>
    </>
  );
}

function MethodsCells({ record }: { record: AtlasRecord }) {
  const { measurement } = record;
  const evidenceCount = sourceCount(measurement);
  const detailHref = `/measurements/${encodeURIComponent(
    measurement.measurementId,
  )}`;
  return (
    <>
      <td data-label="Noise method">
        {formatNoiseMethod(measurement.noiseMethod)}
        <ShotNoiseBadge noiseMethod={measurement.noiseMethod} />
      </td>
      <td data-label="Noise instrument">
        {formatNoiseInstruments(measurement.noiseInstruments)}
      </td>
      <td data-label="D* extraction">
        {extractionMethodLabel(measurement.detectivityExtractionMethod)}
      </td>
      <td data-label="Extended review">
        <ReviewStatus measurement={measurement} />
      </td>
      <td data-label="Metric extraction methods">
        <MetricMethods measurement={measurement} />
      </td>
      <td
        data-label="Source and provenance"
        className="measurement-table__provenance-cell"
      >
        <span>
          {evidenceCount
            ? `${evidenceCount} evidence ${evidenceCount === 1 ? "location" : "locations"}`
            : missingExtendedMetric(measurement.extendedMetricsReviewStatus)}
        </span>
        <Link href={detailHref}>View provenance →</Link>
      </td>
    </>
  );
}

function TableHeaders({
  view,
  sort,
  onSort,
}: {
  view: AtlasTableView;
  sort: AtlasSortState;
  onSort: (key: AtlasSortKey) => void;
}) {
  return (
    <tr>
      <th scope="col" aria-sort={ariaSort(sort, "year")}>
        <SortButton label="Paper" sortKey="year" sort={sort} onSort={onSort} />
      </th>
      {view !== "methods" ? (
        <th scope="col" aria-sort={ariaSort(sort, "material")}>
          <SortButton
            label="Material"
            sortKey="material"
            sort={sort}
            onSort={onSort}
          />
        </th>
      ) : null}
      {view === "overview" ? (
        <>
          <th scope="col" aria-sort={ariaSort(sort, "wavelength")}>
            <SortButton
              label="Wavelength"
              sortKey="wavelength"
              sort={sort}
              onSort={onSort}
            />
          </th>
          <th scope="col" aria-sort={ariaSort(sort, "detectivity")}>
            <SortButton
              label="D*"
              sortKey="detectivity"
              sort={sort}
              onSort={onSort}
            />
          </th>
          <th scope="col">Temperature</th>
          <th scope="col">Bias</th>
          <th scope="col">Review flag</th>
        </>
      ) : null}
      {view === "optical" ? (
        <>
          <th scope="col" aria-sort={ariaSort(sort, "wavelength")}>
            <SortButton
              label="Wavelength"
              sortKey="wavelength"
              sort={sort}
              onSort={onSort}
            />
          </th>
          <th scope="col" aria-sort={ariaSort(sort, "responsivity")}>
            <SortButton
              label="Responsivity"
              sortKey="responsivity"
              sort={sort}
              onSort={onSort}
            />
          </th>
          <th scope="col" aria-sort={ariaSort(sort, "eqe")}>
            <SortButton label="EQE" sortKey="eqe" sort={sort} onSort={onSort} />
          </th>
          <th scope="col" aria-sort={ariaSort(sort, "ldr")}>
            <SortButton label="LDR" sortKey="ldr" sort={sort} onSort={onSort} />
          </th>
          <th scope="col">Metric conditions</th>
        </>
      ) : null}
      {view === "speed" ? (
        <>
          <th scope="col" aria-sort={ariaSort(sort, "response_time")}>
            <SortButton
              label="Response time"
              sortKey="response_time"
              sort={sort}
              onSort={onSort}
            />
          </th>
          <th scope="col" aria-sort={ariaSort(sort, "rise_time")}>
            <SortButton
              label="Rise time"
              sortKey="rise_time"
              sort={sort}
              onSort={onSort}
            />
          </th>
          <th scope="col" aria-sort={ariaSort(sort, "fall_time")}>
            <SortButton
              label="Fall time"
              sortKey="fall_time"
              sort={sort}
              onSort={onSort}
            />
          </th>
          <th scope="col" aria-sort={ariaSort(sort, "bandwidth")}>
            <SortButton
              label="Explicit −3 dB bandwidth"
              sortKey="bandwidth"
              sort={sort}
              onSort={onSort}
            />
          </th>
          <th scope="col">Metric conditions</th>
        </>
      ) : null}
      {view === "methods" ? (
        <>
          <th scope="col">Noise method</th>
          <th scope="col">Noise instrument</th>
          <th scope="col">D* extraction</th>
          <th scope="col">Extended review</th>
          <th scope="col">Metric extraction methods</th>
          <th scope="col">Source / provenance</th>
        </>
      ) : null}
    </tr>
  );
}

function DetailsContent({ record }: { record: AtlasRecord }) {
  const { device, measurement } = record;
  const detailHref = `/measurements/${encodeURIComponent(
    measurement.measurementId,
  )}`;
  const metricSource = (
    source: string | null,
    method?: string | null,
  ): string =>
    source ||
    missingExtendedMetric(measurement.extendedMetricsReviewStatus, method);

  return (
    <>
      <div className="measurement-table__details-grid">
        <div>
          <span>Absorber composition</span>
          <strong>{device.materialComposition || NOT_REPORTED}</strong>
        </div>
        <div>
          <span>Device architecture</span>
          <strong>{device.deviceArchitecture || NOT_REPORTED}</strong>
        </div>
        <div>
          <span>Device stack</span>
          <strong>{device.deviceStack || NOT_REPORTED}</strong>
        </div>
        <div>
          <span>Active area</span>
          <strong>{formatWithUnit(device.activeAreaCm2, "cm²")}</strong>
        </div>
        <div>
          <span>D* conditions</span>
          <strong>
            {[
              conditionValue("λ", measurement.wavelengthNm, "nm", 2),
              conditionValue("bias", measurement.biasV, "V", 4),
              conditionValue("T", measurement.temperatureK, "K", 2),
            ]
              .filter(Boolean)
              .join(" · ")}
          </strong>
        </div>
        <div>
          <span>Responsivity evidence</span>
          <strong>
            {metricSource(
              measurement.responsivitySourceLocation,
              measurement.responsivityExtractionMethod,
            )}
          </strong>
        </div>
        <div>
          <span>Temporal evidence</span>
          <strong>
            {metricSource(
              measurement.responseTimeSourceLocation,
              measurement.responseTimeExtractionMethod,
            )}
          </strong>
        </div>
        <div>
          <span>Bandwidth evidence</span>
          <strong>
            {metricSource(
              measurement.bandwidthSourceLocation,
              measurement.bandwidthExtractionMethod,
            )}
          </strong>
        </div>
        <div>
          <span>LDR evidence</span>
          <strong>
            {metricSource(
              measurement.linearDynamicRangeSourceLocation,
              measurement.linearDynamicRangeExtractionMethod,
            )}
          </strong>
        </div>
        <div>
          <span>D* extraction / source</span>
          <strong>
            {extractionMethodLabel(measurement.detectivityExtractionMethod)} ·{" "}
            {measurement.sourceLocation || NOT_REPORTED}
          </strong>
        </div>
        <div>
          <span>Noise instrument chain</span>
          <strong>
            {measurement.noiseInstrumentDetails ||
              formatNoiseInstruments(measurement.noiseInstruments)}
          </strong>
        </div>
        <div>
          <span>Extended-metrics review</span>
          <strong>
            {reviewStatusLabel(measurement.extendedMetricsReviewStatus)}
            {measurement.extendedMetricsReviewDate
              ? ` · ${measurement.extendedMetricsReviewDate}`
              : ""}
            {measurement.extendedMetricsNotes
              ? ` · ${measurement.extendedMetricsNotes}`
              : ""}
          </strong>
        </div>
      </div>
      <div className="measurement-table__details-actions">
        <div>
          <FlagBadge flag={measurement.flag} />
          <ShotNoiseBadge noiseMethod={measurement.noiseMethod} />
        </div>
        <AmberReasons measurement={measurement} compact />
        <Link href={detailHref}>View complete record →</Link>
      </div>
    </>
  );
}

export function MetricMeasurementTable({
  records,
  view,
  onViewChange,
}: MetricMeasurementTableProps) {
  const activeView = isTableView(view) ? view : "overview";
  const [sort, setSort] = useState<AtlasSortState>(DEFAULT_SORT[activeView]);
  const [expandedMeasurementId, setExpandedMeasurementId] = useState<string>();
  const activeSort = VIEW_SORT_KEYS[activeView].includes(sort.key)
    ? sort
    : DEFAULT_SORT[activeView];
  const sorted = useMemo(
    () => sortAtlasRecords(records, activeSort),
    [records, activeSort],
  );
  const currentViewOption = TABLE_VIEWS.find(
    (option) => option.value === activeView,
  )!;
  const sortBy = (key: AtlasSortKey) =>
    setSort((current) => {
      const base = VIEW_SORT_KEYS[activeView].includes(current.key)
        ? current
        : DEFAULT_SORT[activeView];
      return nextSort(base, key);
    });

  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % TABLE_VIEWS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + TABLE_VIEWS.length) % TABLE_VIEWS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TABLE_VIEWS.length - 1;
    }
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextView = TABLE_VIEWS[nextIndex].value;
    onViewChange(nextView);
    window.requestAnimationFrame(() => {
      document.getElementById(`measurement-table-tab-${nextView}`)?.focus();
    });
  };

  return (
    <section
      id="atlas-measurement-table"
      className="measurement-table-section metric-measurement-table"
      aria-labelledby="measurement-table-title"
    >
      <div className="measurement-table-section__heading">
        <div>
          <p className="section-kicker">Curated records</p>
          <h2 id="measurement-table-title">Measurement index</h2>
          <p>
            {records.length} filtered{" "}
            {records.length === 1 ? "record" : "records"}; expand a row for
            device and provenance details.
          </p>
          <p className="measurement-table-section__audit-note">
            Missing metrics retain their review state; unchecked and unavailable
            sources are not treated as zero.
          </p>
        </div>
        <button
          className="csv-download"
          type="button"
          onClick={() => downloadCsv(sorted)}
          disabled={!sorted.length}
          aria-label={`Download all fields for ${sorted.length} filtered ${
            sorted.length === 1 ? "record" : "records"
          } as CSV`}
        >
          Download filtered CSV
        </button>
      </div>

      <div className="measurement-table-views">
        <div
          className="measurement-table-views__tabs"
          role="tablist"
          aria-label="Measurement table view"
          aria-describedby="measurement-table-view-description"
        >
          {TABLE_VIEWS.map((option, index) => {
            const selected = option.value === activeView;
            return (
              <button
                key={option.value}
                id={`measurement-table-tab-${option.value}`}
                className={`measurement-table-views__tab${
                  selected ? " is-active" : ""
                }`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="measurement-table-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => onViewChange(option.value)}
                onKeyDown={(event) => moveTab(event, index)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p
          id="measurement-table-view-description"
          className="measurement-table-views__description"
        >
          {currentViewOption.description}
        </p>
      </div>

      <div
        id="measurement-table-panel"
        className={`measurement-table-views__panel measurement-table-views__panel--${activeView}`}
        role="tabpanel"
        aria-labelledby={`measurement-table-tab-${activeView}`}
      >
        <div
          className="measurement-table__scroll"
          role="region"
          aria-label={`${currentViewOption.label} measurement table`}
          tabIndex={0}
        >
          <table
            className={`measurement-table measurement-table--compact measurement-table--${activeView}`}
          >
            <caption className="sr-only">
              {currentViewOption.label} view of photodiode measurements matching
              the current filters
            </caption>
            <thead>
              <TableHeaders
                view={activeView}
                sort={activeSort}
                onSort={sortBy}
              />
            </thead>
            <tbody>
              {sorted.length ? (
                sorted.map((record, index) => {
                  const { measurement } = record;
                  const expanded =
                    expandedMeasurementId === measurement.measurementId;
                  const amber = measurement.flag === "amber";
                  const detailsId = `measurement-details-${index}-${measurement.measurementId.replace(
                    /[^a-zA-Z0-9_-]/g,
                    "-",
                  )}`;
                  return (
                    <Fragment key={measurement.measurementId}>
                      <tr
                        className={[
                          expanded ? "is-expanded" : "",
                          amber ? "is-amber" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <PaperCell
                          record={record}
                          expanded={expanded}
                          detailsId={detailsId}
                          onToggle={() =>
                            setExpandedMeasurementId(
                              expanded ? undefined : measurement.measurementId,
                            )
                          }
                        />
                        {activeView === "overview" ? (
                          <OverviewCells record={record} />
                        ) : null}
                        {activeView === "optical" ? (
                          <OpticalCells record={record} />
                        ) : null}
                        {activeView === "speed" ? (
                          <SpeedCells record={record} />
                        ) : null}
                        {activeView === "methods" ? (
                          <MethodsCells record={record} />
                        ) : null}
                      </tr>
                      {expanded ? (
                        <tr
                          className={`measurement-table__details-row${
                            amber ? " is-amber" : ""
                          }`}
                        >
                          <td colSpan={7} id={detailsId}>
                            <DetailsContent record={record} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="measurement-table__empty">
                    No measurements match the current filters. Adjust or reset
                    the filters to restore records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
