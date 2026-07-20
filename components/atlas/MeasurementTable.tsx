"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import { atlasRecordsToCsv } from "@/lib/atlas/csv";
import {
  formatNoiseMethod,
  formatNoiseInstruments,
  formatNumber,
  formatScientific,
  formatWithUnit,
  NOT_REPORTED,
} from "@/lib/atlas/format";
import { sortAtlasRecords } from "@/lib/atlas/sort";
import type {
  AtlasRecord,
  AtlasSortKey,
  AtlasSortState,
} from "@/lib/atlas/types";
import { DATASET_VERSION } from "@/lib/data";

import { AmberReasons, FlagBadge, ShotNoiseBadge } from "./AtlasBadges";
import { MaterialLabel } from "./MaterialLabel";

export interface MeasurementTableProps {
  records: readonly AtlasRecord[];
}

function nextSort(current: AtlasSortState, key: AtlasSortKey): AtlasSortState {
  if (current.key === key) {
    return {
      key,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }
  return {
    key,
    direction: key === "material" ? "asc" : "desc",
  };
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

function missingExtendedMetric(status: string): string {
  if (status === "source_unavailable") return "Source unavailable";
  if (status === "needs_review") return "Needs review";
  return status === "checked" ? NOT_REPORTED : "Not checked";
}

function compactMetric(
  value: number | null,
  unit: string,
  status: string,
): string {
  return value === null
    ? missingExtendedMetric(status)
    : `${formatScientific(value)} ${unit}`;
}

function compactBandwidth(record: AtlasRecord): string {
  const metric = record.measurement;
  if (metric.bandwidthHz === null)
    return missingExtendedMetric(metric.extendedMetricsReviewStatus);
  const prefix =
    metric.bandwidthLimit === "lower_bound"
      ? ">"
      : metric.bandwidthLimit === "upper_bound"
        ? "<"
        : "";
  return `${prefix}${formatScientific(metric.bandwidthHz)} Hz`;
}

function compactTemporal(record: AtlasRecord): string {
  const metric = record.measurement;
  if (metric.responseTimeS !== null)
    return `${formatScientific(metric.responseTimeS)} s`;
  const parts = [
    metric.riseTimeS === null
      ? null
      : `rise ${formatScientific(metric.riseTimeS)} s`,
    metric.fallTimeS === null
      ? null
      : `fall ${formatScientific(metric.fallTimeS)} s`,
  ].filter(Boolean);
  return parts.length
    ? parts.join(" / ")
    : missingExtendedMetric(metric.extendedMetricsReviewStatus);
}

function compactLdr(record: AtlasRecord): string {
  const metric = record.measurement;
  if (metric.linearDynamicRangeDb !== null)
    return `${formatNumber(metric.linearDynamicRangeDb, {
      maximumSignificantDigits: 4,
    })} dB`;
  if (
    metric.linearDynamicRangeMin !== null ||
    metric.linearDynamicRangeMax !== null
  ) {
    return `${formatNumber(metric.linearDynamicRangeMin)}–${formatNumber(
      metric.linearDynamicRangeMax,
    )} ${metric.linearDynamicRangeUnits ?? ""}`.trim();
  }
  return missingExtendedMetric(metric.extendedMetricsReviewStatus);
}

export function MeasurementTable({ records }: MeasurementTableProps) {
  const [sort, setSort] = useState<AtlasSortState>({
    key: "detectivity",
    direction: "desc",
  });
  const [expandedMeasurementId, setExpandedMeasurementId] = useState<string>();
  const sorted = useMemo(
    () => sortAtlasRecords(records, sort),
    [records, sort],
  );
  const sortBy = (key: AtlasSortKey) =>
    setSort((current) => nextSort(current, key));

  return (
    <section
      id="atlas-measurement-table"
      className="measurement-table-section"
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
            Extended metrics distinguish not checked from checked and not
            reported. Expand a row to inspect operating-condition matching and
            evidence locations.
          </p>
        </div>
        <button
          className="csv-download"
          type="button"
          onClick={() => downloadCsv(sorted)}
          disabled={!sorted.length}
        >
          Download filtered CSV
        </button>
      </div>

      <div
        className="measurement-table__scroll"
        role="region"
        aria-label="Measurement table"
        tabIndex={0}
      >
        <table className="measurement-table measurement-table--compact">
          <caption className="sr-only">
            CQD photodiode measurements matching the current filters
          </caption>
          <thead>
            <tr>
              <th scope="col" aria-sort={ariaSort(sort, "material")}>
                <SortButton
                  label="Material"
                  sortKey="material"
                  sort={sort}
                  onSort={sortBy}
                />
              </th>
              <th scope="col" aria-sort={ariaSort(sort, "wavelength")}>
                <SortButton
                  label="Wavelength"
                  sortKey="wavelength"
                  sort={sort}
                  onSort={sortBy}
                />
              </th>
              <th scope="col" aria-sort={ariaSort(sort, "detectivity")}>
                <SortButton
                  label="Detectivity"
                  sortKey="detectivity"
                  sort={sort}
                  onSort={sortBy}
                />
              </th>
              <th scope="col">Responsivity</th>
              <th scope="col">Temporal response</th>
              <th scope="col">−3 dB bandwidth</th>
              <th scope="col">LDR</th>
              <th scope="col">Noise method</th>
              <th scope="col">Noise instrument</th>
              <th scope="col">Temperature</th>
              <th scope="col" aria-sort={ariaSort(sort, "year")}>
                <SortButton
                  label="Paper"
                  sortKey="year"
                  sort={sort}
                  onSort={sortBy}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length ? (
              sorted.map(({ paper, device, measurement }) => {
                const detailHref = `/measurements/${encodeURIComponent(
                  measurement.measurementId,
                )}`;
                const expanded =
                  expandedMeasurementId === measurement.measurementId;
                const amber = measurement.flag === "amber";
                const detailsId = `${measurement.measurementId}-details`;
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
                      <th scope="row">
                        <button
                          className="measurement-table__expand"
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={detailsId}
                          onClick={() =>
                            setExpandedMeasurementId(
                              expanded ? undefined : measurement.measurementId,
                            )
                          }
                        >
                          <span aria-hidden="true">{expanded ? "−" : "+"}</span>
                          <MaterialLabel value={device.materialFamily} />
                        </button>
                      </th>
                      <td data-label="Wavelength">
                        {formatWithUnit(measurement.wavelengthNm, "nm", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        data-label="Detectivity"
                        className="measurement-table__dstar"
                      >
                        {formatScientific(measurement.detectivityJones)} Jones
                      </td>
                      <td data-label="Responsivity">
                        {compactMetric(
                          measurement.responsivityAW,
                          "A W⁻¹",
                          measurement.extendedMetricsReviewStatus,
                        )}
                      </td>
                      <td data-label="Temporal response">
                        {compactTemporal({ paper, device, measurement })}
                      </td>
                      <td data-label="−3 dB bandwidth">
                        {compactBandwidth({ paper, device, measurement })}
                      </td>
                      <td data-label="LDR">
                        {compactLdr({ paper, device, measurement })}
                      </td>
                      <td data-label="Noise method">
                        {formatNoiseMethod(measurement.noiseMethod)}
                      </td>
                      <td data-label="Noise instrument">
                        {formatNoiseInstruments(measurement.noiseInstruments)}
                      </td>
                      <td data-label="Temperature">
                        {formatWithUnit(measurement.temperatureK, "K", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        data-label="Paper"
                        className="measurement-table__paper"
                      >
                        <Link
                          className="measurement-table__paper-title"
                          href={`/papers/${encodeURIComponent(paper.paperId)}`}
                        >
                          {paper.title}
                        </Link>
                        <small>
                          {paper.firstAuthor || NOT_REPORTED},{" "}
                          {paper.publicationYear}
                        </small>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr
                        className={`measurement-table__details-row${
                          amber ? " is-amber" : ""
                        }`}
                      >
                        <td colSpan={11} id={detailsId}>
                          <div className="measurement-table__details-grid">
                            <div>
                              <span>CQD composition</span>
                              <strong>
                                {device.materialComposition || NOT_REPORTED}
                              </strong>
                            </div>
                            <div>
                              <span>Device architecture</span>
                              <strong>
                                {device.deviceArchitecture || NOT_REPORTED}
                              </strong>
                            </div>
                            <div>
                              <span>Bias</span>
                              <strong>
                                {formatWithUnit(measurement.biasV, "V", {
                                  maximumFractionDigits: 4,
                                })}
                              </strong>
                            </div>
                            <div>
                              <span>Response time</span>
                              <strong>
                                {measurement.responseTimeS === null
                                  ? NOT_REPORTED
                                  : `${formatScientific(measurement.responseTimeS)} s`}
                              </strong>
                            </div>
                            <div>
                              <span>Rise / fall time</span>
                              <strong>
                                {compactTemporal({
                                  paper,
                                  device,
                                  measurement,
                                })}
                              </strong>
                            </div>
                            <div>
                              <span>Responsivity evidence</span>
                              <strong>
                                {measurement.responsivitySourceLocation ||
                                  missingExtendedMetric(
                                    measurement.extendedMetricsReviewStatus,
                                  )}
                              </strong>
                            </div>
                            <div>
                              <span>Temporal-response evidence</span>
                              <strong>
                                {measurement.responseTimeSourceLocation ||
                                  missingExtendedMetric(
                                    measurement.extendedMetricsReviewStatus,
                                  )}
                              </strong>
                            </div>
                            <div>
                              <span>Instrument chain</span>
                              <strong>
                                {measurement.noiseInstrumentDetails ||
                                  NOT_REPORTED}
                              </strong>
                            </div>
                            <div>
                              <span>Instrument evidence</span>
                              <strong>
                                {measurement.noiseInstrumentSource ||
                                  NOT_REPORTED}
                              </strong>
                            </div>
                          </div>
                          <div className="measurement-table__details-actions">
                            <div>
                              <FlagBadge flag={measurement.flag} />
                              <ShotNoiseBadge
                                noiseMethod={measurement.noiseMethod}
                              />
                            </div>
                            <AmberReasons measurement={measurement} compact />
                            <Link href={detailHref}>
                              View complete record →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={11} className="measurement-table__empty">
                  No measurements match the current filters. Adjust or reset the
                  filters to restore records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
