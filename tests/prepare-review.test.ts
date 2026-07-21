import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import configJson from "../data/discovery/config.json" with { type: "json" };
import {
  DiscoveryPipeline,
  candidateFromOpenAlex,
  extractStagedProposal,
  prepareReviewBatch,
  proposeOpenAccessCandidates,
  resolveOpenAccessPdfLocations,
  writeProposalRegistry,
  type CandidateRegistry,
  type DiscoveryCandidate,
  type DiscoveryConfig,
  type OpenAlexWork,
  type ProposalPipelineResult,
  type ProposalRegistry,
  type ProposalSource,
} from "../lib/discovery/index.ts";

const config = configJson as DiscoveryConfig;

function work(
  id: string,
  title: string,
  overrides: Partial<OpenAlexWork> = {},
): OpenAlexWork {
  return {
    id: `https://openalex.org/${id}`,
    doi: `https://doi.org/10.9999/${id.toLowerCase()}`,
    title,
    publication_year: 2026,
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
      landing_page_url: `https://example.test/${id}`,
      source: { display_name: "Test Journal" },
    },
    ...overrides,
  };
}

function candidate(
  id: string,
  title = "InAs colloidal quantum dot photodiode with measured detectivity",
  overrides: Partial<DiscoveryCandidate> = {},
): DiscoveryCandidate {
  const value = candidateFromOpenAlex(
    work(id, title, {
      best_oa_location: {
        pdf_url: `https://example.test/${id}.pdf`,
        source: { display_name: "Repository" },
      },
    }),
    config,
    {
      method: "keyword",
      query: "fixture",
      now: new Date("2026-07-21T00:00:00.000Z"),
    },
  );
  assert.ok(value);
  return { ...value, ...overrides };
}

const proposalSource: ProposalSource = {
  url: "https://example.test/paper.pdf",
  openAccessSource: "Test repository",
  pdfSha256: "a".repeat(64),
  acquiredAt: "2026-07-21T00:00:00.000Z",
  contentType: "application/pdf",
  byteLength: 1024,
  extractionEngine: "fixture",
  pageCount: 2,
  needsOcr: false,
};

async function seedRoot(
  candidates: DiscoveryCandidate[],
  proposals: ProposalRegistry["proposals"] = [],
): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "cqd-prepare-review-"));
  await mkdir(path.join(root, "data/discovery"), { recursive: true });
  await writeFile(
    path.join(root, "data/discovery/config.json"),
    `${JSON.stringify(config, null, 2)}\n`,
  );
  const registry: CandidateRegistry = {
    schemaVersion: 1,
    configVersion: config.version,
    candidates,
  };
  await writeFile(
    path.join(root, "data/discovery/candidates.json"),
    `${JSON.stringify(registry, null, 2)}\n`,
  );
  await writeFile(
    path.join(root, "data/discovery/proposals.json"),
    `${JSON.stringify({ schemaVersion: 1, proposals }, null, 2)}\n`,
  );
  await writeFile(
    path.join(root, "data/papers.csv"),
    "paper_id,title,authors,first_author,journal,publication_year,doi,publication_url,publication_type,peer_reviewed,notes\n",
  );
  return root;
}

test("prepare-review selects high-fit and curator-included candidates deterministically", async () => {
  const automatic = candidate("W-AUTO");
  const manual = candidate("W-MANUAL", "Unclassified detector report", {
    screeningStatus: "include",
    relevanceScore: 5,
    openAccessPdfUrl: null,
    openAccessPdfSource: null,
    pdfStatus: "not-checked",
  });
  const lowFit = candidate(
    "W-LOW",
    "Electronic properties of nanocrystal films",
    {
      relevanceScore: 99,
    },
  );
  const excluded = candidate("W-EXCLUDED", undefined, {
    screeningStatus: "exclude",
  });
  const processed = candidate("W-PROCESSED", undefined, {
    importStatus: "published",
  });
  const possibleDuplicate = candidate("W-DUPLICATE", undefined, {
    duplicateRelationships: [
      {
        candidateId: automatic.candidateId,
        type: "possible-fuzzy-title",
        similarity: 0.95,
      },
    ],
  });
  const exactPdfDuplicate = candidate("W-PDF-DUPLICATE", undefined, {
    duplicateRelationships: [
      {
        candidateId: automatic.candidateId,
        type: "exact-pdf-hash",
      },
    ],
  });
  const root = await seedRoot([
    automatic,
    manual,
    lowFit,
    excluded,
    processed,
    possibleDuplicate,
    exactPdfDuplicate,
  ]);
  let receivedIds: string[] = [];
  const proposalRunner = async (options: {
    candidateIds: string[];
  }): Promise<ProposalPipelineResult> => {
    receivedIds = options.candidateIds;
    return { proposals: [], skipped: [], warnings: [], cacheHits: 0 };
  };
  const result = await prepareReviewBatch({
    root,
    limit: 2,
    proposalRunner,
  });

  assert.deepEqual(receivedIds, [manual.candidateId, automatic.candidateId]);
  assert.equal(result.counts.selected, 2);
  assert.equal(result.counts.eligible, 2);
  assert.match(
    result.skipped.find((item) => item.candidateId === lowFit.candidateId)
      ?.reason ?? "",
    /lack a complete CQD/,
  );
  assert.match(
    result.skipped.find((item) => item.candidateId === excluded.candidateId)
      ?.reason ?? "",
    /explicitly excluded/,
  );
  assert.match(
    result.skipped.find(
      (item) => item.candidateId === possibleDuplicate.candidateId,
    )?.reason ?? "",
    /Possible duplicate/,
  );
  assert.match(
    result.skipped.find(
      (item) => item.candidateId === exactPdfDuplicate.candidateId,
    )?.reason ?? "",
    /PDF duplicates candidate/,
  );
});

test("prepare-review validates the batch limit before calling extraction", async () => {
  const root = await seedRoot([candidate("W-LIMIT")]);
  let called = false;
  await assert.rejects(
    () =>
      prepareReviewBatch({
        root,
        limit: 0,
        proposalRunner: async () => {
          called = true;
          return { proposals: [], skipped: [], warnings: [], cacheHits: 0 };
        },
      }),
    /positive integer/,
  );
  assert.equal(called, false);
});

test("proposal pipeline accepts candidates from a dry-run refresh registry", async () => {
  const transient = candidate("W-DRY-RUN-ONLY");
  const root = await seedRoot([]);
  const result = await proposeOpenAccessCandidates({
    root,
    candidateIds: [transient.candidateId],
    candidateRegistry: {
      schemaVersion: 1,
      configVersion: config.version,
      candidates: [transient],
    },
    dryRun: true,
    resolvePdfLocationsImpl: async () => ({ locations: [], warnings: [] }),
  });

  assert.equal(
    result.skipped.some(
      (item) =>
        item.stage === "selection" && item.reason === "Candidate not found",
    ),
    false,
  );
  assert.equal(result.skipped[0]?.stage, "resolution");
});

test("full-text resolution combines and deduplicates recorded, refreshed, and DOI locations", async () => {
  const item = candidate("W-RESOLVE", undefined, {
    openAccessPdfUrl: "https://example.test/recorded.pdf",
  });
  const cacheDirectory = await mkdtemp(
    path.join(os.tmpdir(), "cqd-resolution-"),
  );
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("api.openalex.org")) {
      return new Response(
        JSON.stringify(
          work("W-RESOLVE", item.title, {
            best_oa_location: {
              pdf_url: "https://example.test/refreshed.pdf",
              source: { display_name: "OpenAlex repository" },
            },
          }),
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("api.unpaywall.org")) {
      return new Response(
        JSON.stringify({
          best_oa_location: {
            url_for_pdf: "https://example.test/unpaywall.pdf",
            host_type: "repository",
            version: "acceptedVersion",
          },
          oa_locations: [{ url_for_pdf: "https://example.test/refreshed.pdf" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  const resolution = await resolveOpenAccessPdfLocations(item, {
    config,
    cacheDirectory,
    fetchImpl,
  });

  assert.deepEqual(
    resolution.locations.map((location) => location.url),
    [
      "https://example.test/recorded.pdf",
      "https://example.test/refreshed.pdf",
      "https://example.test/unpaywall.pdf",
    ],
  );
  assert.deepEqual(resolution.warnings, []);
});

test("proposal preparation never replaces an existing curator decision", async () => {
  const item = candidate("W-DECISION");
  const existing = {
    ...extractStagedProposal(
      item,
      proposalSource,
      [
        "=== PDF PAGE 1 ===",
        "An experimental solution-processed colloidal quantum dot photodiode was fabricated.",
        "=== PDF PAGE 2 ===",
        "At 1550 nm, the specific detectivity D* was 2.0 × 10^11 Jones.",
      ].join("\n"),
      new Date("2026-07-21T00:00:00.000Z"),
    ),
    status: "rejected" as const,
    decisionNotes: "Comparison value was not from the original device.",
    decidedAt: "2026-07-21T01:00:00.000Z",
  };
  const root = await seedRoot([item], [existing]);
  let resolverCalled = false;
  const result = await proposeOpenAccessCandidates({
    root,
    candidateIds: [item.candidateId],
    resolvePdfLocationsImpl: async () => {
      resolverCalled = true;
      return { locations: [], warnings: [] };
    },
  });
  const stored = JSON.parse(
    await readFile(path.join(root, "data/discovery/proposals.json"), "utf8"),
  ) as ProposalRegistry;

  assert.equal(resolverCalled, false);
  assert.equal(result.proposals.length, 0);
  assert.match(result.skipped[0]?.reason ?? "", /already exists/);
  assert.equal(stored.proposals[0].status, "rejected");
  assert.equal(stored.proposals[0].decisionNotes, existing.decisionNotes);
});

test("proposal preparation preserves an approval made while resolution is running", async () => {
  const active = candidate("W-LONG-RUN");
  const reviewedCandidate = candidate("W-CONCURRENT-APPROVAL");
  const awaiting = extractStagedProposal(
    reviewedCandidate,
    { ...proposalSource, pdfSha256: "b".repeat(64) },
    [
      "=== PDF PAGE 1 ===",
      "An experimental solution-processed colloidal quantum dot photodiode was fabricated.",
      "=== PDF PAGE 2 ===",
      "At 1550 nm, the specific detectivity D* was 2.0 × 10^11 Jones.",
    ].join("\n"),
    new Date("2026-07-21T00:00:00.000Z"),
  );
  assert.equal(awaiting.scopeStatus, "in-scope");
  assert.ok(awaiting.proposedMeasurements.length > 0);
  const root = await seedRoot([active, reviewedCandidate], [awaiting]);

  let markResolverEntered: () => void = () => undefined;
  const resolverEntered = new Promise<void>((resolve) => {
    markResolverEntered = resolve;
  });
  let releaseResolver: () => void = () => undefined;
  const resolverReleased = new Promise<void>((resolve) => {
    releaseResolver = resolve;
  });
  const preparation = proposeOpenAccessCandidates({
    root,
    candidateIds: [active.candidateId],
    resolvePdfLocationsImpl: async () => {
      markResolverEntered();
      await resolverReleased;
      return { locations: [], warnings: [] };
    },
  });

  await resolverEntered;
  await writeProposalRegistry(
    path.join(root, "data/discovery/proposals.json"),
    {
      schemaVersion: 1,
      proposals: [
        {
          ...awaiting,
          status: "approved",
          decisionNotes: "Approved while another paper was being resolved.",
          decidedAt: "2026-07-21T02:00:00.000Z",
        },
      ],
    },
  );
  releaseResolver();
  await preparation;

  const stored = JSON.parse(
    await readFile(path.join(root, "data/discovery/proposals.json"), "utf8"),
  ) as ProposalRegistry;
  assert.equal(stored.proposals[0].status, "approved");
  assert.equal(
    stored.proposals[0].decisionNotes,
    "Approved while another paper was being resolved.",
  );
});

test("discovery and proposal preparation preserve each other's candidate updates", async () => {
  const active = candidate("W-CONCURRENT-PREP");
  const discoveredWork = work(
    "W-CONCURRENT-DISCOVERY",
    "PbS colloidal quantum dot photodiode with measured detectivity",
  );
  const root = await seedRoot([active]);
  let markSearchEntered: () => void = () => undefined;
  const searchEntered = new Promise<void>((resolve) => {
    markSearchEntered = resolve;
  });
  let releaseSearch: () => void = () => undefined;
  const searchReleased = new Promise<void>((resolve) => {
    releaseSearch = resolve;
  });
  const discovery = new DiscoveryPipeline({
    root,
    fetchImpl: async () => {
      markSearchEntered();
      await searchReleased;
      return new Response(
        JSON.stringify({
          results: [discoveredWork],
          meta: { next_cursor: null },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
    now: () => new Date("2026-07-21T03:00:00.000Z"),
  }).discoverKeywords(["fixture query"]);

  await searchEntered;
  let markResolverEntered: () => void = () => undefined;
  const resolverEntered = new Promise<void>((resolve) => {
    markResolverEntered = resolve;
  });
  const preparation = proposeOpenAccessCandidates({
    root,
    candidateIds: [active.candidateId],
    resolvePdfLocationsImpl: async () => {
      markResolverEntered();
      return { locations: [], warnings: [] };
    },
  });
  await resolverEntered;
  await new Promise((resolve) => setTimeout(resolve, 25));
  releaseSearch();
  await Promise.all([discovery, preparation]);

  const stored = JSON.parse(
    await readFile(path.join(root, "data/discovery/candidates.json"), "utf8"),
  ) as CandidateRegistry;
  assert.equal(stored.candidates.length, 2);
  assert.ok(
    stored.candidates.some((item) => item.openAlexId === discoveredWork.id),
  );
  const prepared = stored.candidates.find(
    (item) => item.candidateId === active.candidateId,
  );
  assert.equal(prepared?.pdfStatus, "requested");
  assert.equal(prepared?.importStatus, "queued");
});
