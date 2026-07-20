import { ATLAS_EXPORT_COLUMNS } from "../data/export.ts";
import { DATASET_VERSION } from "../data/releases.ts";
import type { AtlasRecord } from "./types";

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const raw = String(value);
  const serialized =
    typeof value === "string" && /^[=+@-]/.test(value) ? `'${raw}` : raw;
  return /[",\r\n]/.test(serialized)
    ? `"${serialized.replaceAll('"', '""')}"`
    : serialized;
}

/** Keep the browser export on the same canonical column contract as the data layer. */
export const ATLAS_CSV_COLUMNS = ATLAS_EXPORT_COLUMNS;

function csvRow(record: AtlasRecord): Array<string | number | null> {
  return [
    record.measurement.measurementId,
    record.paper.paperId,
    record.device.deviceId,
    record.device.materialFamily,
    record.device.materialComposition,
    record.device.deviceArchitecture,
    record.device.deviceStack,
    record.device.activeAreaCm2,
    record.measurement.wavelengthNm,
    record.measurement.detectivityJones.toExponential(),
    record.measurement.responsivityAW,
    record.measurement.responsivityWavelengthNm,
    record.measurement.responsivityBiasV,
    record.measurement.responsivityTemperatureK,
    record.measurement.responsivitySourceLocation,
    record.measurement.responsivityExtractionMethod,
    record.measurement.eqePercent,
    record.measurement.temperatureK,
    record.measurement.biasV,
    record.measurement.measurementFrequencyHz,
    record.measurement.responseTimeS,
    record.measurement.riseTimeS,
    record.measurement.fallTimeS,
    record.measurement.responseTimeDefinition,
    record.measurement.responseTimeWavelengthNm,
    record.measurement.responseTimeBiasV,
    record.measurement.responseTimeSourceLocation,
    record.measurement.responseTimeLimit,
    record.measurement.responseTimeExtractionMethod,
    record.measurement.bandwidthHz,
    record.measurement.bandwidthBiasV,
    record.measurement.bandwidthSourceLocation,
    record.measurement.bandwidthLimit,
    record.measurement.bandwidthExtractionMethod,
    record.measurement.linearDynamicRangeDb,
    record.measurement.linearDynamicRangeMin,
    record.measurement.linearDynamicRangeMax,
    record.measurement.linearDynamicRangeUnits,
    record.measurement.linearDynamicRangeDefinition,
    record.measurement.linearDynamicRangeSourceLocation,
    record.measurement.linearDynamicRangeExtractionMethod,
    record.measurement.extendedMetricsReviewStatus,
    record.measurement.extendedMetricsReviewDate,
    record.measurement.extendedMetricsNotes,
    record.measurement.noiseMethod,
    record.measurement.noiseInstruments.join("|"),
    record.measurement.noiseInstrumentDetails,
    record.measurement.noiseInstrumentSource,
    record.measurement.detectivityExtractionMethod,
    record.measurement.sourceLocation,
    record.measurement.curatorStatus,
    record.measurement.flag,
    record.measurement.amberReasons.join("|"),
    record.measurement.amberExplanation,
    record.measurement.curatorNotes,
    record.measurement.dateAdded,
    record.measurement.dateUpdated,
    record.paper.title,
    record.paper.authors.join("|"),
    record.paper.firstAuthor,
    record.paper.journal,
    record.paper.publicationYear,
    record.paper.doi,
    record.paper.publicationUrl,
    record.paper.publicationType,
    record.paper.peerReviewed ? "true" : "false",
    DATASET_VERSION,
  ];
}

/** Export the currently visible measurements, one measurement per CSV row. */
export function atlasRecordsToCsv(records: readonly AtlasRecord[]): string {
  const rows = [ATLAS_CSV_COLUMNS, ...records.map(csvRow)];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
