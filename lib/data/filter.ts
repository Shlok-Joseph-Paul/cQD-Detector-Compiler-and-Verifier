import type {
  AtlasFilters,
  AtlasSortField,
  BiasCondition,
  JoinedMeasurement,
  SortDirection,
  TemperatureCategory,
} from "./types.ts";
import { isMeasuredNoiseMethod } from "./constants.ts";

export function temperatureCategory(
  temperatureK: number | null,
): TemperatureCategory {
  if (temperatureK == null) return "not_reported";
  if (temperatureK < 273) return "below_room_temperature";
  if (temperatureK <= 323) return "room_temperature";
  return "elevated";
}

export function biasCondition(biasV: number | null): BiasCondition {
  if (biasV == null) return "not_reported";
  return Math.abs(biasV) <= 1e-12 ? "zero_bias" : "nonzero_bias";
}

function inRange(value: number, min?: number, max?: number): boolean {
  return (min == null || value >= min) && (max == null || value <= max);
}

function selected<T>(value: T, choices?: readonly T[]): boolean {
  return !choices?.length || choices.includes(value);
}

function searchableText(record: JoinedMeasurement): string {
  const { paper, device, measurement } = record;
  return [
    paper.title,
    paper.authors.join(" "),
    paper.first_author,
    paper.journal,
    paper.doi,
    device.material_family,
    device.material_composition,
    device.device_architecture,
    device.device_stack,
    measurement.noise_method,
    measurement.flag,
    measurement.amber_reasons.join(" "),
    measurement.amber_explanation,
    measurement.curator_notes,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase();
}

export function filterAtlasRecords(
  records: readonly JoinedMeasurement[],
  filters: AtlasFilters = {},
): JoinedMeasurement[] {
  const query = filters.search?.trim().toLocaleLowerCase() ?? "";
  return records.filter(({ paper, device, measurement }) => {
    if (
      !selected(device.material_family, filters.material_families) ||
      !inRange(
        measurement.wavelength_nm,
        filters.wavelength_nm?.min,
        filters.wavelength_nm?.max,
      ) ||
      !inRange(
        paper.publication_year,
        filters.publication_year?.min,
        filters.publication_year?.max,
      ) ||
      !selected(
        temperatureCategory(measurement.temperature_k),
        filters.temperature_categories,
      ) ||
      !selected(biasCondition(measurement.bias_v), filters.bias_conditions) ||
      !selected(measurement.noise_method, filters.noise_methods) ||
      !selected(measurement.flag, filters.flags) ||
      !selected(paper.publication_type, filters.publication_types)
    ) {
      return false;
    }
    return (
      !query || searchableText({ paper, device, measurement }).includes(query)
    );
  });
}

function sortValue(
  record: JoinedMeasurement,
  field: AtlasSortField,
): number | string {
  switch (field) {
    case "detectivity_jones":
      return record.measurement.detectivity_jones;
    case "wavelength_nm":
      return record.measurement.wavelength_nm;
    case "publication_year":
      return record.paper.publication_year;
    case "material_family":
      return record.device.material_family;
  }
}

export function sortAtlasRecords(
  records: readonly JoinedMeasurement[],
  field: AtlasSortField,
  direction: SortDirection = "asc",
): JoinedMeasurement[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return records
    .map((record, index) => ({ record, index }))
    .sort((left, right) => {
      const leftValue = sortValue(left.record, field);
      const rightValue = sortValue(right.record, field);
      const comparison =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), undefined, {
              sensitivity: "base",
              numeric: true,
            });
      return comparison === 0
        ? left.index - right.index
        : Math.sign(comparison) * multiplier;
    })
    .map(({ record }) => record);
}

export function filterAndSortAtlasRecords(
  records: readonly JoinedMeasurement[],
  filters: AtlasFilters,
  field: AtlasSortField,
  direction: SortDirection = "asc",
): JoinedMeasurement[] {
  return sortAtlasRecords(
    filterAtlasRecords(records, filters),
    field,
    direction,
  );
}

export interface MaterialSummary {
  material_family: string;
  paper_count: number;
  measurement_count: number;
  wavelength_min_nm: number;
  wavelength_max_nm: number;
  highest_detectivity_jones: number;
  measured_noise_percent: number;
  shot_noise_percent: number;
}

export function summarizeMaterials(
  records: readonly JoinedMeasurement[],
): MaterialSummary[] {
  const families = new Map<string, JoinedMeasurement[]>();
  for (const record of records) {
    const current = families.get(record.device.material_family) ?? [];
    current.push(record);
    families.set(record.device.material_family, current);
  }

  return [...families.entries()]
    .map(([material_family, materialRecords]) => {
      const wavelengths = materialRecords.map(
        (record) => record.measurement.wavelength_nm,
      );
      const detectivities = materialRecords.map(
        (record) => record.measurement.detectivity_jones,
      );
      const denominator = materialRecords.length;
      const measuredCount = materialRecords.filter((record) =>
        isMeasuredNoiseMethod(record.measurement.noise_method),
      ).length;
      const shotCount = materialRecords.filter(
        (record) =>
          record.measurement.noise_method === "shot_noise_approximation",
      ).length;
      return {
        material_family,
        paper_count: new Set(
          materialRecords.map((record) => record.paper.paper_id),
        ).size,
        measurement_count: denominator,
        wavelength_min_nm: Math.min(...wavelengths),
        wavelength_max_nm: Math.max(...wavelengths),
        highest_detectivity_jones: Math.max(...detectivities),
        measured_noise_percent: (measuredCount / denominator) * 100,
        shot_noise_percent: (shotCount / denominator) * 100,
      };
    })
    .sort((left, right) =>
      left.material_family.localeCompare(right.material_family, undefined, {
        sensitivity: "base",
        numeric: true,
      }),
    );
}
