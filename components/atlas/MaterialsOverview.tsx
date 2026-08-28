"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";

import { formatScientific } from "@/lib/atlas/format";
import type { MaterialSummary } from "@/lib/atlas/materials";

import { MaterialLabel } from "./MaterialLabel";

type MaterialSortKey =
  | "material"
  | "papers"
  | "measurements"
  | "green"
  | "unverified"
  | "amber"
  | "frequencyMismatch"
  | "wavelength"
  | "detectivity";

type SortDirection = "asc" | "desc";

interface MaterialSortState {
  key: MaterialSortKey;
  direction: SortDirection;
}

const DEFAULT_SORT: MaterialSortState = {
  key: "papers",
  direction: "desc",
};

function sortValue(
  summary: MaterialSummary,
  key: MaterialSortKey,
): string | number {
  switch (key) {
    case "material":
      return summary.material;
    case "papers":
      return summary.paperCount;
    case "measurements":
      return summary.measurementCount;
    case "green":
      return summary.greenPaperCount;
    case "unverified":
      return summary.unverifiedPaperCount;
    case "amber":
      return summary.amberPaperCount;
    case "frequencyMismatch":
      return summary.frequencyMismatchPaperCount;
    case "wavelength":
      return summary.wavelengthMinNm;
    case "detectivity":
      return summary.highestDetectivityJones;
  }
}

function sortSummaries(
  summaries: readonly MaterialSummary[],
  sort: MaterialSortState,
): MaterialSummary[] {
  const multiplier = sort.direction === "asc" ? 1 : -1;
  return [...summaries].sort((left, right) => {
    const leftValue = sortValue(left, sort.key);
    const rightValue = sortValue(right, sort.key);
    const comparison =
      typeof leftValue === "string" && typeof rightValue === "string"
        ? leftValue.localeCompare(rightValue, undefined, {
            numeric: true,
            sensitivity: "base",
          })
        : Number(leftValue) - Number(rightValue);

    return comparison === 0
      ? left.material.localeCompare(right.material, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      : comparison * multiplier;
  });
}

function nextSort(
  current: MaterialSortState,
  key: MaterialSortKey,
): MaterialSortState {
  if (current.key === key) {
    return {
      key,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }
  return { key, direction: key === "material" ? "asc" : "desc" };
}

function ariaSort(
  sort: MaterialSortState,
  key: MaterialSortKey,
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
  sortKey: MaterialSortKey;
  sort: MaterialSortState;
  onSort: (key: MaterialSortKey) => void;
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

function statusPercent(count: number, total: number): string {
  return `${total ? (count / total) * 100 : 0}%`;
}

function TopMaterialsChart({
  summaries,
}: {
  summaries: readonly MaterialSummary[];
}) {
  const topMaterials = useMemo(
    () =>
      [...summaries]
        .sort(
          (left, right) =>
            right.paperCount - left.paperCount ||
            right.measurementCount - left.measurementCount ||
            left.material.localeCompare(right.material),
        )
        .slice(0, 10),
    [summaries],
  );
  const largestPaperCount = topMaterials[0]?.paperCount ?? 1;

  return (
    <figure className="materials-chart" aria-labelledby="materials-chart-title">
      <figcaption className="materials-chart__heading">
        <div>
          <p className="section-kicker">Publication coverage</p>
          <h2 id="materials-chart-title">Most-studied materials</h2>
          <p>
            Top ten absorber families by unique papers. Status uses the most
            cautious reviewed measurement in each paper.
          </p>
        </div>
        <div
          className="materials-chart__legend"
          aria-label="Paper status legend"
        >
          <span className="materials-chart__legend-item materials-chart__legend-item--green">
            Green
          </span>
          <span className="materials-chart__legend-item materials-chart__legend-item--unverified">
            Unverified
          </span>
          <span className="materials-chart__legend-item materials-chart__legend-item--amber">
            Amber
          </span>
        </div>
      </figcaption>

      <ol className="materials-chart__rows">
        {topMaterials.map((summary) => {
          const paperLabel = `${summary.paperCount} ${
            summary.paperCount === 1 ? "paper" : "papers"
          }`;
          return (
            <li key={summary.material}>
              <Link
                className="materials-chart__row"
                href={`/materials/${encodeURIComponent(summary.material)}`}
                aria-label={`${summary.material}: ${paperLabel}; ${summary.greenPaperCount} green, ${summary.unverifiedPaperCount} unverified, and ${summary.amberPaperCount} amber`}
              >
                <span className="materials-chart__label">
                  <MaterialLabel value={summary.material} />
                </span>
                <span className="materials-chart__plot" aria-hidden="true">
                  <span
                    className="materials-chart__bar"
                    style={
                      {
                        "--paper-share": `${
                          (summary.paperCount / largestPaperCount) * 100
                        }%`,
                      } as CSSProperties
                    }
                  >
                    <span
                      className="materials-chart__segment materials-chart__segment--green"
                      style={{
                        width: statusPercent(
                          summary.greenPaperCount,
                          summary.paperCount,
                        ),
                      }}
                    />
                    <span
                      className="materials-chart__segment materials-chart__segment--unverified"
                      style={{
                        width: statusPercent(
                          summary.unverifiedPaperCount,
                          summary.paperCount,
                        ),
                      }}
                    />
                    <span
                      className="materials-chart__segment materials-chart__segment--amber"
                      style={{
                        width: statusPercent(
                          summary.amberPaperCount,
                          summary.paperCount,
                        ),
                      }}
                    />
                  </span>
                </span>
                <strong className="materials-chart__total">
                  {summary.paperCount}
                </strong>
              </Link>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

export function MaterialsOverview({
  summaries,
}: {
  summaries: readonly MaterialSummary[];
}) {
  const [sort, setSort] = useState<MaterialSortState>(DEFAULT_SORT);
  const sorted = useMemo(
    () => sortSummaries(summaries, sort),
    [summaries, sort],
  );
  const sortBy = (key: MaterialSortKey) =>
    setSort((current) => nextSort(current, key));

  return (
    <section className="page-shell materials-overview">
      <TopMaterialsChart summaries={summaries} />

      <section
        className="materials-index"
        aria-labelledby="materials-index-title"
      >
        <div className="materials-index__heading">
          <div>
            <p className="section-kicker">All absorber families</p>
            <h2 id="materials-index-title">Material index</h2>
          </div>
          <p>
            {summaries.length} materials. Frequency mismatch is an overlapping
            subset of amber, not a separate review status.
          </p>
        </div>

        <div
          className="materials-table__scroll"
          role="region"
          aria-label="Sortable material summary table"
          tabIndex={0}
        >
          <table className="materials-table">
            <caption className="sr-only">
              Material families with paper-level review status counts and
              measurement ranges
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
                <th scope="col" aria-sort={ariaSort(sort, "papers")}>
                  <SortButton
                    label="Papers"
                    sortKey="papers"
                    sort={sort}
                    onSort={sortBy}
                  />
                </th>
                <th scope="col" aria-sort={ariaSort(sort, "measurements")}>
                  <SortButton
                    label="Measurements"
                    sortKey="measurements"
                    sort={sort}
                    onSort={sortBy}
                  />
                </th>
                <th scope="col" aria-sort={ariaSort(sort, "green")}>
                  <SortButton
                    label="Green"
                    sortKey="green"
                    sort={sort}
                    onSort={sortBy}
                  />
                </th>
                <th scope="col" aria-sort={ariaSort(sort, "unverified")}>
                  <SortButton
                    label="Unverified"
                    sortKey="unverified"
                    sort={sort}
                    onSort={sortBy}
                  />
                </th>
                <th scope="col" aria-sort={ariaSort(sort, "amber")}>
                  <SortButton
                    label="Amber"
                    sortKey="amber"
                    sort={sort}
                    onSort={sortBy}
                  />
                </th>
                <th scope="col" aria-sort={ariaSort(sort, "frequencyMismatch")}>
                  <SortButton
                    label="Frequency mismatch"
                    sortKey="frequencyMismatch"
                    sort={sort}
                    onSort={sortBy}
                  />
                </th>
                <th scope="col" aria-sort={ariaSort(sort, "wavelength")}>
                  <SortButton
                    label="Wavelength range"
                    sortKey="wavelength"
                    sort={sort}
                    onSort={sortBy}
                  />
                </th>
                <th scope="col" aria-sort={ariaSort(sort, "detectivity")}>
                  <SortButton
                    label="Highest D*"
                    sortKey="detectivity"
                    sort={sort}
                    onSort={sortBy}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((summary) => (
                <tr key={summary.material}>
                  <th scope="row">
                    <Link
                      href={`/materials/${encodeURIComponent(summary.material)}`}
                    >
                      <MaterialLabel value={summary.material} />
                      <span aria-hidden="true"> ↗</span>
                    </Link>
                  </th>
                  <td data-label="Papers">{summary.paperCount}</td>
                  <td data-label="Measurements">{summary.measurementCount}</td>
                  <td data-label="Green">
                    <span className="materials-table__status materials-table__status--green">
                      {summary.greenPaperCount}
                    </span>
                  </td>
                  <td data-label="Unverified">
                    <span className="materials-table__status materials-table__status--unverified">
                      {summary.unverifiedPaperCount}
                    </span>
                  </td>
                  <td data-label="Amber">
                    <span className="materials-table__status materials-table__status--amber">
                      {summary.amberPaperCount}
                    </span>
                  </td>
                  <td data-label="Frequency mismatch">
                    <span className="materials-table__status materials-table__status--frequency">
                      {summary.frequencyMismatchPaperCount}
                    </span>
                  </td>
                  <td
                    data-label="Wavelength range"
                    className="materials-table__range"
                  >
                    {summary.wavelengthMinNm.toLocaleString()}–
                    {summary.wavelengthMaxNm.toLocaleString()} nm
                  </td>
                  <td
                    data-label="Highest D*"
                    className="materials-table__detectivity"
                  >
                    {formatScientific(summary.highestDetectivityJones)} Jones
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
