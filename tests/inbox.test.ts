import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  inboxPaths,
  initializeInbox,
  readInboxLedger,
  runInboxOnce,
  type InboxReviewPackage,
} from "../lib/inbox/index.ts";
import type {
  ProposalSource,
  StagedPaperProposal,
} from "../lib/discovery/proposal-types.ts";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function proposal(id: string, source: ProposalSource): StagedPaperProposal {
  const paperId = `paper-${id}`;
  return {
    proposalId: `proposal-${id}`,
    candidateId: `local-${id}`,
    source,
    scopeStatus: "uncertain",
    scopeReasons: ["Fixture"],
    proposedPaper: {
      paper_id: paperId,
      title: "Fixture paper",
      authors: [],
      first_author: "",
      journal: null,
      publication_year: 2026,
      doi: null,
      publication_url: null,
      publication_type: "journal_article",
      peer_reviewed: true,
      notes: "Fixture",
    },
    proposedDevices: [],
    proposedMeasurements: [],
    evidence: [],
    warnings: ["Fixture warning"],
    missingFields: ["paper.first_author"],
    status: "awaiting-approval",
    decisionNotes: null,
    proposedAt: "2026-07-28T00:00:02.000Z",
    decidedAt: null,
    appliedAt: null,
    extractorVersion: "photodiode-proposal-extractor-v3",
  };
}

async function seed(): Promise<{
  repositoryRoot: string;
  inboxRoot: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "cqd-inbox-test-"));
  const repositoryRoot = path.join(root, "repository");
  const inboxRoot = path.join(root, "inbox");
  await mkdir(repositoryRoot, { recursive: true });
  await initializeInbox(inboxRoot);
  return { repositoryRoot, inboxRoot };
}

test("paper inbox settles a file before producing a review package", async () => {
  const { repositoryRoot, inboxRoot } = await seed();
  const paths = inboxPaths(inboxRoot);
  const contents = "%PDF-1.4\nfixture";
  await writeFile(path.join(paths.incoming, "fixture-paper.pdf"), contents);
  let clock = new Date("2026-07-28T00:00:00.000Z");
  let calls = 0;
  const first = await runInboxOnce({
    repositoryRoot,
    inboxRoot,
    settleMs: 1_000,
    now: () => clock,
  });
  assert.equal(first.settling, 1);
  assert.equal(first.readyForReview, 0);

  clock = new Date("2026-07-28T00:00:02.000Z");
  const second = await runInboxOnce(
    {
      repositoryRoot,
      inboxRoot,
      settleMs: 1_000,
      now: () => clock,
    },
    {
      processPaper: async (options) => {
        calls += 1;
        const sha = digest(contents);
        const source: ProposalSource = {
          url: `file:///local-watched-folder/${sha}.pdf`,
          openAccessSource: "Fixture",
          pdfSha256: sha,
          acquiredAt: clock.toISOString(),
          contentType: "application/pdf",
          byteLength: contents.length,
          extractionEngine: "fixture",
          pageCount: 1,
          needsOcr: false,
          supportingDocuments: [],
        };
        const staged = proposal(options.job.jobId, source);
        const reviewPackage: InboxReviewPackage = {
          schemaVersion: 1,
          job: {
            jobId: options.job.jobId,
            sourceKey: options.job.sourceKey,
            displayName: options.job.displayName,
            mainPdf: options.job.mainPdf!,
            supportingPdfs: [],
            processedAt: clock.toISOString(),
          },
          proposal: staged,
        };
        return {
          proposal: staged,
          mainPdfSha256: sha,
          needsOcr: false,
          reviewPackage,
        };
      },
    },
  );
  assert.equal(calls, 1);
  assert.equal(second.readyForReview, 1);
  const ledger = await readInboxLedger(paths);
  assert.equal(ledger.jobs[0].status, "ready-for-review");
  assert.ok(ledger.jobs[0].proposalFile);
  assert.ok(ledger.jobs[0].summaryFile);
  const stored = JSON.parse(
    await readFile(ledger.jobs[0].proposalFile!, "utf8"),
  ) as InboxReviewPackage;
  assert.equal(stored.proposal.proposedPaper.title, "Fixture paper");
  assert.equal((await stat(ledger.jobs[0].summaryFile!)).isFile(), true);
});

test("identical main PDFs become one proposal and one duplicate", async () => {
  const { repositoryRoot, inboxRoot } = await seed();
  const paths = inboxPaths(inboxRoot);
  const contents = "%PDF-1.4\nsame paper";
  await writeFile(path.join(paths.incoming, "first.pdf"), contents);
  await writeFile(path.join(paths.incoming, "second.pdf"), contents);
  let clock = new Date("2026-07-28T00:00:00.000Z");
  await runInboxOnce({
    repositoryRoot,
    inboxRoot,
    settleMs: 1_000,
    concurrency: 1,
    now: () => clock,
  });
  clock = new Date("2026-07-28T00:00:02.000Z");
  let calls = 0;
  const result = await runInboxOnce(
    {
      repositoryRoot,
      inboxRoot,
      settleMs: 1_000,
      concurrency: 1,
      now: () => clock,
    },
    {
      processPaper: async (options) => {
        calls += 1;
        const sha = digest(contents);
        const source: ProposalSource = {
          url: `file:///local-watched-folder/${sha}.pdf`,
          openAccessSource: "Fixture",
          pdfSha256: sha,
          acquiredAt: clock.toISOString(),
          contentType: "application/pdf",
          byteLength: contents.length,
          extractionEngine: "fixture",
          pageCount: 1,
          needsOcr: false,
        };
        const staged = proposal(options.job.jobId, source);
        return {
          proposal: staged,
          mainPdfSha256: sha,
          needsOcr: false,
          reviewPackage: {
            schemaVersion: 1,
            job: {
              jobId: options.job.jobId,
              sourceKey: options.job.sourceKey,
              displayName: options.job.displayName,
              mainPdf: options.job.mainPdf!,
              supportingPdfs: [],
              processedAt: clock.toISOString(),
            },
            proposal: staged,
          },
        };
      },
    },
  );
  assert.equal(calls, 1);
  assert.equal(result.readyForReview, 1);
  assert.equal(result.duplicates, 1);
  const ledger = await readInboxLedger(paths);
  const duplicate = ledger.jobs.find((job) => job.status === "duplicate");
  assert.ok(duplicate?.duplicateOf);
});

test("ambiguous paper folders stop for attention without parsing", async () => {
  const { repositoryRoot, inboxRoot } = await seed();
  const paths = inboxPaths(inboxRoot);
  const folder = path.join(paths.incoming, "ambiguous");
  await mkdir(folder);
  await writeFile(path.join(folder, "article-one.pdf"), "%PDF-1.4\none");
  await writeFile(path.join(folder, "article-two.pdf"), "%PDF-1.4\ntwo");
  let calls = 0;
  const result = await runInboxOnce(
    {
      repositoryRoot,
      inboxRoot,
      settleMs: 0,
      now: () => new Date("2026-07-28T00:00:00.000Z"),
    },
    {
      processPaper: async () => {
        calls += 1;
        throw new Error("should not run");
      },
    },
  );
  assert.equal(calls, 0);
  assert.equal(result.needsAttention, 1);
  const ledger = await readInboxLedger(paths);
  assert.match(ledger.jobs[0].error ?? "", /main PDFs/);
  assert.ok(ledger.jobs[0].summaryFile);
});
