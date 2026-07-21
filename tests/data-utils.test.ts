import assert from "node:assert/strict";
import test from "node:test";
import { exportJoinedMeasurementsCsv } from "../lib/data/export.ts";
import {
  biasCondition,
  filterAtlasRecords,
  sortAtlasRecords,
  temperatureCategory,
} from "../lib/data/filter.ts";
import {
  formatMissingValue,
  formatScientificNotation,
} from "../lib/data/format.ts";
import type { JoinedMeasurement } from "../lib/data/types.ts";

const records: JoinedMeasurement[] = [
  {
    paper: {
      paper_id: "paper-b",
      title: 'Comma, quote "and export test"',
      authors: ["Example One", "Example Two"],
      first_author: "Example One",
      journal: null,
      publication_year: 2024,
      doi: null,
      publication_url: null,
      publication_type: "journal_article",
      peer_reviewed: true,
      notes: null,
    },
    device: {
      device_id: "device-b",
      paper_id: "paper-b",
      technology_family: "cqd",
      material_family: "Beta CQD",
      material_composition: null,
      device_architecture: "Vertical",
      device_stack: null,
      active_area_cm2: 0.02,
      device_notes: null,
    },
    measurement: {
      measurement_id: "measurement-b",
      device_id: "device-b",
      wavelength_nm: 1500,
      detectivity_jones: 2e10,
      responsivity_a_w: null,
      eqe_percent: null,
      temperature_k: null,
      bias_v: -1,
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
      date_added: "2025-01-01",
      date_updated: "2025-01-01",
    },
  },
  {
    paper: {
      paper_id: "paper-a",
      title: "Alpha test",
      authors: ["Researcher"],
      first_author: "Researcher",
      journal: null,
      publication_year: 2023,
      doi: null,
      publication_url: null,
      publication_type: "preprint",
      peer_reviewed: false,
      notes: null,
    },
    device: {
      device_id: "device-a",
      paper_id: "paper-a",
      technology_family: "cqd",
      material_family: "Alpha CQD",
      material_composition: "A",
      device_architecture: null,
      device_stack: null,
      active_area_cm2: 0.01,
      device_notes: null,
    },
    measurement: {
      measurement_id: "measurement-a",
      device_id: "device-a",
      wavelength_nm: 800,
      detectivity_jones: 9e11,
      responsivity_a_w: null,
      eqe_percent: null,
      temperature_k: 295,
      bias_v: 0,
      measurement_frequency_hz: 100,
      response_time_s: null,
      bandwidth_hz: null,
      noise_method: "shot_noise_approximation",
      noise_instruments: ["not_applicable"],
      noise_instrument_details: "Shot-noise approximation.",
      noise_instrument_source: "Page 2",
      detectivity_extraction_method: "directly_reported",
      source_location: "Page 2",
      curator_status: "reviewed",
      flag: "amber",
      amber_reasons: ["shot_noise_approximation"],
      amber_explanation: "Shot-noise estimate.",
      curator_notes: null,
      date_added: "2025-01-01",
      date_updated: "2025-01-01",
    },
  },
];

test("filtering supports search, scientific facets, and inclusive ranges", () => {
  assert.deepEqual(
    filterAtlasRecords(records, {
      search: "alpha",
      wavelength_nm: { min: 800, max: 1000 },
      temperature_categories: ["room_temperature"],
      bias_conditions: ["zero_bias"],
      noise_methods: ["shot_noise_approximation"],
      publication_types: ["preprint"],
    }).map((record) => record.measurement.measurement_id),
    ["measurement-a"],
  );
  assert.equal(temperatureCategory(null), "not_reported");
  assert.equal(temperatureCategory(100), "below_room_temperature");
  assert.equal(temperatureCategory(272.9), "below_room_temperature");
  assert.equal(temperatureCategory(323.1), "elevated");
  assert.equal(temperatureCategory(295), "room_temperature");
  assert.equal(biasCondition(null), "not_reported");
  assert.equal(biasCondition(0), "zero_bias");
  assert.equal(biasCondition(-0.5), "nonzero_bias");
});

test("sorting supports detectivity, wavelength, year, and material without mutating input", () => {
  const originalOrder = records.map(
    (record) => record.measurement.measurement_id,
  );
  assert.deepEqual(
    sortAtlasRecords(records, "detectivity_jones", "desc").map(
      (record) => record.measurement.measurement_id,
    ),
    ["measurement-a", "measurement-b"],
  );
  assert.deepEqual(
    sortAtlasRecords(records, "material_family", "asc").map(
      (record) => record.device.material_family,
    ),
    ["Alpha CQD", "Beta CQD"],
  );
  assert.deepEqual(
    records.map((record) => record.measurement.measurement_id),
    originalOrder,
  );
});

test("missing values display as Not reported and detectivity uses scientific notation", () => {
  assert.equal(formatMissingValue(null), "Not reported");
  assert.equal(formatMissingValue(0), "0");
  assert.equal(formatScientificNotation(null), "Not reported");
  assert.equal(formatScientificNotation(1.23e11), "1.23 × 10¹¹");
});

test("CSV export preserves null as blank, zero as zero, and quotes special text", () => {
  const csv = exportJoinedMeasurementsCsv(records);
  assert.match(csv, /"Comma, quote ""and export test"""/);
  assert.match(csv, /measurement-a/);
  assert.match(csv, /,0,100,/);
  assert.match(csv, /Example One\|Example Two/);
  assert.doesNotMatch(csv, /Not reported/);
});
