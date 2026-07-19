import type { AtlasRecord } from "./types";

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

  for (const record of records) {
    const current = bestByPaper.get(record.paper.paperId);
    if (
      !current ||
      record.measurement.detectivityJones > current.measurement.detectivityJones
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
  const fields = [
    {
      label: "Temperature",
      reported: records.filter(
        (record) => record.measurement.temperatureK !== null,
      ).length,
    },
    {
      label: "Applied bias",
      reported: records.filter((record) => record.measurement.biasV !== null)
        .length,
    },
    {
      label: "Active area",
      reported: records.filter((record) => record.device.activeAreaCm2 !== null)
        .length,
    },
    {
      label: "Noise frequency",
      reported: records.filter(
        (record) => record.measurement.measurementFrequencyHz !== null,
      ).length,
    },
    {
      label: "Responsivity",
      reported: records.filter(
        (record) => record.measurement.responsivityAW !== null,
      ).length,
    },
    {
      label: "EQE",
      reported: records.filter(
        (record) => record.measurement.eqePercent !== null,
      ).length,
    },
    {
      label: "Response time",
      reported: records.filter(
        (record) => record.measurement.responseTimeS !== null,
      ).length,
    },
  ];

  return fields.map((field) => ({
    ...field,
    total: records.length,
    percent: percentage(field.reported, records.length),
  }));
}
