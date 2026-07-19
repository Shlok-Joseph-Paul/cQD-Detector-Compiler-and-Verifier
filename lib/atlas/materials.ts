import { isMeasuredNoiseMethod } from "../data/constants.ts";
import type { AtlasRecord } from "./types";

const KNOWN_MATERIAL_COLORS: Record<string, string> = {
  PbS: "#245b78",
  PbSe: "#80542f",
  HgTe: "#6b4c8a",
  HgSe: "#32736d",
  "Ag₂Se": "#9a6d16",
  Ag2Se: "#9a6d16",
  InAs: "#a24b57",
  InSb: "#596d2f",
  "Perovskite CQDs": "#4f689f",
  "Other CQDs": "#59636e",
};

const FALLBACK_PALETTE = [
  "#245b78",
  "#80542f",
  "#6b4c8a",
  "#32736d",
  "#9a6d16",
  "#a24b57",
  "#596d2f",
  "#4f689f",
  "#59636e",
];

function stringHash(value: string): number {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

/** Return a stable color for known and future material families. */
export function materialColor(material: string): string {
  return (
    KNOWN_MATERIAL_COLORS[material] ??
    FALLBACK_PALETTE[stringHash(material) % FALLBACK_PALETTE.length]
  );
}

export interface MaterialSummary {
  material: string;
  paperCount: number;
  measurementCount: number;
  wavelengthMinNm: number;
  wavelengthMaxNm: number;
  highestDetectivityJones: number;
  measuredNoisePercent: number;
  shotNoisePercent: number;
}

/** Aggregate material cards directly from measurements; no counts are faked. */
export function summarizeMaterials(
  records: readonly AtlasRecord[],
): MaterialSummary[] {
  const groups = new Map<string, AtlasRecord[]>();
  for (const record of records) {
    const material = record.device.materialFamily;
    const group = groups.get(material) ?? [];
    group.push(record);
    groups.set(material, group);
  }

  return [...groups.entries()]
    .map(([material, measurements]) => {
      const wavelengths = measurements
        .map((record) => record.measurement.wavelengthNm)
        .filter(Number.isFinite);
      const detectivities = measurements
        .map((record) => record.measurement.detectivityJones)
        .filter(Number.isFinite);
      const count = measurements.length;
      const percent = (matching: number) =>
        count === 0 ? 0 : (matching / count) * 100;

      return {
        material,
        paperCount: new Set(measurements.map((record) => record.paper.paperId))
          .size,
        measurementCount: count,
        wavelengthMinNm: Math.min(...wavelengths),
        wavelengthMaxNm: Math.max(...wavelengths),
        highestDetectivityJones: Math.max(...detectivities),
        measuredNoisePercent: percent(
          measurements.filter((record) =>
            isMeasuredNoiseMethod(record.measurement.noiseMethod),
          ).length,
        ),
        shotNoisePercent: percent(
          measurements.filter(
            (record) =>
              record.measurement.noiseMethod === "shot_noise_approximation",
          ).length,
        ),
      };
    })
    .sort((left, right) => left.material.localeCompare(right.material));
}
