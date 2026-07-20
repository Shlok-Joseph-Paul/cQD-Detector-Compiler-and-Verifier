#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "../lib/data/csv.ts";
import { MEASUREMENT_CSV_COLUMNS } from "../lib/data/parse.ts";

type Row = Record<string, string>;

const root = fileURLToPath(new URL("../", import.meta.url));
const reviewDate = "2026-07-20";

function rowsFromCsv(source: string): Row[] {
  const table = parseCsv(source);
  return table.rows.map((row) =>
    Object.fromEntries(
      table.headers.map((header, index) => [header, row.fields[index] ?? ""]),
    ),
  );
}

function appendNote(row: Row, note: string): void {
  row.extended_metrics_notes = [row.extended_metrics_notes, note]
    .filter(Boolean)
    .join(" ");
}

function setFields(row: Row, values: Record<string, string | number>): void {
  for (const [key, value] of Object.entries(values)) row[key] = String(value);
}

const [paperSource, deviceSource, measurementSource] = await Promise.all([
  readFile(`${root}/data/papers.csv`, "utf8"),
  readFile(`${root}/data/devices.csv`, "utf8"),
  readFile(`${root}/data/measurements.csv`, "utf8"),
]);

const papers = rowsFromCsv(paperSource);
const devices = rowsFromCsv(deviceSource);
const measurements = rowsFromCsv(measurementSource);
const paperByDevice = new Map(
  devices.map((row) => [row.device_id, row.paper_id]),
);
const rowById = new Map(measurements.map((row) => [row.measurement_id, row]));

const checkedPapers = new Set([
  "wang-2025-ag2te-lidar",
  "song-2024-ag-hgte",
  "vafaie-2021-pbs-fast",
  "paul-2025-ag2se",
  "molnas-2024-pbs-ase",
  "liu-2022-pbs-imager",
  "shin-2024-inas-extended-absorber",
  "yang-2022-hgte-ligand",
  "wang-2024-hgte-top-imager",
  "rastogi-2022-cdse-hgte-ag2te",
  "paul-2025-hgte-transparent-electrode",
  "yu-2024-hgte-sam",
  "wang-2023-pbs-oxidation",
  "chen-2014-hgte-au-nanorods",
  "ackerman-2020-hgte-eswir",
  "ahn-2024-ag2te-fast-eswir",
  "peng-2024-insb-inp",
  "muhammad-2023-insb-halide",
  "wang-2024-ag2te-imager",
  "chen-2023-hgte-universal-homojunction",
  "xue-2023-hgte-gradient-homojunction",
  "siddik-2025-inas-cmos",
  "sheikh-2024-inas-znse",
  "sun-2022-inas-fast",
  "hu-2025-hgte-double-heterojunction",
]);

const unavailablePapers = new Set([
  "dang-2023-multiresonant-grating",
  "paper-798a7e0d2116",
  "lee-2026-hgcdse-neutralized",
  "park-2026-internal-field",
  "huang-2026-cdte-hgte-htl",
  "xia-2025-pbse-mle",
  "tran-2026-cd3p2-polarity",
  "imran-2025-insb-metal-halide",
  "kim-2026-inas-shape-engineering",
  "pi-2026-agbis2-mxene",
  "qin-2023-hgte-planar-pn",
]);

for (const row of measurements) {
  const paperId = paperByDevice.get(row.device_id);
  row.date_updated = reviewDate;
  if (paperId && checkedPapers.has(paperId)) {
    setFields(row, {
      extended_metrics_review_status: "checked",
      extended_metrics_review_date: reviewDate,
      responsivity_extraction_method: "not_reported",
      response_time_extraction_method: "not_reported",
      response_time_limit: "not_reported",
      bandwidth_extraction_method: "not_reported",
      bandwidth_limit: "not_reported",
      linear_dynamic_range_extraction_method: "not_reported",
    });
  } else if (paperId && unavailablePapers.has(paperId)) {
    setFields(row, {
      extended_metrics_review_status: "source_unavailable",
      extended_metrics_review_date: reviewDate,
    });
    appendNote(
      row,
      "Main article unavailable during the 2026-07-20 reprocessing pass; existing extended values remain unverified.",
    );
  }
}

const patch = (id: string, values: Record<string, string | number>) => {
  const row = rowById.get(id);
  if (!row) throw new Error(`Unknown measurement: ${id}`);
  setFields(row, values);
};
const note = (id: string, value: string) => {
  const row = rowById.get(id);
  if (!row) throw new Error(`Unknown measurement: ${id}`);
  appendNote(row, value);
};

patch("wang-2025-m1", {
  responsivity_wavelength_nm: 1350,
  responsivity_temperature_k: 300,
  responsivity_source_location: "PDF p. 5, Figure 4c",
  responsivity_extraction_method: "graphically_extracted",
  response_time_extraction_method: "ambiguous",
  response_time_limit: "not_reported",
  bandwidth_extraction_method: "ambiguous",
  bandwidth_limit: "not_reported",
  linear_dynamic_range_db: 150,
  linear_dynamic_range_min: 1e-7,
  linear_dynamic_range_max: 10,
  linear_dynamic_range_units: "mW cm^-2",
  linear_dynamic_range_definition: "Lower bound (>150 dB) at 1350 nm",
  linear_dynamic_range_source_location: "PDF pp. 4-5, Figure 4d",
  linear_dynamic_range_extraction_method: "directly_reported",
});
note(
  "wang-2025-m1",
  "The approximately 25 ns response and >5 MHz bandwidth belong to a separate 10^4 µm² device and are retained as device-level evidence only.",
);

patch("song-2024-ag-hgte-m1", {
  responsivity_bias_v: 0,
  responsivity_temperature_k: 130,
  responsivity_source_location:
    "Main PDF p. 3; Supporting Information p. 16, Figure S15",
  responsivity_extraction_method: "directly_reported",
});
note(
  "song-2024-ag-hgte-m1",
  "The source also reports 0.31 A/W at 78 K; the atlas row retains the 0.58 A/W, 130 K condition.",
);

patch("vafaie-2021-m1", {
  responsivity_wavelength_nm: 1550,
  responsivity_bias_v: 0,
  responsivity_source_location: "PDF p. 6, Figure 4A",
  responsivity_extraction_method: "directly_reported",
  response_time_extraction_method: "ambiguous",
});
note(
  "vafaie-2021-m1",
  "The 10 ns response/fall champion was measured on a separate small pixel and is retained as device-level evidence only.",
);

patch("paul-2025-m1", {
  responsivity_wavelength_nm: 1200,
  responsivity_bias_v: 0,
  responsivity_temperature_k: 300,
  responsivity_source_location: "PDF p. 7",
  responsivity_extraction_method: "directly_reported",
  rise_time_s: 2.6e-5,
  fall_time_s: 4e-5,
  response_time_definition: "10-90% rise and 90-10% fall",
  response_time_wavelength_nm: 970,
  response_time_bias_v: 0,
  response_time_source_location: "PDF pp. 1-2 and 7",
  response_time_limit: "measured",
  response_time_extraction_method: "directly_reported",
  bandwidth_hz: 18000,
  bandwidth_bias_v: 0,
  bandwidth_source_location: "PDF pp. 1-2 and 7",
  bandwidth_limit: "measured",
  bandwidth_extraction_method: "directly_reported",
  linear_dynamic_range_db: 66,
  linear_dynamic_range_definition: "Approximately 66 dB",
  linear_dynamic_range_source_location: "PDF p. 7",
  linear_dynamic_range_extraction_method: "directly_reported",
});

patch("molnas-2024-m1", {
  responsivity_a_w: 0.098,
  responsivity_wavelength_nm: 980,
  responsivity_temperature_k: 295,
  responsivity_source_location: "PDF p. 4, Figure 2a",
  responsivity_extraction_method: "graphically_extracted",
  response_time_extraction_method: "ambiguous",
  bandwidth_extraction_method: "ambiguous",
});
note(
  "molnas-2024-m1",
  "Responsivity and D* use 10 V µm^-1. The paper-calculated ~64 ns response and 2.5 MHz bandwidth use 5 V µm^-1 and remain device-level evidence.",
);

patch("liu-2022-m1", {
  responsivity_a_w: 0.46,
  responsivity_wavelength_nm: 970,
  responsivity_bias_v: -0.5,
  responsivity_source_location: "PDF p. 4, Figure 2c-d",
  responsivity_extraction_method: "directly_reported",
  rise_time_s: 4.9e-7,
  fall_time_s: 1.15e-6,
  response_time_bias_v: -0.5,
  response_time_source_location: "PDF p. 4, Figure 2e",
  response_time_limit: "measured",
  response_time_extraction_method: "directly_reported",
  bandwidth_hz: 140000,
  bandwidth_bias_v: -0.5,
  bandwidth_source_location: "PDF p. 4, Figure 2d",
  bandwidth_limit: "measured",
  bandwidth_extraction_method: "directly_reported",
  linear_dynamic_range_db: 100,
  linear_dynamic_range_min: 7e-9,
  linear_dynamic_range_max: 7e-4,
  linear_dynamic_range_units: "W",
  linear_dynamic_range_definition: "Lower bound (>100 dB) at -0.5 V",
  linear_dynamic_range_source_location: "PDF pp. 3-4, Figure 2b",
  linear_dynamic_range_extraction_method: "directly_reported",
});
patch("liu-2022-m2", {
  rise_time_s: 6.4e-7,
  fall_time_s: 1.86e-6,
  response_time_bias_v: 0,
  response_time_source_location:
    "PDF p. 4; Supplementary Figure 6 cited in main text",
  response_time_limit: "measured",
  response_time_extraction_method: "directly_reported",
  bandwidth_hz: 70000,
  bandwidth_bias_v: 0,
  bandwidth_source_location: "PDF p. 4, Figure 2d",
  bandwidth_limit: "measured",
  bandwidth_extraction_method: "directly_reported",
  linear_dynamic_range_db: 80,
  linear_dynamic_range_min: 7e-9,
  linear_dynamic_range_max: 7e-4,
  linear_dynamic_range_units: "W",
  linear_dynamic_range_definition: "80 dB at 0 V",
  linear_dynamic_range_source_location: "PDF pp. 3-4, Figure 2b",
  linear_dynamic_range_extraction_method: "directly_reported",
});

patch("shin-2024-m1", {
  responsivity_extraction_method: "ambiguous",
  response_time_extraction_method: "ambiguous",
});
note(
  "shin-2024-m1",
  "The reported 0.60 A/W responsivity and 46 ns fall time are at -3 V, while the atlas D* row is at -1 V; a 76 ns fall at -1 V could not be tied confidently to the exact absorber condition.",
);

patch("yang-2022-m1", {
  responsivity_wavelength_nm: 1550,
  responsivity_bias_v: 0,
  responsivity_temperature_k: 295,
  responsivity_source_location: "PDF p. 5",
  responsivity_extraction_method: "directly_reported",
  rise_time_s: 6.4e-6,
  fall_time_s: 2.54e-5,
  response_time_bias_v: 0,
  response_time_source_location: "PDF p. 5; Supporting Information Figure S16",
  response_time_limit: "measured",
  response_time_extraction_method: "directly_reported",
  bandwidth_hz: 50000,
  bandwidth_bias_v: 0,
  bandwidth_source_location: "PDF p. 5; Supporting Information Figure S16",
  bandwidth_limit: "measured",
  bandwidth_extraction_method: "directly_reported",
  linear_dynamic_range_db: 112,
  linear_dynamic_range_min: 2e-5,
  linear_dynamic_range_max: 8,
  linear_dynamic_range_units: "mW cm^-2",
  linear_dynamic_range_definition: "Lower bound (>112 dB)",
  linear_dynamic_range_source_location: "PDF p. 5",
  linear_dynamic_range_extraction_method: "directly_reported",
});

patch("wang-2024-m1", {
  responsivity_wavelength_nm: 1700,
  responsivity_bias_v: 0,
  responsivity_temperature_k: 300,
  responsivity_source_location: "PDF p. 5, Figure 3d",
  responsivity_extraction_method: "directly_reported",
  rise_time_s: 1e-5,
  fall_time_s: 1.9e-5,
  response_time_bias_v: 0,
  response_time_source_location: "PDF p. 5, Figure 3c",
  response_time_limit: "measured",
  response_time_extraction_method: "directly_reported",
  linear_dynamic_range_db: 95,
  linear_dynamic_range_definition: "Approximately 95 dB at +0.2 V",
  linear_dynamic_range_source_location: "PDF p. 5, Figure 3b",
  linear_dynamic_range_extraction_method: "directly_reported",
});

patch("rastogi-2022-m1", {
  responsivity_bias_v: 0,
  responsivity_temperature_k: 300,
  responsivity_source_location: "PDF pp. 1-2 and Figure 4a",
  responsivity_extraction_method: "directly_reported",
  response_time_extraction_method: "ambiguous",
});
patch("rastogi-2022-m2", {
  responsivity_extraction_method: "ambiguous",
  response_time_extraction_method: "ambiguous",
});
note(
  "rastogi-2022-m1",
  "Reported 200-700 ns temporal values vary with pixel area and are retained as device-level evidence.",
);
note(
  "rastogi-2022-m2",
  "The device platform reaches 0.80 A/W and 200-700 ns response depending on pixel area; these conditions are not assigned to the 200 K D* row.",
);

patch("paul-2025-hgte-m1", {
  responsivity_wavelength_nm: 1800,
  responsivity_bias_v: 0,
  responsivity_temperature_k: 300,
  responsivity_source_location: "Supporting Information PDF p. 20, Table S4",
  responsivity_extraction_method: "directly_reported",
  fall_time_s: 2.3e-5,
  response_time_source_location:
    "Supporting Information PDF p. 20, Table S4; Figure S17",
  response_time_limit: "measured",
  response_time_extraction_method: "directly_reported",
});

for (const [id, responsivity, rise, fall] of [
  ["yu-2024-hgte-me4pacz-m1", 0.76, 7.91e-6, 6.35e-6],
  ["yu-2024-hgte-bare-m1", 0.6, 9.23e-6, 65.71e-6],
] as const) {
  patch(id, {
    responsivity_a_w: responsivity,
    responsivity_wavelength_nm: 1715,
    responsivity_bias_v: 0,
    responsivity_source_location:
      "PDF p. 6, Figure 4d; Supporting Information Figure S8",
    responsivity_extraction_method: "directly_reported",
    response_time_s: "",
    rise_time_s: rise,
    fall_time_s: fall,
    response_time_bias_v: 0,
    response_time_source_location: "PDF p. 6, Figure 4c",
    response_time_limit: "measured",
    response_time_extraction_method: "directly_reported",
    bandwidth_hz: "",
    bandwidth_limit: "not_reported",
  });
}

for (const [id, response, bandwidth] of [
  ["wang-2023-pbs-oxidized-m1", 0.73e-6, 45000],
  ["wang-2023-pbs-control-m1", 0.99e-6, 39000],
] as const) {
  patch(id, {
    response_time_s: response,
    response_time_definition:
      "Response time; threshold definition not reported",
    response_time_bias_v: 0,
    response_time_source_location: "PDF p. 6, Figure 5d",
    response_time_limit: "measured",
    response_time_extraction_method: "directly_reported",
    bandwidth_hz: bandwidth,
    bandwidth_bias_v: 0,
    bandwidth_source_location: "PDF p. 6, Figure 5c",
    bandwidth_limit: "measured",
    bandwidth_extraction_method: "directly_reported",
  });
}

for (const id of ["chen-2014-hgte-plasmonic-m1", "chen-2014-hgte-control-m1"]) {
  patch(id, { bandwidth_extraction_method: "ambiguous" });
  note(
    id,
    "Figure 7b shows an illumination-dependent ~0.5-1.1 MHz bandwidth range; no single same-condition value is assigned.",
  );
}

for (const id of ["ackerman-2020-hgte-2200-m1", "ackerman-2020-hgte-2500-m1"]) {
  patch(id, {
    responsivity_extraction_method: "ambiguous",
    response_time_s: "",
    rise_time_s: 4.5e-7,
    fall_time_s: 1.4e-6,
    response_time_bias_v: 0,
    response_time_source_location:
      "Main PDF p. 3; Supporting Information Figure S1",
    response_time_limit: "measured",
    response_time_extraction_method: "directly_reported",
    bandwidth_hz: "",
    bandwidth_limit: "not_reported",
  });
}

patch("ahn-2024-ag2te-mpa-1550", {
  responsivity_extraction_method: "ambiguous",
  response_time_s: "",
  fall_time_s: 2e-7,
  response_time_definition: "90-10% fall time",
  response_time_wavelength_nm: 1550,
  response_time_bias_v: 0,
  response_time_source_location: "PDF p. 6, Figure 4G",
  response_time_limit: "measured",
  response_time_extraction_method: "directly_reported",
  bandwidth_hz: 100000,
  bandwidth_bias_v: 0,
  bandwidth_source_location: "PDF p. 7; Supporting Information Figure S21",
  bandwidth_limit: "lower_bound",
  bandwidth_extraction_method: "directly_reported",
  linear_dynamic_range_db: 78.8,
  linear_dynamic_range_definition: "MPA device linear dynamic range",
  linear_dynamic_range_source_location:
    "PDF p. 7; Supporting Information Figure S20",
  linear_dynamic_range_extraction_method: "directly_reported",
});
patch("ahn-2024-ag2te-mpa-2004", {
  responsivity_extraction_method: "ambiguous",
  bandwidth_hz: "",
  bandwidth_extraction_method: "ambiguous",
  bandwidth_limit: "not_reported",
});
note(
  "ahn-2024-ag2te-mpa-2004",
  "The fastest 72 ns result used a 0.009 cm² pixel, and the >100 kHz bound was reported for the 1550 nm condition; neither is assigned here.",
);

patch("peng-2024-insb-inp-m1", {
  responsivity_wavelength_nm: 1240,
  responsivity_bias_v: 0,
  responsivity_temperature_k: 300,
  responsivity_source_location: "PDF p. 6, Table 1",
  responsivity_extraction_method: "calculated_from_reported_values",
  response_time_s: "",
  fall_time_s: 1.65e-6,
  response_time_definition: "Fall time",
  response_time_bias_v: 0,
  response_time_source_location: "PDF p. 5, Figure 4b",
  response_time_limit: "measured",
  response_time_extraction_method: "directly_reported",
  bandwidth_bias_v: 0,
  bandwidth_source_location: "PDF p. 5, Figure 4a",
  bandwidth_limit: "measured",
  bandwidth_extraction_method: "directly_reported",
  linear_dynamic_range_db: 128,
  linear_dynamic_range_min: 1e-7,
  linear_dynamic_range_max: 0.4,
  linear_dynamic_range_units: "W cm^-2",
  linear_dynamic_range_definition: "Lower bound (>128 dB) at 1310 nm",
  linear_dynamic_range_source_location: "PDF p. 5, Figure 4c",
  linear_dynamic_range_extraction_method: "directly_reported",
});

patch("wang-2024-ag2te-main-m1", {
  responsivity_a_w: 0.22,
  responsivity_wavelength_nm: 1380,
  responsivity_bias_v: 0,
  responsivity_temperature_k: 300,
  responsivity_source_location: "PDF p. 4, Figure 2d",
  responsivity_extraction_method: "graphically_extracted",
  response_time_s: "",
  rise_time_s: 1.3e-6,
  fall_time_s: 3.3e-6,
  response_time_bias_v: 0,
  response_time_source_location: "PDF p. 4, Figure 3b",
  response_time_limit: "measured",
  response_time_extraction_method: "directly_reported",
  bandwidth_source_location: "PDF p. 4, Figure 3b",
  bandwidth_limit: "measured",
  bandwidth_extraction_method: "directly_reported",
  linear_dynamic_range_db: 118,
  linear_dynamic_range_min: 1e-5,
  linear_dynamic_range_max: 10,
  linear_dynamic_range_units: "mW cm^-2",
  linear_dynamic_range_definition: "Lower bound (>118 dB) at 1310 nm",
  linear_dynamic_range_source_location: "PDF p. 4, Figure 3a",
  linear_dynamic_range_extraction_method: "directly_reported",
});
patch("wang-2024-ag2te-1520-m1", {
  responsivity_a_w: 0.1,
  responsivity_wavelength_nm: 1500,
  responsivity_bias_v: 0,
  responsivity_temperature_k: 300,
  responsivity_source_location: "PDF p. 4; Supplementary Figure 13",
  responsivity_extraction_method: "directly_reported",
  bandwidth_source_location: "PDF p. 4; Supplementary Figure 13",
  bandwidth_limit: "measured",
  bandwidth_extraction_method: "directly_reported",
});
note(
  "wang-2024-ag2te-1520-m1",
  "Responsivity is reported as >0.10 A/W; the stored value is the reported lower threshold.",
);

for (const row of measurements.filter((candidate) =>
  candidate.measurement_id.startsWith("chen-2023-hgte-"),
)) {
  patch(row.measurement_id, {
    responsivity_wavelength_nm: row.wavelength_nm,
    responsivity_bias_v: 0,
    responsivity_temperature_k: row.temperature_k,
    responsivity_source_location: row.measurement_id.includes("-pin-")
      ? "PDF p. 3, Figure 3"
      : "PDF pp. 3-5, Figure 4 and comparison table",
    responsivity_extraction_method: row.measurement_id.includes("-pin-")
      ? "directly_reported"
      : "ambiguous",
    bandwidth_hz: "",
    bandwidth_limit: "not_reported",
  });
}

for (const row of measurements.filter((candidate) =>
  candidate.measurement_id.startsWith("xue-2023-hgte-gradient-"),
)) {
  patch(row.measurement_id, {
    responsivity_wavelength_nm: row.wavelength_nm,
    responsivity_bias_v: 0,
    responsivity_temperature_k: row.temperature_k,
    responsivity_source_location: "PDF p. 6, Figure 3c",
    responsivity_extraction_method: row.measurement_id.endsWith("80k")
      ? "directly_reported"
      : "graphically_extracted",
    bandwidth_hz: "",
    bandwidth_limit: "not_reported",
  });
}

patch("siddik-2025-inas-max", {
  responsivity_wavelength_nm: 1210,
  responsivity_bias_v: -1,
  responsivity_temperature_k: 298,
  responsivity_source_location: "PDF p. 3, Table 1 and Figure 2b",
  responsivity_extraction_method: "directly_reported",
});
note(
  "siddik-2025-inas-max",
  "Transient-photovoltage recombination lifetimes are excluded because they are not detector response times.",
);

patch("sheikh-2024-inas-znse-max", {
  responsivity_wavelength_nm: 1450,
  responsivity_bias_v: -1,
  responsivity_source_location: "PDF p. 7, Figure 5a",
  responsivity_extraction_method: "directly_reported",
  response_time_s: "",
  fall_time_s: 1.06e-6,
  response_time_definition: "Fall time; graphically fitted",
  response_time_bias_v: -1,
  response_time_source_location: "PDF p. 7, Figure 5d",
  response_time_limit: "measured",
  response_time_extraction_method: "graphically_extracted",
});

patch("sun-2022-inas-max", {
  responsivity_wavelength_nm: 940,
  responsivity_bias_v: 0,
  responsivity_source_location: "PDF pp. 2 and 6, Figure 4",
  responsivity_extraction_method: "directly_reported",
  response_time_extraction_method: "ambiguous",
  bandwidth_hz: "",
  bandwidth_extraction_method: "ambiguous",
  bandwidth_limit: "not_reported",
});
note(
  "sun-2022-inas-max",
  "The 2 ns fall time and 150 MHz cutoff belong to a separate 0.03 mm² pixel and remain device-level evidence.",
);

patch("hu-2025-hgte-dh-1600", {
  responsivity_wavelength_nm: 1600,
  responsivity_bias_v: 0,
  responsivity_source_location: "PDF p. 7, Figure 3f and Supporting Figure S26",
  responsivity_extraction_method: "directly_reported",
  response_time_s: "",
  fall_time_s: 5.79e-7,
  response_time_definition: "10-90% fall time",
  response_time_wavelength_nm: 532,
  response_time_bias_v: 0,
  response_time_source_location: "PDF p. 7, Figure 3i",
  response_time_limit: "measured",
  response_time_extraction_method: "directly_reported",
  bandwidth_bias_v: 0,
  bandwidth_source_location: "PDF p. 7, Figure 3h",
  bandwidth_limit: "measured",
  bandwidth_extraction_method: "directly_reported",
  linear_dynamic_range_db: 89,
  linear_dynamic_range_min: 6e-5,
  linear_dynamic_range_max: 1.6,
  linear_dynamic_range_units: "mW cm^-2",
  linear_dynamic_range_definition: "89 dB at 0 V",
  linear_dynamic_range_source_location: "PDF p. 7, Figure 3e",
  linear_dynamic_range_extraction_method: "directly_reported",
});
note(
  "hu-2025-hgte-dh-1600",
  "The same paper reports 100 dB LDR at -0.2 V; the structured value retains the zero-bias condition.",
);

const knownPaperIds = new Set(papers.map((row) => row.paper_id));
for (const paperId of [...checkedPapers, ...unavailablePapers]) {
  if (!knownPaperIds.has(paperId)) throw new Error(`Unknown paper: ${paperId}`);
}

const output = serializeCsv(
  MEASUREMENT_CSV_COLUMNS,
  measurements.map((row) =>
    MEASUREMENT_CSV_COLUMNS.map((column) => row[column] ?? ""),
  ),
);
await writeFile(`${root}/data/measurements.csv`, output, "utf8");
console.log(
  `Applied extended-metrics review to ${measurements.length} measurements.`,
);
