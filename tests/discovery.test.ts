import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import configJson from "../data/discovery/config.json" with { type: "json" };
import {
  DiscoveryPipeline,
  candidateFromOpenAlex,
  calculateRelevance,
  deduplicateRegistryCandidates,
  exportScreeningCsv,
  extractAtlasDoisFromCsv,
  fetchJsonCached,
  findCandidateMatch,
  fuzzyTitleSimilarity,
  importScreeningCsv,
  normalizeDoi,
  normalizeTitle,
  updateRegistryIncrementally,
  validateCandidate,
  type CandidateRegistry,
  type DiscoveryCandidate,
  type DiscoveryConfig,
  type OpenAlexWork,
} from "../lib/discovery/index.ts";

const config = configJson as DiscoveryConfig;

function work(overrides: Partial<OpenAlexWork> = {}): OpenAlexWork {
  return {
    id: "https://openalex.org/W123",
    doi: "https://doi.org/10.1234/TEST.1",
    title:
      "InSb colloidal quantum dot infrared photodiode with measured detectivity",
    publication_year: 2025,
    type: "article",
    authorships: [
      {
        author: {
          id: "https://openalex.org/A1",
          display_name: "A. Researcher",
        },
      },
    ],
    primary_location: {
      landing_page_url: "https://example.test/article",
      source: { display_name: "Test Journal" },
    },
    abstract_inverted_index: {
      colloidal: [0],
      quantum: [1],
      dot: [2],
      photodiode: [3],
      infrared: [4],
      detectivity: [5],
      noise: [6],
    },
    ...overrides,
  };
}

function candidate(
  overrides: Partial<DiscoveryCandidate> = {},
): DiscoveryCandidate {
  const base = candidateFromOpenAlex(work(), config, {
    method: "keyword",
    query: "test",
    now: new Date("2026-07-19T00:00:00.000Z"),
  });
  assert.ok(base);
  return { ...base, ...overrides };
}

test("DOI normalization removes prefixes, whitespace, and case differences", () => {
  assert.equal(
    normalizeDoi(" DOI: HTTPS://DOI.ORG/10.1000/Ab C "),
    "10.1000/abc",
  );
  assert.equal(normalizeDoi("http://dx.doi.org/10.1000/Test"), "10.1000/test");
  assert.equal(normalizeDoi("  "), null);
});

test("title normalization handles Unicode, punctuation, whitespace, and ampersands", () => {
  assert.equal(
    normalizeTitle("  CQD–Photodiodes & Détectivity! "),
    "cqd photodiodes and detectivity",
  );
  assert.equal(normalizeTitle(null), "");
});

test("exact deduplication follows DOI, OpenAlex ID, then title and year", () => {
  const original = candidate();
  assert.equal(
    findCandidateMatch(candidate({ candidateId: "different" }), [original])
      .relationship?.type,
    "exact-doi",
  );
  assert.equal(
    findCandidateMatch(
      candidate({ candidateId: "different", doi: null, normalizedDoi: null }),
      [original],
    ).relationship?.type,
    "openalex-id",
  );
  assert.equal(
    findCandidateMatch(
      candidate({
        candidateId: "different",
        doi: null,
        normalizedDoi: null,
        openAlexId: "W999",
      }),
      [original],
    ).relationship?.type,
    "title-year",
  );
});

test("conservative fuzzy matches are marked possible and never silently merged", () => {
  const original = candidate({
    doi: null,
    normalizedDoi: null,
    openAlexId: "W1",
  });
  const nearTitle = `${original.title} study`;
  const near = candidate({
    candidateId: "candidate-near",
    doi: null,
    normalizedDoi: null,
    openAlexId: "W2",
    title: nearTitle,
    normalizedTitle: normalizeTitle(nearTitle),
  });
  assert.ok(fuzzyTitleSimilarity(original.title, near.title) > 0.94);
  const match = findCandidateMatch(near, [original], 0.94);
  assert.equal(match.kind, "possible");
  const result = deduplicateRegistryCandidates([original, near], 0.94);
  assert.equal(result.candidates.length, 2);
  assert.equal(result.possible, 1);
});

test("relevance score is explainable and applies positive and negative signals", () => {
  const positive = calculateRelevance(work(), config, ["cited-by"]);
  assert.ok(positive.score >= 70);
  assert.ok(
    positive.reasons.some((reason) => reason.includes("Performance metrics")),
  );
  assert.ok(
    positive.reasons.some((reason) => reason.includes("Citation-graph")),
  );
  const negative = calculateRelevance(
    work({
      title: "Theoretical review of epitaxial quantum dot lasers",
      type: "review",
      abstract_inverted_index: null,
    }),
    config,
  );
  assert.ok(negative.score < positive.score);
  assert.ok(negative.reasons.some((reason) => reason.includes("Review")));
});

test("controlled screening, PDF, and import statuses are validated", () => {
  assert.deepEqual(validateCandidate(candidate()), []);
  const invalid = candidate({
    screeningStatus: "maybe" as never,
    pdfStatus: "downloaded" as never,
    importStatus: "done" as never,
  });
  assert.equal(validateCandidate(invalid).length, 3);
});

test("existing atlas DOIs are excluded from incremental candidate updates", () => {
  const atlasDois = extractAtlasDoisFromCsv(
    "paper_id,title,doi\npaper-1,Test,10.1234/test.1\n",
  );
  const registry: CandidateRegistry = {
    schemaVersion: 1,
    configVersion: config.version,
    candidates: [],
  };
  const result = updateRegistryIncrementally(
    registry,
    [work()],
    config,
    { method: "keyword", now: new Date("2026-07-19") },
    atlasDois,
  );
  assert.equal(result.registry.candidates.length, 0);
  assert.equal(result.excludedAtlasDois, 1);
});

test("candidate screening CSV serializes and imports controlled decisions", () => {
  const registry: CandidateRegistry = {
    schemaVersion: 1,
    configVersion: config.version,
    candidates: [candidate()],
  };
  const csv = exportScreeningCsv(registry.candidates).replace(
    ",unreviewed,,,not-checked,not-started",
    ',include,,"Ready, verify D*",not-checked,queued',
  );
  const updated = importScreeningCsv(registry, csv);
  assert.equal(updated.candidates[0].screeningStatus, "include");
  assert.equal(updated.candidates[0].screeningNotes, "Ready, verify D*");
  assert.equal(updated.candidates[0].importStatus, "queued");
});

test("incremental updates preserve IDs and combine discovery provenance", () => {
  const registry: CandidateRegistry = {
    schemaVersion: 1,
    configVersion: config.version,
    candidates: [],
  };
  const first = updateRegistryIncrementally(registry, [work()], config, {
    method: "keyword",
    query: "query one",
    now: new Date("2026-07-19"),
  });
  const second = updateRegistryIncrementally(first.registry, [work()], config, {
    method: "reference",
    seedPaperId: "paper-seed",
    now: new Date("2026-07-20"),
  });
  assert.equal(second.registry.candidates.length, 1);
  assert.equal(second.added, 0);
  assert.equal(second.deduplicated, 1);
  assert.deepEqual(second.registry.candidates[0].discoveryMethods.sort(), [
    "keyword",
    "reference",
  ]);
  assert.deepEqual(second.registry.candidates[0].seedPaperIds, ["paper-seed"]);
});

test("dry run reads APIs but does not write registry, cache, or audit log", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cqd-discovery-dry-"));
  await mkdir(path.join(root, "data/discovery/cache"), { recursive: true });
  await writeFile(
    path.join(root, "data/discovery/config.json"),
    JSON.stringify({
      ...config,
      queries: ["test"],
      openAlex: { ...config.openAlex, maxPagesPerQuery: 1 },
    }),
  );
  const original = JSON.stringify({
    schemaVersion: 1,
    configVersion: config.version,
    candidates: [],
  });
  await writeFile(path.join(root, "data/discovery/candidates.json"), original);
  await writeFile(path.join(root, "data/discovery/runs.jsonl"), "");
  await writeFile(path.join(root, "data/papers.csv"), "paper_id,title,doi\n");
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({ results: [work()], meta: { next_cursor: null } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  const pipeline = new DiscoveryPipeline({
    root,
    dryRun: true,
    fetchImpl,
    now: () => new Date("2026-07-19T00:00:00.000Z"),
  });
  const result = await pipeline.discoverKeywords();
  assert.equal(result.added, 1);
  assert.equal(
    await readFile(path.join(root, "data/discovery/candidates.json"), "utf8"),
    original,
  );
  assert.equal(
    await readFile(path.join(root, "data/discovery/runs.jsonl"), "utf8"),
    "",
  );
  const cacheFiles = await import("node:fs/promises").then((fs) =>
    fs.readdir(path.join(root, "data/discovery/cache")),
  );
  assert.deepEqual(cacheFiles, []);
});

test("malformed API payloads are rejected and rate-limited requests retry", async () => {
  const cacheDirectory = await mkdtemp(
    path.join(os.tmpdir(), "cqd-discovery-api-"),
  );
  let calls = 0;
  const retryingFetch: typeof fetch = async () => {
    calls += 1;
    if (calls === 1)
      return new Response("rate limited", {
        status: 429,
        headers: { "retry-after": "0" },
      });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const result = await fetchJsonCached<{ ok: boolean }>(
    "https://example.test/retry",
    { cacheDirectory, fetchImpl: retryingFetch, minimumIntervalMs: 0 },
  );
  assert.equal(result.ok, true);
  assert.equal(calls, 2);
  const failedFetch: typeof fetch = async () =>
    new Response("bad", { status: 400 });
  await assert.rejects(
    () =>
      fetchJsonCached("https://example.test/fail", {
        cacheDirectory,
        fetchImpl: failedFetch,
        minimumIntervalMs: 0,
      }),
    /Request failed \(400\)/,
  );
});
