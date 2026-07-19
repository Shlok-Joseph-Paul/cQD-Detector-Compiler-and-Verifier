import { isMeasuredNoiseMethod } from "../data/constants.ts";
import type { AtlasRecord } from "./types";

const KNOWN_MATERIAL_COLORS: Record<string, string> = {
  PbS: "#0072b2",
  PbSe: "#8c564b",
  HgTe: "#7a3e9d",
  HgSe: "#56b4e9",
  "Ag₂Se": "#e69f00",
  Ag2Se: "#e69f00",
  "Ag₂Te": "#009e73",
  Ag2Te: "#009e73",
  InAs: "#d55e00",
  InSb: "#cc79a7",
  "Perovskite CQDs": "#4f689f",
  "Other CQDs": "#59636e",
};

const FALLBACK_PALETTE = [
  "#0072b2",
  "#e69f00",
  "#009e73",
  "#7a3e9d",
  "#d55e00",
  "#56b4e9",
  "#cc79a7",
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
