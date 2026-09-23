import assert from "node:assert/strict";
import test from "node:test";
import { readAtlasCsvFiles } from "../lib/data/node.ts";
import { buildAtlasFromCsvTexts } from "../lib/data/atlas.ts";
import { deriveRequiredReviewFlag } from "../lib/data/validation.ts";
import { deriveFrequencyMatchStatus } from "../lib/data/frequency-match.ts";

const atlas = buildAtlasFromCsvTexts(
  await readAtlasCsvFiles(new URL("../data/", import.meta.url).pathname),
);
const perini = atlas.measurements.find(
  (row) => row.measurement_id === "perini-2025-zno-pfn-700nm-lower",
)!;

test("curator-approved green preserves unknown frequency evidence", () => {
  assert.equal(perini.curator_status, "reviewed");
  assert.equal(deriveRequiredReviewFlag(perini), "green");
  assert.equal(
    deriveFrequencyMatchStatus({
      noiseMethod: perini.noise_method,
      measurementFrequencyHz: perini.measurement_frequency_hz,
      responsivityAW: perini.responsivity_a_w,
      responsivityFrequencyHz: perini.responsivity_frequency_hz,
      eqePercent: perini.eqe_percent,
      eqeFrequencyHz: perini.eqe_frequency_hz,
    }),
    "not_established",
  );
  assert.equal(
    atlas.measurements.some(
      (row) => row.measurement_id === "perini-2025-zno-pfn-700nm-upper",
    ),
    false,
  );
});

test("green approval cannot transfer to another row or changed result", () => {
  for (const change of [
    { measurement_id: "unapproved-record" },
    { detectivity_jones: 2.6e12 },
    { bias_v: -1 },
    { curator_notes: null },
    { curator_status: "pending_review" as const },
  ]) {
    assert.equal(
      deriveRequiredReviewFlag({ ...perini, ...change }),
      "unverified",
    );
  }
});

test("mandatory amber rules override curator approval", () => {
  assert.equal(
    deriveRequiredReviewFlag({ ...perini, responsivity_frequency_hz: 133 }),
    "amber",
  );
  assert.equal(
    deriveRequiredReviewFlag({
      ...perini,
      noise_instruments: ["lock_in_amplifier"],
    }),
    "amber",
  );
  assert.equal(
    deriveRequiredReviewFlag({
      ...perini,
      noise_method: "shot_noise_approximation",
    }),
    "amber",
  );
});
