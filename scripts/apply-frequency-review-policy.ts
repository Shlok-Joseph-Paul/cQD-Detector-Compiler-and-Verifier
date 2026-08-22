#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { parseCsv, serializeCsv } from "../lib/data/csv.ts";
import { deriveFrequencyMatchStatus } from "../lib/data/frequency-match.ts";
import { MEASUREMENT_CSV_COLUMNS } from "../lib/data/parse.ts";
import type { NoiseMethod } from "../lib/data/types.ts";

const REVIEW_DATE = "2026-08-22";
const measurementsPath = fileURLToPath(
  new URL("../data/measurements.csv", import.meta.url),
);

const sourceCorrections: Record<string, Record<string, string>> = {
  "wang-2025-m1": {
    responsivity_frequency_hz: "1",
  },
  "rastogi-2022-m1": {
    responsivity_frequency_hz: "1000",
    curator_notes:
      "Room-temperature result; the main article does not specify the noise-acquisition instrument. The 1 kHz responsivity-frequency field records the paper's explicitly stated D* modulation condition; the signal and noise frequencies are not restated separately.",
  },
  "paul-2025-hgte-m1": {
    responsivity_frequency_hz: "25",
    measurement_frequency_hz: "25",
    curator_notes:
      "Source recheck on 2026-08-22: the spectral photoresponse was acquired with light chopped at 25 Hz, and the measured 25 Hz noise value was used for D*. The separate 140 Hz statement does not define the retained D* calculation.",
  },
  "li-2020-perovskite-organic-bhj-870": {
    responsivity_frequency_hz: "70",
  },
  "measurement-f5ecd60bda2e-1": {
    responsivity_frequency_hz: "1000",
  },
  "ackerman-2018-hgte-mwir-5000-85k": {
    responsivity_frequency_hz: "500",
  },
  "wang-2025-hgte-dpp-1650-zero": {
    responsivity_frequency_hz: "130",
    eqe_frequency_hz: "130",
  },
  "wang-2026-hgte-cdhgte-etl-1560-zero": {
    responsivity_frequency_hz: "130",
    eqe_frequency_hz: "130",
  },
  "sun-2022-inas-max": {
    responsivity_frequency_hz: "25",
    eqe_frequency_hz: "25",
    curator_notes:
      "Maximum reported D*. Methods report EQE/IQE with 25 Hz chopped light, while the measured noise value used for D* is reported at 500 kHz. The separately reported 2 ns response at 850 nm is not transferred to this record.",
  },
};

function nullableNumber(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function frequencyStatus(row: Record<string, string>) {
  return deriveFrequencyMatchStatus({
    noiseMethod: row.noise_method as NoiseMethod,
    measurementFrequencyHz: nullableNumber(row.measurement_frequency_hz),
    responsivityAW: nullableNumber(row.responsivity_a_w),
    responsivityFrequencyHz: nullableNumber(row.responsivity_frequency_hz),
    eqePercent: nullableNumber(row.eqe_percent),
    eqeFrequencyHz: nullableNumber(row.eqe_frequency_hz),
  });
}

function addFrequencyMismatch(row: Record<string, string>): void {
  const reasons = new Set(row.amber_reasons.split("|").filter(Boolean));
  reasons.add("frequency_mismatch");
  row.flag = "amber";
  row.amber_reasons = [...reasons].join("|");
  row.amber_explanation =
    row.amber_explanation ||
    "Detectivity combines responsivity or EQE acquired at a different frequency from the noise value used in the calculation, limiting direct comparability of the inputs.";
}

const original = await readFile(measurementsPath, "utf8");
const table = parseCsv(original);
if (
  table.headers.length !== MEASUREMENT_CSV_COLUMNS.length ||
  table.headers.some(
    (header, index) => header !== MEASUREMENT_CSV_COLUMNS[index],
  )
) {
  throw new Error("measurements.csv does not match the canonical column order");
}

const seenCorrections = new Set<string>();
let changedRows = 0;
const outputRows = table.rows.map(({ fields }) => {
  const row = Object.fromEntries(
    table.headers.map((header, index) => [header, fields[index] ?? ""]),
  );
  const before = JSON.stringify(row);
  const correction = sourceCorrections[row.measurement_id];
  if (correction) {
    Object.assign(row, correction);
    seenCorrections.add(row.measurement_id);
  }

  const status = frequencyStatus(row);
  if (row.flag !== "amber") {
    if (status === "not_matched") {
      addFrequencyMismatch(row);
    } else if (status === "not_established") {
      row.flag = "unverified";
      row.amber_reasons = "";
      row.amber_explanation = "";
    } else {
      row.flag = "green";
      row.amber_reasons = "";
      row.amber_explanation = "";
    }
  }

  if (JSON.stringify(row) !== before) {
    row.date_updated = REVIEW_DATE;
    changedRows += 1;
  }
  return MEASUREMENT_CSV_COLUMNS.map((column) => row[column]);
});

const missingCorrections = Object.keys(sourceCorrections).filter(
  (measurementId) => !seenCorrections.has(measurementId),
);
if (missingCorrections.length) {
  throw new Error(
    `Source-correction measurement IDs not found: ${missingCorrections.join(", ")}`,
  );
}

const next = serializeCsv(MEASUREMENT_CSV_COLUMNS, outputRows);
const nextTable = parseCsv(next);
const flagIndex = nextTable.headers.indexOf("flag");
const counts = Object.fromEntries(
  ["amber", "unverified", "green"].map((flag) => [
    flag,
    nextTable.rows.filter((row) => row.fields[flagIndex] === flag).length,
  ]),
);
if (counts.amber !== 77 || counts.unverified !== 57 || counts.green !== 25) {
  throw new Error(`Unexpected review-status counts: ${JSON.stringify(counts)}`);
}

if (process.argv.includes("--write")) {
  await writeFile(measurementsPath, next, "utf8");
  console.log(`Updated ${changedRows} measurement rows.`);
} else if (changedRows > 0 || next !== original) {
  console.error(
    `Frequency-review migration is pending (${changedRows} changed rows). Run with --write.`,
  );
  process.exitCode = 1;
} else {
  console.log("Frequency-review migration is current.");
}
console.log(`Review statuses: ${JSON.stringify(counts)}`);
