import assert from "node:assert/strict";
import test from "node:test";

import { deriveFrequencyMatchStatus } from "../lib/data/frequency-match.ts";

test("frequency matching distinguishes matched, mismatched, and unknown evidence", () => {
  assert.equal(
    deriveFrequencyMatchStatus({
      measurementFrequencyHz: 140,
      responsivityAW: 0.07,
      responsivityFrequencyHz: 140,
      eqePercent: null,
      eqeFrequencyHz: null,
    }),
    "matched",
  );
  assert.equal(
    deriveFrequencyMatchStatus({
      measurementFrequencyHz: 140,
      responsivityAW: 0.07,
      responsivityFrequencyHz: 7,
      eqePercent: null,
      eqeFrequencyHz: null,
    }),
    "not_matched",
  );
  assert.equal(
    deriveFrequencyMatchStatus({
      measurementFrequencyHz: 140,
      responsivityAW: 0.07,
      responsivityFrequencyHz: null,
      eqePercent: null,
      eqeFrequencyHz: null,
    }),
    "not_established",
  );
});

test("responsivity is primary and EQE is used when responsivity is absent", () => {
  assert.equal(
    deriveFrequencyMatchStatus({
      measurementFrequencyHz: 100,
      responsivityAW: 0.2,
      responsivityFrequencyHz: 100,
      eqePercent: 25,
      eqeFrequencyHz: null,
    }),
    "matched",
  );
  assert.equal(
    deriveFrequencyMatchStatus({
      measurementFrequencyHz: 100,
      responsivityAW: null,
      responsivityFrequencyHz: null,
      eqePercent: 25,
      eqeFrequencyHz: 10,
    }),
    "not_matched",
  );
});

test("calculated noise models are outside the frequency-match rule", () => {
  assert.equal(
    deriveFrequencyMatchStatus({
      noiseMethod: "shot_noise_approximation",
      measurementFrequencyHz: null,
      responsivityAW: 0.2,
      responsivityFrequencyHz: null,
      eqePercent: null,
      eqeFrequencyHz: null,
    }),
    "not_applicable",
  );
});
