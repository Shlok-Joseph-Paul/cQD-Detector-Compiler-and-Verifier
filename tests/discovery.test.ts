import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import configJson from "../data/discovery/config.json" with { type: "json" };
import {
  DiscoveryPipeline,
  acquireOpenAccessPdf,
  candidateFromOpenAlex,
  calculateRelevance,
  deduplicateRegistryCandidates,
  exportScreeningCsv,
  exportProposalDecisionsCsv,
  extractExtendedMetricCandidates,
  extractStagedProposal,
  extractAtlasDoisFromCsv,
  filterPublicDiscoveryCandidates,
  filterPublicDiscoveryProposals,
  fetchJsonCached,
  findCandidateMatch,
  fuzzyTitleSimilarity,
  importScreeningCsv,
  importProposalDecisionsCsv,
  normalizeDoi,
  normalizeTitle,
  convertPrefixedValue,
  selectMetricCandidate,
  rankNewCandidates,
  renderCandidateShortlist,
  updateRegistryIncrementally,
  validateCandidate,
  type CandidateRegistry,
  type DiscoveryCandidate,
  type DiscoveryConfig,
  type OpenAlexWork,
  type ProposalSource,
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

const proposalSource: ProposalSource = {
  url: "https://example.test/paper.pdf",
  openAccessSource: "OpenAlex",
  pdfSha256: "a".repeat(64),
  acquiredAt: "2026-07-19T00:00:00.000Z",
  contentType: "application/pdf",
  byteLength: 1024,
  extractionEngine: "fixture",
  pageCount: 2,
  needsOcr: false,
};

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

test("human shortlist excludes atlas duplicates and ranks new paper links", () => {
  const existingTitle = candidate({
    candidateId: "existing-title",
    doi: "10.9999/preprint",
    normalizedDoi: "10.9999/preprint",
    title: "Already Published CQD Photodiode",
    normalizedTitle: normalizeTitle("Already Published CQD Photodiode"),
  });
  const high = candidate({
    candidateId: "new-high",
    doi: "10.9999/new-high",
    normalizedDoi: "10.9999/new-high",
    title: "New Ag2Te Colloidal Quantum Dot Photodiode with Detectivity",
    normalizedTitle: normalizeTitle(
      "New Ag2Te Colloidal Quantum Dot Photodiode with Detectivity",
    ),
    relevanceScore: 92,
    openAccessPdfUrl: "https://example.test/new-high.pdf",
  });
  const low = candidate({
    candidateId: "new-low",
    doi: "10.9999/new-low",
    normalizedDoi: "10.9999/new-low",
    title: "Nanocrystal detector study",
    normalizedTitle: normalizeTitle("Nanocrystal detector study"),
    relevanceScore: 42,
  });
  const review = candidate({
    candidateId: "review",
    title: "Review of colloidal infrared photodetectors",
    normalizedTitle: normalizeTitle(
      "Review of colloidal infrared photodetectors",
    ),
  });
  const papersCsv =
    "paper_id,title,doi\npaper-1,Already Published CQD Photodiode,10.9999/article\n";
  const ranked = rankNewCandidates(
    [low, existingTitle, review, high],
    papersCsv,
  );
  assert.deepEqual(
    ranked.map((item) => item.candidateId),
    ["new-high", "new-low"],
  );
  const markdown = renderCandidateShortlist(
    [low, existingTitle, review, high],
    papersCsv,
  );
  assert.match(markdown, /https:\/\/doi\.org\/10\.9999\/new-high/);
  assert.match(markdown, /open PDF/);
  assert.doesNotMatch(markdown, /Already Published/);
  assert.doesNotMatch(markdown, /Review of/);
});

test("public discovery queue omits atlas papers, applied proposals, and unrelated records", () => {
  const atlasPaper = {
    paper_id: "paper-1",
    title: "Already Published CQD Photodiode",
    authors: ["A. Researcher"],
    first_author: "A. Researcher",
    journal: "Test Journal",
    publication_year: 2025,
    doi: "10.9999/article",
    publication_url: "https://doi.org/10.9999/article",
    publication_type: "journal_article" as const,
    peer_reviewed: true,
    notes: null,
  };
  const duplicate = candidate({
    candidateId: "duplicate",
    doi: "10.9999/article",
    normalizedDoi: "10.9999/article",
  });
  const unrelated = candidate({
    candidateId: "candidate-6d75de2413fbe344",
  });
  const fresh = candidate({ candidateId: "fresh" });
  assert.deepEqual(
    filterPublicDiscoveryCandidates(
      [duplicate, unrelated, fresh],
      [atlasPaper],
    ).map((item) => item.candidateId),
    ["fresh"],
  );

  const proposal = {
    proposalId: "proposal-1",
    candidateId: "duplicate",
    source: {
      url: "https://example.test/paper.pdf",
      openAccessSource: "test",
      pdfSha256: "a".repeat(64),
      acquiredAt: "2026-07-20T00:00:00.000Z",
      contentType: "application/pdf",
      byteLength: 100,
      extractionEngine: "pypdf",
      pageCount: 1,
      needsOcr: false,
    },
    scopeStatus: "in-scope" as const,
    scopeReasons: [],
    proposedPaper: atlasPaper,
    proposedDevices: [],
    proposedMeasurements: [],
    evidence: [],
    warnings: [],
    missingFields: [],
    status: "applied" as const,
    decisionNotes: null,
    proposedAt: "2026-07-20T00:00:00.000Z",
    decidedAt: null,
    appliedAt: "2026-07-20T00:00:00.000Z",
    extractorVersion: "cqd-proposal-extractor-v2" as const,
  };
  assert.deepEqual(
    filterPublicDiscoveryProposals([proposal], [atlasPaper]),
    [],
  );
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

test("open-access acquisition accepts verified PDFs and rejects non-PDF responses", async () => {
  const cacheDirectory = await mkdtemp(
    path.join(os.tmpdir(), "cqd-pdf-acquisition-"),
  );
  const pdfFetch: typeof fetch = async () =>
    new Response(new TextEncoder().encode("%PDF-1.7\nfixture"), {
      status: 200,
      headers: { "content-type": "application/pdf" },
    });
  const acquired = await acquireOpenAccessPdf(
    "https://example.test/paper.pdf",
    cacheDirectory,
    { fetchImpl: pdfFetch },
  );
  assert.equal(acquired.contentType, "application/pdf");
  assert.equal(acquired.sha256.length, 64);
  assert.match(await readFile(acquired.path, "utf8"), /^%PDF-/);

  const htmlFetch: typeof fetch = async () =>
    new Response("<html>login</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  await assert.rejects(
    () =>
      acquireOpenAccessPdf("https://example.test/not-a-pdf", cacheDirectory, {
        fetchImpl: htmlFetch,
      }),
    /did not return a PDF/,
  );
  await assert.rejects(
    () =>
      acquireOpenAccessPdf(
        "https://user:secret@example.test/paper.pdf",
        cacheDirectory,
        { fetchImpl: pdfFetch },
      ),
    /Authenticated PDF URLs are not allowed/,
  );
});

test("extractor stages co-located detectivity and wavelength with conservative noise flags", () => {
  const markedText = [
    "=== PDF PAGE 1 ===",
    "We fabricated a solution-processed colloidal quantum dot photodiode based on Ag2Te CQDs.",
    "=== PDF PAGE 2 ===",
    "At 1520 nm and -0.1 V, the specific detectivity D* reached 3.6 × 10^12 Jones. The detectivity was calculated using the theoretical shot-noise current.",
  ].join("\n");
  const proposal = extractStagedProposal(
    candidate({ candidateMaterialClasses: ["Ag2Te"] }),
    proposalSource,
    markedText,
    new Date("2026-07-19T00:00:00.000Z"),
  );
  assert.equal(proposal.scopeStatus, "in-scope");
  assert.equal(proposal.proposedMeasurements.length, 1);
  assert.equal(proposal.proposedMeasurements[0].wavelength_nm, 1520);
  assert.equal(proposal.proposedMeasurements[0].detectivity_jones, 3.6e12);
  assert.equal(
    proposal.proposedMeasurements[0].noise_method,
    "shot_noise_approximation",
  );
  assert.equal(proposal.proposedMeasurements[0].flag, "amber");
});

test("extractor prefers richer results-page evidence and measured-noise apparatus", () => {
  const markedText = [
    "=== PDF PAGE 1 ===",
    "A solution-processed colloidal quantum dot photodiode reached D* of 2.3 × 10^11 Jones at 1540 nm.",
    "=== PDF PAGE 2 ===",
    "The device area (0.06 cm2) was used. The noise spectral density was measured using a low-frequency noise test system (LFN-2000).",
    "=== PDF PAGE 5 ===",
    "The noise current measured at 0 V and 1 Hz was used in the calculation of D*. The optimized device achieved a responsivity of 0.22 A/W at 1540 nm under zero bias, corresponding to a D* of 2.3 × 10^11 Jones.",
  ].join("\n");
  const proposal = extractStagedProposal(
    candidate({ candidateMaterialClasses: ["Ag2Te"] }),
    proposalSource,
    markedText,
    new Date("2026-07-19T00:00:00.000Z"),
  );
  const measurement = proposal.proposedMeasurements[0];
  assert.equal(measurement.source_location, "PDF page 5");
  assert.equal(measurement.responsivity_a_w, 0.22);
  assert.equal(measurement.bias_v, 0);
  assert.equal(measurement.measurement_frequency_hz, 1);
  assert.equal(measurement.noise_method, "measured_noise");
  assert.deepEqual(measurement.noise_instruments, ["dedicated_noise_analyzer"]);
  assert.equal(proposal.proposedDevices[0].active_area_cm2, 0.06);
});

test("extractor checks Supporting Information for the noise apparatus", () => {
  const proposal = extractStagedProposal(
    candidate({ candidateMaterialClasses: ["HgCdSe"] }),
    proposalSource,
    [
      "=== PDF PAGE 1 ===",
      "A solution-processed colloidal quantum dot photodiode was demonstrated.",
      "=== PDF PAGE 7 ===",
      "At 1355 nm, D* reached 1.4 × 10^12 Jones using measured noise.",
    ].join("\n"),
    new Date("2026-07-19T00:00:00.000Z"),
    [
      {
        label: "Supporting Information",
        markedText: [
          "=== PDF PAGE 5 ===",
          "Transient photocurrent was recorded with a Keithley 2602B SMU.",
          "=== PDF PAGE 6 ===",
          "The noise current was measured by connecting the photodetector to a trans-impedance preamplifier (SR570) and a lock-in amplifier (SR830).",
        ].join("\n"),
      },
    ],
  );
  const measurement = proposal.proposedMeasurements[0];
  assert.equal(measurement.noise_method, "measured_noise");
  assert.deepEqual(measurement.noise_instruments, ["lock_in_amplifier"]);
  assert.equal(
    measurement.noise_instrument_source,
    "Supporting Information PDF page 6",
  );
  assert.doesNotMatch(
    measurement.noise_instrument_details ?? "",
    /Keithley|SMU/,
  );
});

test("proposal decisions require an in-scope measurement before approval", () => {
  const uncertain = extractStagedProposal(
    candidate(),
    proposalSource,
    "=== PDF PAGE 1 ===\nThis metadata page contains no device measurement.",
    new Date("2026-07-19T00:00:00.000Z"),
  );
  const registry = { schemaVersion: 1 as const, proposals: [uncertain] };
  const approvalCsv = exportProposalDecisionsCsv(registry).replace(
    "awaiting-approval",
    "approved",
  );
  assert.throws(
    () =>
      importProposalDecisionsCsv(
        registry,
        approvalCsv,
        new Date("2026-07-20T00:00:00.000Z"),
      ),
    /only an in-scope proposal with measurements can be approved/,
  );

  const rejectedCsv = exportProposalDecisionsCsv(registry).replace(
    "awaiting-approval",
    "rejected",
  );
  const rejected = importProposalDecisionsCsv(registry, rejectedCsv);
  assert.equal(rejected.proposals[0].status, "rejected");
});

test("extended metric extraction converts units and separates temporal definitions", () => {
  assert.equal(convertPrefixedValue(250, "m"), 0.25);
  assert.equal(convertPrefixedValue(8, "n"), 8e-9);
  const metrics = extractExtendedMetricCandidates([
    {
      page: 4,
      documentLabel: "Main article",
      text: [
        "At 1550 nm and -0.2 V, the responsivity was 250 mA/W.",
        "The 10-90% rise time was 8 ns and the fall time was 12 ns.",
        "The explicit -3 dB bandwidth was 42 MHz.",
        "The detector exhibited a linear dynamic range (LDR) of 86 dB.",
      ].join(" "),
    },
  ]);
  assert.equal(metrics.responsivity[0]?.value, 0.25);
  assert.equal(metrics.responsivity[0]?.wavelengthNm, 1550);
  assert.equal(
    metrics.temporal.find((item) => item.kind === "rise")?.value,
    8e-9,
  );
  assert.ok(
    Math.abs(
      (metrics.temporal.find((item) => item.kind === "fall")?.value ?? 0) -
        12e-9,
    ) < 1e-18,
  );
  assert.equal(metrics.bandwidth[0]?.value, 42e6);
  assert.equal(metrics.bandwidth[0]?.limit, "measured");
  assert.equal(metrics.ldr[0]?.value, 86);
});

test("extended metrics preserve condition matching, paired rise/fall values, bounds, and LDR ranges", () => {
  const metrics = extractExtendedMetricCandidates([
    {
      page: 8,
      documentLabel: "Supporting Information",
      text: [
        "At 940 nm and -1 V, the responsivity was 0.22 A/W.",
        "At 1550 nm and -3 V, the responsivity was 0.60 A/W.",
        "The rise and fall times were 26 and 40 us, respectively (10-90%).",
        "The explicit -3 dB bandwidth exceeded 100 kHz, the measurement limit.",
        "The linear optical-input range (LDR) was from 10 nW/cm2 to 4 mW/cm2.",
      ].join(" "),
    },
  ]);
  assert.equal(
    selectMetricCandidate(metrics.responsivity, 940, -1)?.value,
    0.22,
  );
  assert.equal(
    metrics.temporal.find((item) => item.kind === "rise")?.value,
    26e-6,
  );
  assert.ok(
    Math.abs(
      (metrics.temporal.find((item) => item.kind === "fall")?.value ?? 0) -
        40e-6,
    ) < 1e-15,
  );
  assert.equal(metrics.bandwidth[0]?.value, 100e3);
  assert.equal(metrics.bandwidth[0]?.limit, "lower_bound");
  assert.equal(metrics.ldr[0]?.minimum, 10e-9);
  assert.equal(metrics.ldr[0]?.maximum, 4e-3);
});

test("bandwidth extraction rejects noise bandwidths and unqualified test frequencies", () => {
  const metrics = extractExtendedMetricCandidates([
    {
      page: 3,
      documentLabel: "Main article",
      text: [
        "The noise-equivalent bandwidth was set to 1 Hz for D*.",
        "The response was tested at modulation frequencies up to 2 MHz.",
      ].join(" "),
    },
  ]);
  assert.deepEqual(metrics.bandwidth, []);
});
