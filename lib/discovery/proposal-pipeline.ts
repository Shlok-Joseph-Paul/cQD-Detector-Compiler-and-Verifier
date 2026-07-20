import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { acquireOpenAccessPdf } from "./pdf-acquisition.ts";
import { extractStagedProposal } from "./proposal-extractor.ts";
import { readCandidateRegistry, writeCandidateRegistry } from "./pipeline.ts";
import {
  readProposalRegistry,
  writeProposalRegistry,
} from "./proposal-registry.ts";
import type {
  BatchManifest,
  ProposalSource,
  StagedPaperProposal,
} from "./proposal-types.ts";

const execFileAsync = promisify(execFile);

export interface ProposalPipelineOptions {
  root: string;
  candidateIds: string[];
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  pythonExecutable?: string;
  cacheDirectory?: string;
}

export interface ProposalPipelineResult {
  proposals: StagedPaperProposal[];
  skipped: Array<{ candidateId: string; reason: string }>;
  cacheHits: number;
}

export async function proposeOpenAccessCandidates(
  options: ProposalPipelineOptions,
): Promise<ProposalPipelineResult> {
  const now = options.now ?? (() => new Date());
  const candidateFile = path.join(
    options.root,
    "data/discovery/candidates.json",
  );
  const proposalFile = path.join(options.root, "data/discovery/proposals.json");
  const candidateRegistry = await readCandidateRegistry(candidateFile);
  const proposalRegistry = await readProposalRegistry(proposalFile);
  const selected = options.candidateIds
    .map((id) =>
      candidateRegistry.candidates.find(
        (candidate) => candidate.candidateId === id,
      ),
    )
    .filter((candidate) => Boolean(candidate));
  const missingIds = options.candidateIds.filter(
    (id) => !selected.some((candidate) => candidate!.candidateId === id),
  );
  const skipped: ProposalPipelineResult["skipped"] = missingIds.map(
    (candidateId) => ({ candidateId, reason: "Candidate not found" }),
  );
  const baseCache =
    options.cacheDirectory ?? path.join(os.tmpdir(), "cqd-paper-import-cache");
  const cacheDirectory = options.dryRun
    ? await mkdtemp(path.join(os.tmpdir(), "cqd-paper-proposal-dry-"))
    : baseCache;
  const acquired: Array<{
    candidate: NonNullable<(typeof selected)[number]>;
    pdf: Awaited<ReturnType<typeof acquireOpenAccessPdf>>;
  }> = [];
  for (const candidate of selected) {
    if (!candidate!.openAccessPdfUrl) {
      skipped.push({
        candidateId: candidate!.candidateId,
        reason: "No OpenAlex open-access PDF URL",
      });
      continue;
    }
    try {
      const pdf = await acquireOpenAccessPdf(
        candidate!.openAccessPdfUrl,
        path.join(cacheDirectory, "acquisition"),
        { fetchImpl: options.fetchImpl },
      );
      acquired.push({ candidate: candidate!, pdf });
    } catch (error) {
      skipped.push({
        candidateId: candidate!.candidateId,
        reason: (error as Error).message,
      });
    }
  }
  if (acquired.length === 0) return { proposals: [], skipped, cacheHits: 0 };

  const extractionDirectory = path.join(cacheDirectory, "extraction");
  const script = path.join(options.root, "scripts/batch_extract.py");
  await execFileAsync(
    options.pythonExecutable ?? process.env.PYTHON ?? "python3",
    [
      script,
      "--cache-dir",
      extractionDirectory,
      ...acquired.map((item) => item.pdf.path),
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  let manifest = JSON.parse(
    await readFile(
      path.join(extractionDirectory, "batch-manifest.json"),
      "utf8",
    ),
  ) as BatchManifest;
  const supportingByCandidate = new Map<
    string,
    Array<Awaited<ReturnType<typeof acquireOpenAccessPdf>>>
  >();
  for (const item of acquired) {
    const record = manifest.papers.find(
      (paper) => paper.sha256 === item.pdf.sha256,
    );
    for (const url of record?.supporting_information_urls ?? []) {
      try {
        const pdf = await acquireOpenAccessPdf(
          url,
          path.join(cacheDirectory, "acquisition", "supporting-information"),
          { fetchImpl: options.fetchImpl },
        );
        const documents =
          supportingByCandidate.get(item.candidate.candidateId) ?? [];
        if (!documents.some((document) => document.sha256 === pdf.sha256))
          documents.push(pdf);
        supportingByCandidate.set(item.candidate.candidateId, documents);
      } catch (error) {
        skipped.push({
          candidateId: item.candidate.candidateId,
          reason: `Supporting Information could not be acquired: ${(error as Error).message}`,
        });
      }
    }
  }
  const supportingPdfs = [...supportingByCandidate.values()].flat();
  if (supportingPdfs.length) {
    await execFileAsync(
      options.pythonExecutable ?? process.env.PYTHON ?? "python3",
      [
        script,
        "--cache-dir",
        extractionDirectory,
        ...acquired.map((item) => item.pdf.path),
        ...supportingPdfs.map((item) => item.path),
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );
    manifest = JSON.parse(
      await readFile(
        path.join(extractionDirectory, "batch-manifest.json"),
        "utf8",
      ),
    ) as BatchManifest;
  }
  const proposals: StagedPaperProposal[] = [];
  for (const item of acquired) {
    const record = manifest.papers.find(
      (paper) => paper.sha256 === item.pdf.sha256,
    );
    if (!record || record.error || !record.text_path) {
      skipped.push({
        candidateId: item.candidate.candidateId,
        reason: record?.error ?? "PDF extraction manifest was incomplete",
      });
      continue;
    }
    const supportingDocuments =
      supportingByCandidate.get(item.candidate.candidateId) ?? [];
    const supportingTexts = await Promise.all(
      supportingDocuments.map(async (document, index) => {
        const supportingRecord = manifest.papers.find(
          (paper) => paper.sha256 === document.sha256,
        );
        if (!supportingRecord?.text_path || supportingRecord.error) return null;
        return {
          label: `Supporting Information${supportingDocuments.length > 1 ? ` ${index + 1}` : ""}`,
          markedText: await readFile(supportingRecord.text_path, "utf8"),
          record: supportingRecord,
          document,
        };
      }),
    );
    const usableSupportingTexts = supportingTexts.filter(
      (document): document is NonNullable<typeof document> => document !== null,
    );
    const source: ProposalSource = {
      url: item.pdf.finalUrl,
      openAccessSource:
        item.candidate.openAccessPdfSource ?? "OpenAlex open-access location",
      pdfSha256: item.pdf.sha256,
      acquiredAt: now().toISOString(),
      contentType: item.pdf.contentType,
      byteLength: item.pdf.byteLength,
      extractionEngine: record.extraction_engine ?? "unknown",
      pageCount: record.page_count ?? 0,
      needsOcr: record.needs_ocr ?? false,
      supportingDocuments: usableSupportingTexts.map(
        ({ document, record }) => ({
          url: document.finalUrl,
          pdfSha256: document.sha256,
          extractionEngine: record.extraction_engine ?? "unknown",
          pageCount: record.page_count ?? 0,
          needsOcr: record.needs_ocr ?? false,
        }),
      ),
    };
    proposals.push(
      extractStagedProposal(
        item.candidate,
        source,
        await readFile(record.text_path, "utf8"),
        now(),
        usableSupportingTexts.map(({ label, markedText }) => ({
          label,
          markedText,
        })),
      ),
    );
  }
  const nextProposalRegistry = {
    ...proposalRegistry,
    proposals: [
      ...proposalRegistry.proposals.filter(
        (existing) =>
          !proposals.some(
            (proposal) => proposal.proposalId === existing.proposalId,
          ),
      ),
      ...proposals,
    ],
  };
  const proposalIds = new Set(
    proposals.map((proposal) => proposal.candidateId),
  );
  const nextCandidateRegistry = {
    ...candidateRegistry,
    candidates: candidateRegistry.candidates.map((candidate) =>
      proposalIds.has(candidate.candidateId)
        ? {
            ...candidate,
            pdfStatus: "acquired" as const,
            importStatus: "parsed" as const,
            lastMetadataRefresh: now().toISOString(),
          }
        : candidate,
    ),
  };
  if (!options.dryRun) {
    await writeProposalRegistry(proposalFile, nextProposalRegistry);
    await writeCandidateRegistry(candidateFile, nextCandidateRegistry);
  }
  return {
    proposals,
    skipped,
    cacheHits: acquired.filter((item) => item.pdf.cacheHit).length,
  };
}
