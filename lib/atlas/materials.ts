import { isMeasuredNoiseMethod } from "../data/constants.ts";
import { reviewedRecords } from "./review.ts";
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
  greenPaperCount: number;
  unverifiedPaperCount: number;
  amberPaperCount: number;
  frequencyMismatchPaperCount: number;
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
  for (const record of reviewedRecords(records)) {
    const material = record.device.materialFamily;
    const group = groups.get(material) ?? [];
    group.push(record);
    groups.set(material, group);
  }

  return [...groups.entries()]
    .map(([material, measurements]) => {
      const papers = new Map<string, AtlasRecord[]>();
      for (const record of measurements) {
        const paperMeasurements = papers.get(record.paper.paperId) ?? [];
        paperMeasurements.push(record);
        papers.set(record.paper.paperId, paperMeasurements);
      }

      const paperStatuses = [...papers.values()].map((paperMeasurements) => {
        const flags = new Set(
          paperMeasurements.map((record) => record.measurement.flag),
        );
        return flags.has("amber")
          ? "amber"
          : flags.has("unverified")
            ? "unverified"
            : "green";
      });
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
        paperCount: papers.size,
        measurementCount: count,
        greenPaperCount: paperStatuses.filter((status) => status === "green")
          .length,
        unverifiedPaperCount: paperStatuses.filter(
          (status) => status === "unverified",
        ).length,
        amberPaperCount: paperStatuses.filter((status) => status === "amber")
          .length,
        frequencyMismatchPaperCount: [...papers.values()].filter(
          (paperMeasurements) =>
            paperMeasurements.some(
              (record) =>
                record.measurement.frequencyMatchStatus === "not_matched",
            ),
        ).length,
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
