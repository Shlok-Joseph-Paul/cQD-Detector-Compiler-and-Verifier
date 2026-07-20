import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildAtlasFromCsvTexts } from "../lib/data/atlas.ts";
import { parseCsv } from "../lib/data/csv.ts";
import type {
  AtlasEntities,
  Device,
  Measurement,
  Paper,
} from "../lib/data/types.ts";
import {
  applyAutomaticAmberRules,
  DataValidationError,
  validateAtlasEntities,
} from "../lib/data/validation.ts";
import { DATASET_VERSION } from "../lib/data/releases.ts";

const paper: Paper = {
  paper_id: "paper-1",
  title: "Synthetic test fixture",
  authors: ["Test author"],
  first_author: "Test author",
  journal: "Test journal",
  publication_year: 2025,
  doi: null,
  publication_url: null,
  publication_type: "journal_article",
  peer_reviewed: true,
  notes: null,
};

const device: Device = {
  device_id: "device-1",
  paper_id: paper.paper_id,
  material_family: "Test CQD",
  material_composition: null,
  device_architecture: "Test photodiode",
  device_stack: null,
  active_area_cm2: 0.01,
  device_notes: null,
};

const measurement: Measurement = {
  measurement_id: "measurement-1",
  device_id: device.device_id,
  wavelength_nm: 1000,
  detectivity_jones: 1e11,
  responsivity_a_w: null,
  eqe_percent: null,
  temperature_k: 295,
  bias_v: 0,
  measurement_frequency_hz: 100,
  response_time_s: null,
  bandwidth_hz: null,
  noise_method: "measured_noise",
  noise_instruments: ["spectrum_analyzer"],
  noise_instrument_details: "Test spectrum analyzer.",
  noise_instrument_source: "Table 1",
  detectivity_extraction_method: "directly_reported",
  source_location: "Table 1",
  curator_status: "reviewed",
  flag: "green",
  amber_reasons: [],
  amber_explanation: null,
  curator_notes: null,
  date_added: "2025-01-02",
  date_updated: "2025-01-02",
};

function entities(
  measurementOverrides: Partial<Measurement> = {},
): AtlasEntities {
  return {
    papers: [{ ...paper }],
    devices: [{ ...device }],
    measurements: [{ ...measurement, ...measurementOverrides }],
  };
}

test("the checked-in CSV dataset passes validation and joins every measurement", async () => {
  const dataDirectory = new URL("../data/", import.meta.url);
  const [papers, devices, measurements] = await Promise.all([
    readFile(new URL("papers.csv", dataDirectory), "utf8"),
    readFile(new URL("devices.csv", dataDirectory), "utf8"),
    readFile(new URL("measurements.csv", dataDirectory), "utf8"),
  ]);
  const atlas = buildAtlasFromCsvTexts({ papers, devices, measurements });
  assert.equal(atlas.schema_version, 3);
  assert.equal(atlas.dataset_version, DATASET_VERSION);
  assert.equal(atlas.measurements.length, 60);
  assert.equal(atlas.records.length, atlas.measurements.length);
  assert.ok(
    atlas.records.every(
      ({ paper: source }) =>
        source.publication_type === "journal_article" && source.peer_reviewed,
    ),
  );
  const amberRecords = atlas.records.filter(
    ({ measurement: point }) => point.flag === "amber",
  );
  assert.equal(amberRecords.length, 14);
  assert.equal(
    amberRecords.filter(({ measurement }) =>
      measurement.amber_reasons.includes("shot_noise_approximation"),
    ).length,
    7,
  );
  assert.equal(
    amberRecords.filter(({ measurement }) =>
      measurement.amber_reasons.includes("lock_in_only_noise_measurement"),
    ).length,
    7,
  );
  assert.equal(
    amberRecords.filter(({ measurement }) =>
      measurement.amber_reasons.includes(
        "source_measure_unit_noise_measurement",
      ),
    ).length,
    0,
  );
});

test("CSV parser handles BOMs, quoted commas, escaped quotes, CRLF, and multiline fields", () => {
  const parsed = parseCsv(
    '\ufeffid,title,notes\r\n1,"A, B","line one\r\nline ""two"""\r\n',
  );
  assert.deepEqual(parsed.headers, ["id", "title", "notes"]);
  assert.deepEqual(parsed.rows, [
    {
      row_number: 2,
      fields: ["1", "A, B", 'line one\nline "two"'],
    },
  ]);
});

test("schema validation rejects non-positive values and implausible years", () => {
  const invalid = entities({ wavelength_nm: 0, detectivity_jones: -2 });
  invalid.papers[0].publication_year = 1800;
  const result = validateAtlasEntities(invalid);
  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      ({ field, code }) => field === "wavelength_nm" && code === "not_positive",
    ),
  );
  assert.ok(
    result.issues.some(
      ({ field, code }) =>
        field === "detectivity_jones" && code === "not_positive",
    ),
  );
  assert.ok(
    result.issues.some(
      ({ field, code }) =>
        field === "publication_year" && code === "implausible_year",
    ),
  );
});

test("missing operating conditions do not make a reviewed record amber", () => {
  const result = validateAtlasEntities(
    entities({
      bias_v: null,
      measurement_frequency_hz: null,
      temperature_k: null,
      source_location: null,
      detectivity_extraction_method: "graphically_extracted",
    }),
  );
  assert.equal(result.valid, true);
});

test("a missing instrument citation does not make measured-noise data amber", () => {
  const result = validateAtlasEntities(
    entities({
      noise_instruments: ["not_reported"],
      noise_instrument_details:
        "Measured noise is reported, but the acquisition instrument is not identified.",
      noise_instrument_source: "Figure 4",
    }),
  );
  assert.equal(result.valid, true);
});

test("noise-instrument classifications remain consistent with the noise method", () => {
  const shotNoiseWithAnalyzer = validateAtlasEntities(
    entities({
      noise_method: "shot_noise_approximation",
      noise_instruments: ["spectrum_analyzer"],
    }),
  );
  assert.ok(
    shotNoiseWithAnalyzer.issues.some(
      ({ field, code }) =>
        field === "noise_instruments" &&
        code === "shot_noise_instrument_mismatch",
    ),
  );

  const measuredNoiseWithoutMeasurement = validateAtlasEntities(
    entities({ noise_instruments: ["not_applicable"] }),
  );
  assert.ok(
    measuredNoiseWithoutMeasurement.issues.some(
      ({ field, code }) =>
        field === "noise_instruments" &&
        code === "measured_noise_instrument_mismatch",
    ),
  );
});

test("automatic amber rules distinguish lock-in-only and SMU noise acquisition", () => {
  const lockInOnly = applyAutomaticAmberRules({
    ...measurement,
    noise_instruments: ["lock_in_amplifier"],
  });
  assert.equal(lockInOnly.flag, "amber");
  assert.deepEqual(lockInOnly.amber_reasons, [
    "lock_in_only_noise_measurement",
  ]);

  const mixedAcquisition = applyAutomaticAmberRules({
    ...measurement,
    noise_instruments: ["transient_current_fft", "lock_in_amplifier"],
  });
  assert.equal(mixedAcquisition.flag, "green");
  assert.deepEqual(mixedAcquisition.amber_reasons, []);

  const sourceMeasureUnit = applyAutomaticAmberRules({
    ...measurement,
    noise_instruments: ["dedicated_noise_analyzer", "source_measure_unit"],
  });
  assert.equal(sourceMeasureUnit.flag, "amber");
  assert.deepEqual(sourceMeasureUnit.amber_reasons, [
    "source_measure_unit_noise_measurement",
  ]);
});

test("shot-noise records are automatically amber and strict validation catches stale green input", () => {
  const shotNoise: Measurement = {
    ...measurement,
    noise_method: "shot_noise_approximation",
    noise_instruments: ["not_applicable"],
    noise_instrument_details: "Shot-noise approximation.",
  };
  const normalized = applyAutomaticAmberRules(shotNoise);
  assert.equal(normalized.flag, "amber");
  assert.deepEqual(normalized.amber_reasons, ["shot_noise_approximation"]);
  assert.match(normalized.amber_explanation ?? "", /shot-noise approximation/i);

  const staleResult = validateAtlasEntities({
    papers: [paper],
    devices: [device],
    measurements: [shotNoise],
  });
  assert.equal(staleResult.valid, false);
  assert.ok(
    staleResult.issues.some(
      ({ field, code }) => field === "flag" && code === "green_requirements",
    ),
  );
  assert.ok(
    staleResult.issues.some(
      ({ field, code }) =>
        field === "amber_reasons" && code === "missing_required_reason",
    ),
  );
});

test("amber records require both machine-readable reasons and human-readable context", () => {
  const result = validateAtlasEntities(
    entities({ flag: "amber", amber_reasons: [], amber_explanation: null }),
  );
  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      ({ field, code }) =>
        field === "amber_reasons" && code === "amber_reason_required",
    ),
  );
  assert.ok(
    result.issues.some(
      ({ field, code }) =>
        field === "amber_explanation" && code === "amber_explanation_required",
    ),
  );
});

test("a curator can mark a clearly anomalous BLIP comparison amber", () => {
  const result = validateAtlasEntities(
    entities({
      flag: "amber",
      amber_reasons: ["above_blip_limit"],
      amber_explanation:
        "Reported detectivity appears substantially above a plausible BLIP limit.",
    }),
  );
  assert.equal(result.valid, true);
});

test("foreign keys and duplicate measurement identifiers are rejected", () => {
  const invalid = entities();
  invalid.measurements.push({
    ...measurement,
    device_id: "device-does-not-exist",
  });
  const result = validateAtlasEntities(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some(({ code }) => code === "duplicate_id"));
  assert.ok(result.issues.some(({ code }) => code === "foreign_key"));
});

test("CSV conversion errors identify both the physical row and field", () => {
  const papers = [
    "paper_id,title,authors,first_author,journal,publication_year,doi,publication_url,publication_type,peer_reviewed,notes",
    "bad-paper,Test title,Test author,Test author,,not-a-year,,,journal_article,true,",
  ].join("\n");
  const devices =
    "device_id,paper_id,material_family,material_composition,device_architecture,device_stack,active_area_cm2,device_notes\n";
  const measurements =
    "measurement_id,device_id,wavelength_nm,detectivity_jones,responsivity_a_w,eqe_percent,temperature_k,bias_v,measurement_frequency_hz,response_time_s,bandwidth_hz,noise_method,noise_instruments,noise_instrument_details,noise_instrument_source,detectivity_extraction_method,source_location,curator_status,flag,amber_reasons,amber_explanation,curator_notes,date_added,date_updated\n";

  assert.throws(
    () => buildAtlasFromCsvTexts({ papers, devices, measurements }),
    (error) => {
      assert.ok(error instanceof DataValidationError);
      assert.match(error.message, /papers, row 2, field "publication_year"/);
      assert.match(error.message, /finite number/);
      return true;
    },
  );
});
