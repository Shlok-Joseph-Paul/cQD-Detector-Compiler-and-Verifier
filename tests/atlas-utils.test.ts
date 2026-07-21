import assert from "node:assert/strict";
import test from "node:test";

import { atlasRecordsToCsv } from "../lib/atlas/csv.ts";
import { DATASET_VERSION } from "../lib/data/releases.ts";
import {
  maxDetectivityPerPaper,
  reportingCoverage,
} from "../lib/atlas/coverage.ts";
import {
  DEFAULT_ATLAS_FILTERS,
  biasCondition,
  clearMetricFilters,
  filterAtlasRecords,
  lockMaterialFilter,
  normalizeMetricFilterValue,
  parseAtlasFilters,
  publicationCategory,
  resetAtlasFilterCriteria,
  serializeAtlasFilters,
  temperatureCategory,
} from "../lib/atlas/filters.ts";
import {
  ATLAS_METRICS,
  ATLAS_PLOT_PRESETS,
  availablePlotPresets,
  isPlottableMetricValue,
  ldrValuePrefix,
  metricConditionSummary,
  metricDefinitionSummary,
  metricEvidenceSummary,
  metricLimitLabel,
  recordsForPlotScope,
  recordsWithMetricPair,
} from "../lib/atlas/metrics.ts";
import {
  formatAmberReason,
  formatScientific,
  formatWithUnit,
  NOT_REPORTED,
  publicationLinks,
} from "../lib/atlas/format.ts";
import { summarizeMaterials } from "../lib/atlas/materials.ts";
import { sortAtlasRecords } from "../lib/atlas/sort.ts";
import type {
  AtlasFilterState,
  AtlasRecord,
  AtlasSortKey,
} from "../lib/atlas/types.ts";

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
    technologyFamily: "cqd",
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
    responsivityWavelengthNm: null,
    responsivityBiasV: null,
    responsivityTemperatureK: null,
    responsivitySourceLocation: null,
    responsivityExtractionMethod: null,
    eqePercent: null,
    temperatureK: 300,
    biasV: 0,
    measurementFrequencyHz: 10,
    responseTimeS: null,
    riseTimeS: null,
    fallTimeS: null,
    responseTimeDefinition: null,
    responseTimeWavelengthNm: null,
    responseTimeBiasV: null,
    responseTimeSourceLocation: null,
    responseTimeLimit: null,
    responseTimeExtractionMethod: null,
    bandwidthHz: null,
    bandwidthBiasV: null,
    bandwidthSourceLocation: null,
    bandwidthLimit: null,
    bandwidthExtractionMethod: null,
    linearDynamicRangeDb: null,
    linearDynamicRangeMin: null,
    linearDynamicRangeMax: null,
    linearDynamicRangeUnits: null,
    linearDynamicRangeDefinition: null,
    linearDynamicRangeSourceLocation: null,
    linearDynamicRangeExtractionMethod: null,
    extendedMetricsReviewStatus: "not_checked",
    extendedMetricsReviewDate: null,
    extendedMetricsNotes: null,
    noiseMethod: "measured_noise",
    noiseInstruments: ["spectrum_analyzer"],
    noiseInstrumentDetails: "Test spectrum analyzer.",
    noiseInstrumentSource: "Test methods",
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
    noiseInstruments: ["not_applicable"],
    noiseInstrumentDetails: "Shot-noise approximation.",
    noiseInstrumentSource: "Test methods",
    flag: "amber",
    amberReasons: ["shot_noise_approximation"],
    amberExplanation: "Demonstration caution explanation.",
  },
};

const records = [measuredRecord, shotNoiseRecord];

function recordWithMeasurement(
  measurementId: string,
  measurement: Partial<AtlasRecord["measurement"]>,
): AtlasRecord {
  const paperId = `paper-${measurementId}`;
  const deviceId = `device-${measurementId}`;
  return {
    paper: {
      ...measuredRecord.paper,
      paperId,
      title: `Fixture ${measurementId}`,
    },
    device: {
      ...measuredRecord.device,
      deviceId,
      paperId,
    },
    measurement: {
      ...measuredRecord.measurement,
      measurementId,
      deviceId,
      ...measurement,
    },
  };
}

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

  const perovskiteRecord: AtlasRecord = {
    ...measuredRecord,
    device: {
      ...measuredRecord.device,
      technologyFamily: "perovskite",
      materialFamily: "MAPbI3",
    },
  };
  assert.deepEqual(
    filterAtlasRecords([measuredRecord, perovskiteRecord], {
      ...DEFAULT_ATLAS_FILTERS,
      technology: "perovskite",
    }).map((record) => record.device.technologyFamily),
    ["perovskite"],
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
    technology: "perovskite" as const,
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
  assert.match(
    lines[0],
    /responsivity_a_w,responsivity_wavelength_nm.*responsivity_extraction_method,eqe_percent/,
  );
  assert.match(
    lines[0],
    /noise_instruments,noise_instrument_details,noise_instrument_source/,
  );
  assert.match(lines[0], /source_location,curator_status/);
  assert.match(lines[0], /authors,first_author,journal/);
  assert.match(lines[0], /dataset_version$/);
  assert.ok(lines[1].endsWith(`,${DATASET_VERSION}`));
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

test("extended explorer URL state round-trips with explicit units", () => {
  const filters: AtlasFilterState = {
    ...DEFAULT_ATLAS_FILTERS,
    hasResponsivity: true,
    hasEqe: true,
    hasTemporal: true,
    hasRiseTime: true,
    hasFallTime: true,
    hasBandwidth: true,
    hasLdr: true,
    extendedReview: "checked",
    ambiguousExtraction: true,
    responsivityMin: 0,
    eqeMin: 12.5,
    responseTimeMaxS: 1e-6,
    riseTimeMaxS: 2e-6,
    fallTimeMaxS: 3e-6,
    bandwidthMinHz: 1e6,
    ldrMinDb: 80,
    plotMode: "compare_metrics",
    plotX: "bandwidth",
    plotY: "responsivity",
    plotScope: "all_measurements",
    tableView: "speed",
  };
  const params = serializeAtlasFilters(
    filters,
    new URLSearchParams(
      "view=compact&responsivityMin=99&eqeMin=99&unrelated=kept",
    ),
  );

  assert.equal(params.get("view"), "compact");
  assert.equal(params.get("unrelated"), "kept");
  assert.equal(params.get("responsivityMin"), null);
  assert.equal(params.get("eqeMin"), null);
  assert.equal(params.get("responsivityMinAW"), "0");
  assert.equal(params.get("eqeMinPercent"), "12.5");
  assert.deepEqual(parseAtlasFilters(params), filters);
});

test("invalid explorer URL values fall back safely and duplicate axes are repaired", () => {
  const invalid = parseAtlasFilters(
    new URLSearchParams(
      [
        "plot=not-a-mode",
        "xMetric=not-a-metric",
        "yMetric=also-not-a-metric",
        "scope=not-a-scope",
        "table=not-a-view",
        "extendedReview=not-a-status",
        "responsivityMinAW=-1",
        "eqeMinPercent=NaN",
        "responseMaxS=-0.1",
        "bandwidthMinHz=-5",
        "ldrMinDb=-2",
      ].join("&"),
    ),
  );

  assert.equal(invalid.plotMode, DEFAULT_ATLAS_FILTERS.plotMode);
  assert.equal(invalid.plotX, DEFAULT_ATLAS_FILTERS.plotX);
  assert.equal(invalid.plotY, DEFAULT_ATLAS_FILTERS.plotY);
  assert.equal(invalid.plotScope, DEFAULT_ATLAS_FILTERS.plotScope);
  assert.equal(invalid.tableView, DEFAULT_ATLAS_FILTERS.tableView);
  assert.equal(invalid.extendedReview, "all");
  assert.equal(invalid.responsivityMin, undefined);
  assert.equal(invalid.eqeMin, undefined);
  assert.equal(invalid.responseTimeMaxS, undefined);
  assert.equal(invalid.bandwidthMinHz, undefined);
  assert.equal(invalid.ldrMinDb, undefined);

  const duplicateBandwidth = parseAtlasFilters(
    new URLSearchParams("xMetric=bandwidth&yMetric=bandwidth"),
  );
  assert.equal(duplicateBandwidth.plotX, "bandwidth");
  assert.equal(duplicateBandwidth.plotY, "detectivity");

  const duplicateDetectivity = parseAtlasFilters(
    new URLSearchParams("xMetric=detectivity&yMetric=detectivity"),
  );
  assert.equal(duplicateDetectivity.plotX, "detectivity");
  assert.equal(duplicateDetectivity.plotY, "wavelength");
});

test("metric availability filters treat zero as reported and null as missing", () => {
  const zeroMetrics = recordWithMeasurement("zero-metrics", {
    responsivityAW: 0,
    eqePercent: 0,
    responseTimeS: 0,
    riseTimeS: 0,
    fallTimeS: 0,
    bandwidthHz: 0,
    linearDynamicRangeDb: 0,
  });
  const missingMetrics = recordWithMeasurement("missing-metrics", {
    responsivityAW: null,
    eqePercent: null,
    responseTimeS: null,
    riseTimeS: null,
    fallTimeS: null,
    bandwidthHz: null,
    linearDynamicRangeDb: null,
    linearDynamicRangeMin: null,
    linearDynamicRangeMax: null,
  });
  const availabilityKeys = [
    "hasResponsivity",
    "hasEqe",
    "hasTemporal",
    "hasRiseTime",
    "hasFallTime",
    "hasBandwidth",
    "hasLdr",
  ] as const satisfies readonly (keyof AtlasFilterState)[];

  for (const key of availabilityKeys) {
    const filters: AtlasFilterState = {
      ...DEFAULT_ATLAS_FILTERS,
      [key]: true,
    };
    assert.deepEqual(
      filterAtlasRecords([zeroMetrics, missingMetrics], filters).map(
        (record) => record.measurement.measurementId,
      ),
      ["zero-metrics"],
      key,
    );
  }

  const rawRangeOnly = recordWithMeasurement("raw-ldr-range", {
    linearDynamicRangeDb: null,
    linearDynamicRangeMin: 0,
    linearDynamicRangeMax: 1,
    linearDynamicRangeUnits: "mW cm^-2",
  });
  assert.deepEqual(
    filterAtlasRecords([rawRangeOnly], {
      ...DEFAULT_ATLAS_FILTERS,
      hasLdr: true,
    }).map((record) => record.measurement.measurementId),
    ["raw-ldr-range"],
  );
  assert.equal(
    filterAtlasRecords([rawRangeOnly], {
      ...DEFAULT_ATLAS_FILTERS,
      ldrMinDb: 0,
    }).length,
    0,
  );
});

test("numeric metric filters distinguish zero from null and use inclusive bounds", () => {
  const zeroMetrics = recordWithMeasurement("numeric-zero", {
    responsivityAW: 0,
    eqePercent: 0,
    responseTimeS: 0,
    riseTimeS: 0,
    fallTimeS: 0,
    bandwidthHz: 0,
    linearDynamicRangeDb: 0,
  });
  const positiveMetrics = recordWithMeasurement("numeric-positive", {
    responsivityAW: 1,
    eqePercent: 1,
    responseTimeS: 1,
    riseTimeS: 1,
    fallTimeS: 1,
    bandwidthHz: 1,
    linearDynamicRangeDb: 1,
  });
  const missingMetrics = recordWithMeasurement("numeric-missing", {
    responsivityAW: null,
    eqePercent: null,
    responseTimeS: null,
    riseTimeS: null,
    fallTimeS: null,
    bandwidthHz: null,
    linearDynamicRangeDb: null,
  });
  const metricRecords = [zeroMetrics, positiveMetrics, missingMetrics];
  const minimumKeys = [
    "responsivityMin",
    "eqeMin",
    "bandwidthMinHz",
    "ldrMinDb",
  ] as const satisfies readonly (keyof AtlasFilterState)[];
  const maximumKeys = [
    "responseTimeMaxS",
    "riseTimeMaxS",
    "fallTimeMaxS",
  ] as const satisfies readonly (keyof AtlasFilterState)[];

  for (const key of minimumKeys) {
    const filters: AtlasFilterState = {
      ...DEFAULT_ATLAS_FILTERS,
      [key]: 0,
    };
    assert.deepEqual(
      filterAtlasRecords(metricRecords, filters).map(
        (record) => record.measurement.measurementId,
      ),
      ["numeric-zero", "numeric-positive"],
      key,
    );
  }

  for (const key of maximumKeys) {
    const filters: AtlasFilterState = {
      ...DEFAULT_ATLAS_FILTERS,
      [key]: 0,
    };
    assert.deepEqual(
      filterAtlasRecords(metricRecords, filters).map(
        (record) => record.measurement.measurementId,
      ),
      ["numeric-zero"],
      key,
    );
  }

  assert.deepEqual(
    filterAtlasRecords(metricRecords, {
      ...DEFAULT_ATLAS_FILTERS,
      responsivityMin: 1,
      eqeMin: 1,
      responseTimeMaxS: 1,
      riseTimeMaxS: 1,
      fallTimeMaxS: 1,
      bandwidthMinHz: 1,
      ldrMinDb: 1,
    }).map((record) => record.measurement.measurementId),
    ["numeric-positive"],
  );
});

test("extended review status is an exclusive filter", () => {
  const checked = recordWithMeasurement("review-checked", {
    extendedMetricsReviewStatus: "checked",
  });
  const unavailable = recordWithMeasurement("review-unavailable", {
    extendedMetricsReviewStatus: "source_unavailable",
  });
  const notChecked = recordWithMeasurement("review-not-checked", {
    extendedMetricsReviewStatus: "not_checked",
  });
  const reviewRecords = [checked, unavailable, notChecked];

  assert.deepEqual(
    filterAtlasRecords(reviewRecords, {
      ...DEFAULT_ATLAS_FILTERS,
      extendedReview: "checked",
    }).map((record) => record.measurement.measurementId),
    ["review-checked"],
  );
  assert.deepEqual(
    filterAtlasRecords(reviewRecords, {
      ...DEFAULT_ATLAS_FILTERS,
      extendedReview: "source_unavailable",
    }).map((record) => record.measurement.measurementId),
    ["review-unavailable"],
  );
  assert.deepEqual(
    filterAtlasRecords(reviewRecords, DEFAULT_ATLAS_FILTERS).map(
      (record) => record.measurement.measurementId,
    ),
    ["review-checked", "review-unavailable", "review-not-checked"],
  );
});

test("ambiguous extraction filter checks every extended metric group", () => {
  const direct = recordWithMeasurement("direct-extraction", {
    responsivityExtractionMethod: "directly_reported",
    responseTimeExtractionMethod: "not_reported",
    bandwidthExtractionMethod: "not_reported",
    linearDynamicRangeExtractionMethod: "not_reported",
  });
  const ambiguityCases = [
    ["ambiguous-responsivity", "responsivityExtractionMethod"],
    ["ambiguous-temporal", "responseTimeExtractionMethod"],
    ["ambiguous-bandwidth", "bandwidthExtractionMethod"],
    ["ambiguous-ldr", "linearDynamicRangeExtractionMethod"],
  ] as const;
  const ambiguousRecords = ambiguityCases.map(([id, field]) =>
    recordWithMeasurement(id, { [field]: "ambiguous" }),
  );

  assert.deepEqual(
    filterAtlasRecords([direct, ...ambiguousRecords], {
      ...DEFAULT_ATLAS_FILTERS,
      ambiguousExtraction: true,
    }).map((record) => record.measurement.measurementId),
    ambiguityCases.map(([id]) => id),
  );
});

test("metric pairs exclude missing and log-invalid values without rejecting linear zero", () => {
  const valid = recordWithMeasurement("pair-valid", {
    detectivityJones: 1e10,
    responsivityAW: 1,
  });
  const linearZero = recordWithMeasurement("pair-linear-zero", {
    detectivityJones: 1e10,
    responsivityAW: 0,
  });
  const missing = recordWithMeasurement("pair-missing", {
    detectivityJones: 1e10,
    responsivityAW: null,
  });
  const logZero = recordWithMeasurement("pair-log-zero", {
    detectivityJones: 0,
    responsivityAW: 1,
  });
  const logNegative = recordWithMeasurement("pair-log-negative", {
    detectivityJones: -1,
    responsivityAW: 1,
  });

  const pair = recordsWithMetricPair(
    [valid, linearZero, missing, logZero, logNegative],
    "responsivity",
    "detectivity",
  );
  assert.deepEqual(
    pair.plotted.map((record) => record.measurement.measurementId),
    ["pair-valid", "pair-linear-zero"],
  );
  assert.equal(pair.excluded, 3);
  assert.equal(isPlottableMetricValue(0, "responsivity"), true);
  assert.equal(isPlottableMetricValue(0, "ldr"), true);
  assert.equal(isPlottableMetricValue(0, "response_time"), false);
  assert.equal(isPlottableMetricValue(Number.NaN, "bandwidth"), false);
  assert.equal(isPlottableMetricValue(null, "detectivity"), false);
});

test("all extended metric sorts keep missing values last in either direction", () => {
  const low = recordWithMeasurement("sort-low", {
    responsivityAW: 0,
    eqePercent: 0,
    responseTimeS: 0,
    riseTimeS: 0,
    fallTimeS: 0,
    bandwidthHz: 0,
    linearDynamicRangeDb: 0,
  });
  const high = recordWithMeasurement("sort-high", {
    responsivityAW: 2,
    eqePercent: 2,
    responseTimeS: 2,
    riseTimeS: 2,
    fallTimeS: 2,
    bandwidthHz: 2,
    linearDynamicRangeDb: 2,
  });
  const missing = recordWithMeasurement("sort-missing", {
    responsivityAW: null,
    eqePercent: null,
    responseTimeS: null,
    riseTimeS: null,
    fallTimeS: null,
    bandwidthHz: null,
    linearDynamicRangeDb: null,
  });
  const metricSortKeys = [
    "responsivity",
    "eqe",
    "response_time",
    "rise_time",
    "fall_time",
    "bandwidth",
    "ldr",
  ] as const satisfies readonly AtlasSortKey[];

  for (const key of metricSortKeys) {
    assert.deepEqual(
      sortAtlasRecords([high, missing, low], {
        key,
        direction: "asc",
      }).map((record) => record.measurement.measurementId),
      ["sort-low", "sort-high", "sort-missing"],
      `${key} ascending`,
    );
    assert.deepEqual(
      sortAtlasRecords([low, missing, high], {
        key,
        direction: "desc",
      }).map((record) => record.measurement.measurementId),
      ["sort-high", "sort-low", "sort-missing"],
      `${key} descending`,
    );
  }
});

test("plot definitions keep curated presets and scientifically appropriate scales", () => {
  assert.deepEqual(
    ATLAS_PLOT_PRESETS.map(({ x, y }) => [x, y]),
    [
      ["wavelength", "detectivity"],
      ["responsivity", "detectivity"],
      ["response_time", "detectivity"],
      ["bandwidth", "detectivity"],
      ["ldr", "detectivity"],
      ["bandwidth", "responsivity"],
    ],
  );

  for (const metric of [
    "detectivity",
    "response_time",
    "rise_time",
    "fall_time",
    "bandwidth",
  ] as const) {
    assert.equal(ATLAS_METRICS[metric].scale, "log", metric);
  }
  for (const metric of ["wavelength", "responsivity", "eqe", "ldr"] as const) {
    assert.equal(ATLAS_METRICS[metric].scale, "linear", metric);
  }
});

test("preset availability and plot scope follow the current scientific record set", () => {
  const lower = recordWithMeasurement("scope-lower", {
    detectivityJones: 1e10,
    responsivityAW: 0.2,
  });
  const higher: AtlasRecord = {
    ...lower,
    measurement: {
      ...lower.measurement,
      measurementId: "scope-higher",
      detectivityJones: 2e10,
      responsivityAW: 0.4,
    },
  };
  const other = recordWithMeasurement("scope-other", {
    detectivityJones: 3e10,
    responsivityAW: null,
  });

  assert.deepEqual(
    recordsForPlotScope([lower, higher, other], "paper_maxima").map(
      (record) => record.measurement.measurementId,
    ),
    ["scope-higher", "scope-other"],
  );
  assert.deepEqual(
    recordsForPlotScope([lower, higher, other], "all_measurements").map(
      (record) => record.measurement.measurementId,
    ),
    ["scope-lower", "scope-higher", "scope-other"],
  );
  assert.deepEqual(
    availablePlotPresets([lower]).map((preset) => preset.key),
    ["dstar-wavelength", "dstar-responsivity"],
  );
});

test("metric threshold unit conversion and clear-all preserve view state", () => {
  assert.equal(normalizeMetricFilterValue(25, 1e6), 25e-6);
  assert.equal(normalizeMetricFilterValue(2.5, 1e-3), 2500);
  assert.equal(normalizeMetricFilterValue(0, 1e6), 0);
  assert.equal(normalizeMetricFilterValue(-1, 1e6), undefined);
  assert.equal(normalizeMetricFilterValue(1, 0), undefined);

  const configured: AtlasFilterState = {
    ...DEFAULT_ATLAS_FILTERS,
    material: "HgTe",
    hasResponsivity: true,
    hasBandwidth: true,
    extendedReview: "source_unavailable",
    ambiguousExtraction: true,
    responsivityMin: 0.5,
    responseTimeMaxS: 1e-6,
    bandwidthMinHz: 1e6,
    plotMode: "compare_metrics",
    plotX: "bandwidth",
    plotY: "responsivity",
    plotScope: "all_measurements",
    tableView: "speed",
  };
  const cleared = clearMetricFilters(configured);
  assert.equal(cleared.material, "HgTe");
  assert.equal(cleared.plotMode, "compare_metrics");
  assert.equal(cleared.plotX, "bandwidth");
  assert.equal(cleared.plotY, "responsivity");
  assert.equal(cleared.plotScope, "all_measurements");
  assert.equal(cleared.tableView, "speed");
  assert.equal(cleared.hasResponsivity, false);
  assert.equal(cleared.hasBandwidth, false);
  assert.equal(cleared.extendedReview, "all");
  assert.equal(cleared.ambiguousExtraction, false);
  assert.equal(cleared.responsivityMin, undefined);
  assert.equal(cleared.responseTimeMaxS, undefined);
  assert.equal(cleared.bandwidthMinHz, undefined);

  const reset = resetAtlasFilterCriteria(configured);
  assert.equal(reset.material, "all");
  assert.equal(reset.hasResponsivity, false);
  assert.equal(reset.responsivityMin, undefined);
  assert.equal(reset.plotMode, "compare_metrics");
  assert.equal(reset.plotX, "bandwidth");
  assert.equal(reset.plotY, "responsivity");
  assert.equal(reset.plotScope, "all_measurements");
  assert.equal(reset.tableView, "speed");
});

test("metric provenance never borrows D* conditions for EQE or LDR", () => {
  const extended = recordWithMeasurement("conditions", {
    wavelengthNm: 1550,
    biasV: -0.2,
    temperatureK: 300,
    responsivityWavelengthNm: 1450,
    responsivityBiasV: -0.1,
    responsivityTemperatureK: 295,
    eqePercent: 70,
    linearDynamicRangeDb: 80,
    linearDynamicRangeDefinition: "Lower bound (>80 dB) at 1,550 nm",
    bandwidthHz: 1e6,
    bandwidthBiasV: -0.3,
    bandwidthLimit: "instrument_limited",
    responseTimeS: 1e-6,
    responseTimeLimit: "measured",
  });

  assert.deepEqual(metricConditionSummary(extended, "eqe"), []);
  assert.deepEqual(metricConditionSummary(extended, "ldr"), []);
  assert.deepEqual(metricConditionSummary(extended, "responsivity"), [
    "1,450 nm",
    "-0.1 V",
    "295 K",
  ]);
  assert.equal(metricLimitLabel(extended, "response_time"), null);
  assert.equal(metricLimitLabel(extended, "bandwidth"), "Instrument limited");
  assert.equal(ldrValuePrefix(extended), ">");
  assert.equal(
    metricDefinitionSummary(extended, "ldr"),
    "Lower bound (>80 dB) at 1,550 nm",
  );

  const unavailable = recordWithMeasurement("unavailable-eqe", {
    eqePercent: 70,
    extendedMetricsReviewStatus: "source_unavailable",
  });
  assert.equal(
    metricEvidenceSummary(unavailable, "eqe"),
    "Source unavailable · value unverified",
  );
});

test("graph, table, and CSV can share one filtered record set", () => {
  const reported = recordWithMeasurement("shared-reported", {
    responsivityAW: 0,
  });
  const missing = recordWithMeasurement("shared-missing", {
    responsivityAW: null,
  });
  const filtered = filterAtlasRecords([reported, missing], {
    ...DEFAULT_ATLAS_FILTERS,
    hasResponsivity: true,
  });
  const plot = recordsWithMetricPair(
    recordsForPlotScope(filtered, "all_measurements"),
    "responsivity",
    "detectivity",
  );
  const csvRows = atlasRecordsToCsv(filtered).trimEnd().split("\r\n");

  assert.deepEqual(
    filtered.map((record) => record.measurement.measurementId),
    ["shared-reported"],
  );
  assert.deepEqual(plot.plotted, filtered);
  assert.equal(plot.excluded, 0);
  assert.equal(csvRows.length, 2);
  assert.match(csvRows[1], /shared-reported/);
});
