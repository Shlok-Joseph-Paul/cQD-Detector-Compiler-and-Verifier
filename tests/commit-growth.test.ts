import assert from "node:assert/strict";
import test from "node:test";
import { countCommitsByMonth } from "../lib/data/commit-growth.ts";

test("commit months use UTC dates and count each reachable commit once", () => {
  const a = "a".repeat(40);
  const b = "b".repeat(40);
  const c = "c".repeat(40);
  assert.deepEqual(
    countCommitsByMonth(
      [
        `${a} 2026-08-31T23:30:00-06:00`,
        `${b} 2026-09-02T00:00:00Z`,
        `${c} 2026-07-12T00:00:00Z`,
        `${a} 2026-08-31T23:30:00-06:00`,
      ].join("\n"),
    ),
    [
      { month: "2026-07", commits: 1 },
      { month: "2026-09", commits: 2 },
    ],
  );
});

test("empty history is empty and malformed history fails instead of inventing counts", () => {
  assert.deepEqual(countCommitsByMonth(""), []);
  assert.throws(() => countCommitsByMonth("not-a-commit invalid-date"));
});
