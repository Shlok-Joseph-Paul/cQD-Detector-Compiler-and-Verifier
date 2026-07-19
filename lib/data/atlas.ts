import { parseAtlasCsvTexts } from "./parse.ts";
import { DATASET_VERSION } from "./releases.ts";
import type {
  AtlasData,
  AtlasEntities,
  CsvTexts,
  JoinedMeasurement,
} from "./types.ts";
import {
  assertValidAtlasEntities,
  DataValidationError,
  validateAtlasEntities,
} from "./validation.ts";

export function joinAtlasData(entities: AtlasEntities): JoinedMeasurement[] {
  assertValidAtlasEntities(entities);
  const devicesById = new Map(
    entities.devices.map((device) => [device.device_id, device]),
  );
  const papersById = new Map(
    entities.papers.map((paper) => [paper.paper_id, paper]),
  );

  return entities.measurements.map((measurement) => {
    const device = devicesById.get(measurement.device_id);
    if (!device) {
      throw new Error(`Missing validated device ${measurement.device_id}.`);
    }
    const paper = papersById.get(device.paper_id);
    if (!paper) throw new Error(`Missing validated paper ${device.paper_id}.`);
    return { paper, device, measurement };
  });
}

function deterministicGeneratedAt(
  measurements: AtlasEntities["measurements"],
): string {
  if (measurements.length === 0) return "1970-01-01T00:00:00.000Z";
  const latestDate = measurements.reduce(
    (latest, measurement) =>
      measurement.date_updated > latest ? measurement.date_updated : latest,
    measurements[0].date_updated,
  );
  return `${latestDate}T00:00:00.000Z`;
}

export function buildAtlasData(entities: AtlasEntities): AtlasData {
  assertValidAtlasEntities(entities);
  return {
    schema_version: 3,
    dataset_version: DATASET_VERSION,
    generated_at: deterministicGeneratedAt(entities.measurements),
    papers: entities.papers,
    devices: entities.devices,
    measurements: entities.measurements,
    records: joinAtlasData(entities),
  };
}

export function buildAtlasFromCsvTexts(texts: CsvTexts): AtlasData {
  const parsed = parseAtlasCsvTexts(texts);
  const runtimeValidation = validateAtlasEntities(parsed, parsed.sourceRows);
  const issues = [...parsed.issues, ...runtimeValidation.issues];
  if (issues.length > 0) throw new DataValidationError(issues);

  return buildAtlasData({
    papers: parsed.papers,
    devices: parsed.devices,
    measurements: parsed.measurements,
  });
}

export function serializeAtlasData(atlas: AtlasData): string {
  return `${JSON.stringify(atlas, null, 2)}\n`;
}
