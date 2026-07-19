"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { atlasRecordsToCsv } from "@/lib/atlas/csv";
import {
  formatNoiseMethod,
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
  anchor.download = "cqd-photodiode-atlas-filtered.csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

export function MeasurementTable({ records }: MeasurementTableProps) {
  const [sort, setSort] = useState<AtlasSortState>({
    key: "detectivity",
    direction: "desc",
  });
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
          <h2 id="measurement-table-title">Measurement table</h2>
          <p>
            {records.length} filtered{" "}
            {records.length === 1 ? "record" : "records"}
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
        aria-label="Scrollable measurement table"
        tabIndex={0}
      >
        <table className="measurement-table">
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
              <th scope="col">CQD composition</th>
              <th scope="col">Device architecture</th>
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
              <th scope="col">Noise method</th>
              <th scope="col">Temperature</th>
              <th scope="col">Bias</th>
              <th scope="col">Response time</th>
              <th scope="col" aria-sort={ariaSort(sort, "year")}>
                <SortButton
                  label="Year"
                  sortKey="year"
                  sort={sort}
                  onSort={sortBy}
                />
              </th>
              <th scope="col">Flag and reasons</th>
              <th scope="col">Paper</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length ? (
              sorted.map(({ paper, device, measurement }) => {
                const detailHref = `/measurements/${encodeURIComponent(
                  measurement.measurementId,
                )}`;
                return (
                  <tr key={measurement.measurementId}>
                    <th scope="row">
                      <MaterialLabel value={device.materialFamily} />
                    </th>
                    <td>{device.materialComposition || NOT_REPORTED}</td>
                    <td>{device.deviceArchitecture || NOT_REPORTED}</td>
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
                    <td data-label="Noise method">
                      <span>{formatNoiseMethod(measurement.noiseMethod)}</span>
                      <ShotNoiseBadge noiseMethod={measurement.noiseMethod} />
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
                    <td data-label="Response time">
                      {measurement.responseTimeS === null
                        ? NOT_REPORTED
                        : `${formatScientific(measurement.responseTimeS)} s`}
                    </td>
                    <td data-label="Publication year">
                      {paper.publicationYear}
                    </td>
                    <td data-label="Flag and reasons">
                      <FlagBadge flag={measurement.flag} />
                      <AmberReasons measurement={measurement} compact />
                    </td>
                    <td data-label="Paper" className="measurement-table__paper">
                      <span>{paper.title}</span>
                      <small>
                        {paper.firstAuthor || NOT_REPORTED},{" "}
                        {paper.publicationYear}
                      </small>
                      <Link href={detailHref}>View record</Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={12} className="measurement-table__empty">
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
