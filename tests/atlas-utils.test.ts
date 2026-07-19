import assert from "node:assert/strict";
import test from "node:test";

import { atlasRecordsToCsv } from "../lib/atlas/csv.ts";
import {
  maxDetectivityPerPaper,
  reportingCoverage,
} from "../lib/atlas/coverage.ts";
import {
  DEFAULT_ATLAS_FILTERS,
  biasCondition,
  filterAtlasRecords,
  lockMaterialFilter,
  parseAtlasFilters,
  publicationCategory,
  serializeAtlasFilters,
  temperatureCategory,
} from "../lib/atlas/filters.ts";
import {
  formatAmberReason,
  formatScientific,
  formatWithUnit,
  NOT_REPORTED,
  publicationLinks,
} from "../lib/atlas/format.ts";
import { summarizeMaterials } from "../lib/atlas/materials.ts";
import { sortAtlasRecords } from "../lib/atlas/sort.ts";
import type { AtlasRecord } from "../lib/atlas/types.ts";

const measuredRecord: AtlasRecord = {
  paper: {
    paperId: "paper-1",
    title: 'A measured-noise paper, with "quoted" text',
    authors: ["Ada Researcher", "Sam Scientist"],
    firstAuthor: "Ada Researcher",
    journal: "Demonstration Journal",
    publicationYear: 2020,
    doi: "10.1234/demo.2020.1",
    publicationUrl: "https://example.test/publication/demo-1",
    publicationType: "journal_article",
    peerReviewed: true,
    notes: "Demonstration data—not a literature record",
  },
  device: {
    deviceId: "device-1",
    paperId: "paper-1",
    materialFamily: "PbS",
    materialComposition: "PbS CQDs",
    deviceArchitecture: "p–n photodiode",
    deviceStack: null,
    activeAreaCm2: 0.01,
    deviceNotes: null,
  },
  measurement: {
    measurementId: "measurement-1",
    deviceId: "device-1",
    wavelengthNm: 1000,
    detectivityJones: 1.2e12,
    responsivityAW: null,
    eqePercent: null,
    temperatureK: 300,
    biasV: 0,
    measurementFrequencyHz: 10,
    responseTimeS: null,
    bandwidthHz: null,
    noiseMethod: "measured_noise",
    detectivityExtractionMethod: "directly_reported",
    sourceLocation: "Demonstration only",
    curatorStatus: "reviewed",
    flag: "green",
    amberReasons: [],
    amberExplanation: null,
    curatorNotes: null,
    dateAdded: "2026-01-01",
    dateUpdated: "2026-01-01",
  },
};

const shotNoiseRecord: AtlasRecord = {
  paper: {
    ...measuredRecord.paper,
    paperId: "paper-2",
    title: "Cryogenic preprint demonstration",
    firstAuthor: "B. Example",
    publicationYear: 2024,
    publicationType: "preprint",
    peerReviewed: false,
  },
  device: {
    ...measuredRecord.device,
    deviceId: "device-2",
    paperId: "paper-2",
    materialFamily: "HgTe",
    materialComposition: "HgTe CQDs",
  },
  measurement: {
    ...measuredRecord.measurement,
    measurementId: "measurement-2",
    deviceId: "device-2",
    wavelengthNm: 5000,
    detectivityJones: 5e10,
    temperatureK: 80,
    biasV: -1,
    measurementFrequencyHz: null,
    noiseMethod: "shot_noise_approximation",
    flag: "amber",
    amberReasons: ["shot_noise_approximation"],
    amberExplanation: "Demonstration caution explanation.",
  },
};

const records = [measuredRecord, shotNoiseRecord];

test("filters measurements across scientific and publication dimensions", () => {
  assert.deepEqual(
    filterAtlasRecords(records, {
      ...DEFAULT_ATLAS_FILTERS,
      material: "HgTe",
      wavelengthMin: 4000,
      wavelengthMax: 6000,
      year: 2024,
      temperature: "below_room_temperature",
      bias: "nonzero_bias",
      noiseMethod: "shot_noise_approximation",
      flag: "amber",
      publicationType: "preprint",
    }).map((record) => record.measurement.measurementId),
    ["measurement-2"],
  );

  assert.equal(
    filterAtlasRecords(records, {
      ...DEFAULT_ATLAS_FILTERS,
      search: "ada researcher",
    })[0]?.measurement.measurementId,
    "measurement-1",
  );
  assert.equal(
    filterAtlasRecords(records, {
      ...DEFAULT_ATLAS_FILTERS,
      search: "10.1234/demo.2020.1",
    })[0]?.measurement.measurementId,
    "measurement-1",
  );
});

test("temperature and bias category boundaries include missing values", () => {
  assert.equal(temperatureCategory(272.9), "below_room_temperature");
  assert.equal(temperatureCategory(273), "room_temperature");
  assert.equal(temperatureCategory(323), "room_temperature");
  assert.equal(temperatureCategory(323.1), "elevated");
  assert.equal(temperatureCategory(null), "not_reported");
  assert.equal(biasCondition(0), "zero_bias");
  assert.equal(biasCondition(-0.5), "nonzero_bias");
  assert.equal(biasCondition(null), "not_reported");
});

test("URL filter state round-trips and preserves unrelated parameters", () => {
  const filters = {
    ...DEFAULT_ATLAS_FILTERS,
    search: "PbS diode",
    material: "PbS",
    wavelengthMin: 700,
    publicationType: "peer_reviewed" as const,
  };
  const params = serializeAtlasFilters(
    filters,
    new URLSearchParams("view=compact"),
  );
  assert.equal(params.get("view"), "compact");
  assert.deepEqual(parseAtlasFilters(params), filters);

  const legacy = parseAtlasFilters(
    new URLSearchParams("temperature=cryogenic&bias=biased"),
  );
  assert.equal(legacy.temperature, "below_room_temperature");
  assert.equal(legacy.bias, "nonzero_bias");
});

test("material-route constraints cannot be overridden by filter state", () => {
  const attempted = {
    ...DEFAULT_ATLAS_FILTERS,
    material: "HgTe",
    search: "detector",
  };
  assert.deepEqual(lockMaterialFilter(attempted, "PbS"), {
    ...attempted,
    material: "PbS",
  });
  assert.equal(lockMaterialFilter(attempted), attempted);
});

test("demonstration sources remain separate from preprints", () => {
  const demonstration: AtlasRecord = {
    ...measuredRecord,
    paper: {
      ...measuredRecord.paper,
      publicationType: "demonstration",
      peerReviewed: false,
    },
  };
  assert.equal(publicationCategory(demonstration), "demonstration");
  assert.equal(
    filterAtlasRecords([demonstration], {
      ...DEFAULT_ATLAS_FILTERS,
      publicationType: "preprint",
    }).length,
    0,
  );
});

test("sorting supports D*, wavelength, year, and material without mutation", () => {
  const original = [...records];
  assert.deepEqual(
    sortAtlasRecords(records, {
      key: "detectivity",
      direction: "desc",
    }).map((record) => record.measurement.measurementId),
    ["measurement-1", "measurement-2"],
  );
  assert.deepEqual(
    sortAtlasRecords(records, { key: "material", direction: "asc" }).map(
      (record) => record.device.materialFamily,
    ),
    ["HgTe", "PbS"],
  );
  assert.deepEqual(records, original);
});

test("scientific and missing-value formatting is explicit", () => {
  assert.equal(formatScientific(1.2e12), "1.20 × 10¹²");
  assert.equal(formatScientific(4.5e-6), "4.50 × 10⁻⁶");
  assert.equal(formatScientific(null), NOT_REPORTED);
  assert.equal(formatWithUnit(null, "K"), NOT_REPORTED);
  assert.match(formatAmberReason("shot_noise_approximation"), /shot-noise/i);
});

test("DOI and publication source links remain separately labeled data", () => {
  assert.deepEqual(
    publicationLinks(
      "https://doi.org/10.1234/example",
      "https://publisher.test/article",
    ),
    {
      doiUrl: "https://doi.org/10.1234/example",
      sourceUrl: "https://publisher.test/article",
    },
  );
  assert.deepEqual(publicationLinks(null, "https://archive.test/source"), {
    doiUrl: null,
    sourceUrl: "https://archive.test/source",
  });
});

test("filtered CSV is one measurement per row and safely escapes text", () => {
  const csv = atlasRecordsToCsv([measuredRecord]);
  const lines = csv.trimEnd().split("\r\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^measurement_id,paper_id,device_id/);
  assert.match(lines[0], /device_stack,active_area_cm2/);
  assert.match(lines[0], /responsivity_a_w,eqe_percent/);
  assert.match(lines[0], /source_location,curator_status/);
  assert.match(lines[0], /authors,first_author,journal/);
  assert.match(lines[0], /dataset_version$/);
  assert.match(lines[1], /,1\.0\.0$/);
  assert.match(lines[1], /measurement-1/);
  assert.match(lines[1], /1\.2e\+?12/);
  assert.match(lines[1], /Ada Researcher\|Sam Scientist/);
  assert.match(lines[1], /Demonstration only/);
  assert.match(lines[1], /"A measured-noise paper, with ""quoted"" text"/);
});

test("paper maxima retain exactly the highest-D* record per paper", () => {
  const higherMeasurement: AtlasRecord = {
    ...measuredRecord,
    measurement: {
      ...measuredRecord.measurement,
      measurementId: "measurement-3",
      detectivityJones: 2.4e12,
    },
  };
  assert.deepEqual(
    maxDetectivityPerPaper([
      measuredRecord,
      shotNoiseRecord,
      higherMeasurement,
    ]).map((record) => record.measurement.measurementId),
    ["measurement-3", "measurement-2"],
  );
});

test("reporting coverage counts nulls without treating zero as missing", () => {
  const coverage = reportingCoverage(records);
  assert.deepEqual(
    coverage.find((field) => field.label === "Applied bias"),
    { label: "Applied bias", reported: 2, total: 2, percent: 100 },
  );
  assert.deepEqual(
    coverage.find((field) => field.label === "Temperature"),
    { label: "Temperature", reported: 2, total: 2, percent: 100 },
  );
});

test("material summaries count unique papers and noise-method shares", () => {
  const duplicateMeasurement: AtlasRecord = {
    ...measuredRecord,
    measurement: {
      ...measuredRecord.measurement,
      measurementId: "measurement-3",
      wavelengthNm: 1200,
      detectivityJones: 2e12,
    },
  };
  const summary = summarizeMaterials([...records, duplicateMeasurement]);
  const pbs = summary.find((item) => item.material === "PbS");
  assert.deepEqual(pbs, {
    material: "PbS",
    paperCount: 1,
    measurementCount: 2,
    wavelengthMinNm: 1000,
    wavelengthMaxNm: 1200,
    highestDetectivityJones: 2e12,
    measuredNoisePercent: 100,
    shotNoisePercent: 0,
  });
});
