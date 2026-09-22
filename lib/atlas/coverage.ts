import type { AtlasRecord } from "./types";
import { reviewedRecords } from "./review.ts";

export interface CoverageSlice {
  label: string;
  count: number;
  percent: number;
}

function percentage(count: number, total: number): number {
  return total ? Math.round((count / total) * 100) : 0;
}

export function maxDetectivityPerPaper(
  records: readonly AtlasRecord[],
): AtlasRecord[] {
  const bestByPaper = new Map<string, AtlasRecord>();

  for (const record of reviewedRecords(records)) {
    const detectivity = record.measurement.detectivityJones;
    if (detectivity == null) continue;
    const current = bestByPaper.get(record.paper.paperId);
    if (
      !current ||
      detectivity > (current.measurement.detectivityJones ?? -Infinity)
    ) {
      bestByPaper.set(record.paper.paperId, record);
    }
  }

  return [...bestByPaper.values()];
}

export function countBy<T>(
  values: readonly T[],
  labelFor: (value: T) => string,
): CoverageSlice[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = labelFor(value);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts]
    .map(([label, count]) => ({
      label,
      count,
      percent: percentage(count, values.length),
    }))
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label),
    );
}

export function reportingCoverage(records: readonly AtlasRecord[]) {
  const dStarRecords = records.filter(
    (record) => record.measurement.detectivityJones !== null,
  );
  const fields = [
    {
      label: "Temperature",
      records: dStarRecords,
      reported: dStarRecords.filter(
        (record) => record.measurement.temperatureK !== null,
      ).length,
    },
    {
      label: "Applied bias",
      records: dStarRecords,
      reported: dStarRecords.filter(
        (record) => record.measurement.biasV !== null,
      ).length,
    },
    {
      label: "Active area",
      records,
      reported: records.filter((record) => record.device.activeAreaCm2 !== null)
        .length,
    },
    {
      label: "Noise frequency",
      records: dStarRecords,
      reported: dStarRecords.filter(
        (record) => record.measurement.measurementFrequencyHz !== null,
      ).length,
    },
    {
      label: "Responsivity",
      records,
      reported: records.filter(
        (record) => record.measurement.responsivityAW !== null,
      ).length,
    },
    {
      label: "EQE",
      records,
      reported: records.filter(
        (record) => record.measurement.eqePercent !== null,
      ).length,
    },
    {
      label: "Any temporal response",
      records,
      reported: records.filter(
        (record) =>
          record.measurement.responseTimeS !== null ||
          record.measurement.riseTimeS !== null ||
          record.measurement.fallTimeS !== null,
      ).length,
    },
    {
      label: "Rise time",
      records,
      reported: records.filter(
        (record) => record.measurement.riseTimeS !== null,
      ).length,
    },
    {
      label: "Fall time",
      records,
      reported: records.filter(
        (record) => record.measurement.fallTimeS !== null,
      ).length,
    },
    {
      label: "Explicit −3 dB bandwidth",
      records,
      reported: records.filter(
        (record) => record.measurement.bandwidthHz !== null,
      ).length,
    },
    {
      label: "Linear dynamic range",
      records,
      reported: records.filter(
        (record) =>
          record.measurement.linearDynamicRangeDb !== null ||
          record.measurement.linearDynamicRangeMin !== null ||
          record.measurement.linearDynamicRangeMax !== null,
      ).length,
    },
    {
      label: "Extended-metrics review complete",
      records,
      reported: records.filter(
        (record) =>
          record.measurement.extendedMetricsReviewStatus === "checked",
      ).length,
    },
  ];

  return fields.map((field) => ({
    label: field.label,
    reported: field.reported,
    total: field.records.length,
    percent: percentage(field.reported, field.records.length),
  }));
}
