import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  resolveOpenAccessPdfLocations,
  type OpenAccessResolution,
  type OpenAccessResolutionOptions,
} from "./full-text-resolver.ts";
import { acquireOpenAccessPdf } from "./pdf-acquisition.ts";
import { extractStagedProposal } from "./proposal-extractor.ts";
import {
  readCandidateRegistry,
  readDiscoveryConfig,
  writeCandidateRegistry,
} from "./pipeline.ts";
import {
  readProposalRegistry,
  writeProposalRegistry,
} from "./proposal-registry.ts";
import { withDiscoveryWriteLock } from "./storage.ts";
import type {
  BatchManifest,
  ProposalSource,
  StagedPaperProposal,
} from "./proposal-types.ts";
import type { CandidateRegistry, DiscoveryCandidate } from "./types.ts";

const execFileAsync = promisify(execFile);

export interface ProposalPipelineOptions {
  root: string;
  candidateIds: string[];
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  pythonExecutable?: string;
  cacheDirectory?: string;
  candidateRegistry?: CandidateRegistry;
  resolvePdfLocationsImpl?: (
    candidate: Awaited<
      ReturnType<typeof readCandidateRegistry>
    >["candidates"][number],
    options: OpenAccessResolutionOptions,
  ) => Promise<OpenAccessResolution>;
}

export interface ProposalPipelineSkip {
  candidateId: string;
  stage: "selection" | "resolution" | "acquisition" | "extraction";
  reason: string;
  retryable: boolean;
}

export interface ProposalPipelineWarning {
  candidateId: string;
  stage: "resolution" | "supporting-information" | "extraction";
  reason: string;
}

export interface ProposalPipelineResult {
  proposals: StagedPaperProposal[];
  skipped: ProposalPipelineSkip[];
  warnings: ProposalPipelineWarning[];
  cacheHits: number;
}

async function readBatchManifest(file: string): Promise<BatchManifest> {
  return JSON.parse(await readFile(file, "utf8")) as BatchManifest;
}

const importStatusPriority: Record<DiscoveryCandidate["importStatus"], number> =
  {
    "not-started": 0,
    queued: 1,
    parsed: 2,
    approved: 3,
    published: 4,
  };

function mergeCandidateUpdate(
  candidate: DiscoveryCandidate,
  patch: Partial<DiscoveryCandidate>,
): DiscoveryCandidate {
  const next = { ...candidate, ...patch };
  if (
    patch.importStatus &&
    importStatusPriority[candidate.importStatus] >
      importStatusPriority[patch.importStatus]
  )
    next.importStatus = candidate.importStatus;
  if (candidate.pdfStatus === "acquired" && patch.pdfStatus !== "acquired")
    next.pdfStatus = candidate.pdfStatus;
  if (
    patch.lastMetadataRefresh &&
    candidate.lastMetadataRefresh > patch.lastMetadataRefresh
  )
    next.lastMetadataRefresh = candidate.lastMetadataRefresh;
  if (patch.duplicateRelationships) {
    const relationships = new Map(
      candidate.duplicateRelationships.map((relationship) => [
        `${relationship.type}:${relationship.candidateId}`,
        relationship,
      ]),
    );
    for (const relationship of patch.duplicateRelationships)
      relationships.set(
        `${relationship.type}:${relationship.candidateId}`,
        relationship,
      );
    next.duplicateRelationships = [...relationships.values()];
  }
  return next;
}

async function runBatchExtraction(
  executable: string,
  script: string,
  extractionDirectory: string,
  pdfPaths: string[],
): Promise<BatchManifest> {
  const manifestFile = path.join(extractionDirectory, "batch-manifest.json");
  const readCurrentManifest = async () => {
    const manifest = await readBatchManifest(manifestFile);
    const canonicalPath = async (file: string) =>
      realpath(file).catch(() => path.resolve(file));
    const recordedPaths = new Set(
      await Promise.all(
        manifest.papers.map((paper) => canonicalPath(paper.pdf_path)),
      ),
    );
    const requestedPaths = await Promise.all(pdfPaths.map(canonicalPath));
    if (!requestedPaths.every((pdfPath) => recordedPaths.has(pdfPath)))
      throw new Error(
        "Batch extraction manifest does not cover every input PDF",
      );
    return manifest;
  };
  try {
    await execFileAsync(
      executable,
      [script, "--cache-dir", extractionDirectory, ...pdfPaths],
      { maxBuffer: 10 * 1024 * 1024 },
    );
  } catch (error) {
    try {
      return await readCurrentManifest();
    } catch {
      throw error;
    }
  }
  return readCurrentManifest();
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
  const candidateRegistry =
    options.candidateRegistry ?? (await readCandidateRegistry(candidateFile));
  const discoveryConfig = await readDiscoveryConfig(
    path.join(options.root, "data/discovery/config.json"),
  );
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
    (candidateId) => ({
      candidateId,
      stage: "selection",
      reason: "Candidate not found",
      retryable: false,
    }),
  );
  const warnings: ProposalPipelineResult["warnings"] = [];
  const baseCache =
    options.cacheDirectory ?? path.join(os.tmpdir(), "cqd-paper-import-cache");
  const cacheDirectory = options.dryRun
    ? await mkdtemp(path.join(os.tmpdir(), "cqd-paper-proposal-dry-"))
    : baseCache;
  const candidateUpdates = new Map<
    string,
    Partial<(typeof candidateRegistry.candidates)[number]>
  >();
  const updateCandidate = (
    candidateId: string,
    patch: Partial<(typeof candidateRegistry.candidates)[number]>,
  ) => {
    candidateUpdates.set(candidateId, {
      ...(candidateUpdates.get(candidateId) ?? {}),
      ...patch,
      lastMetadataRefresh: now().toISOString(),
    });
  };
  const acquired: Array<{
    candidate: NonNullable<(typeof selected)[number]>;
    pdf: Awaited<ReturnType<typeof acquireOpenAccessPdf>>;
    source: string;
  }> = [];
  const acquiredHashes = new Map(
    proposalRegistry.proposals
      .filter((proposal) => Boolean(proposal.source.pdfSha256))
      .map((proposal) => [proposal.source.pdfSha256, proposal.candidateId]),
  );
  for (const candidate of selected) {
    if (
      proposalRegistry.proposals.some(
        (proposal) => proposal.candidateId === candidate!.candidateId,
      )
    ) {
      skipped.push({
        candidateId: candidate!.candidateId,
        stage: "selection",
        reason: "A staged proposal already exists for this candidate",
        retryable: false,
      });
      continue;
    }
    updateCandidate(candidate!.candidateId, { importStatus: "queued" });
    let resolution: OpenAccessResolution;
    try {
      resolution = await (
        options.resolvePdfLocationsImpl ?? resolveOpenAccessPdfLocations
      )(candidate!, {
        config: discoveryConfig,
        cacheDirectory: path.join(cacheDirectory, "resolution"),
        dryRun: options.dryRun,
        fetchImpl: options.fetchImpl,
      });
    } catch (error) {
      skipped.push({
        candidateId: candidate!.candidateId,
        stage: "resolution",
        reason: (error as Error).message,
        retryable: true,
      });
      updateCandidate(candidate!.candidateId, { pdfStatus: "requested" });
      continue;
    }
    for (const warning of resolution.warnings) {
      warnings.push({
        candidateId: candidate!.candidateId,
        stage: "resolution",
        reason: warning,
      });
    }
    if (!resolution.locations.length) {
      skipped.push({
        candidateId: candidate!.candidateId,
        stage: "resolution",
        reason: "No lawful open-access PDF location was resolved",
        retryable: true,
      });
      updateCandidate(candidate!.candidateId, { pdfStatus: "requested" });
      continue;
    }
    const acquisitionErrors: string[] = [];
    let resolved: (typeof acquired)[number] | null = null;
    for (const location of resolution.locations) {
      try {
        const pdf = await acquireOpenAccessPdf(
          location.url,
          path.join(cacheDirectory, "acquisition"),
          { fetchImpl: options.fetchImpl },
        );
        resolved = { candidate: candidate!, pdf, source: location.source };
        updateCandidate(candidate!.candidateId, {
          openAccessPdfUrl: pdf.finalUrl,
          openAccessPdfSource: location.source,
          pdfStatus: "acquired",
        });
        break;
      } catch (error) {
        acquisitionErrors.push(
          `${location.source}: ${(error as Error).message}`,
        );
      }
    }
    if (resolved) {
      const duplicateCandidateId = acquiredHashes.get(resolved.pdf.sha256);
      if (duplicateCandidateId) {
        skipped.push({
          candidateId: candidate!.candidateId,
          stage: "acquisition",
          reason: `PDF duplicates the source acquired for ${duplicateCandidateId}`,
          retryable: false,
        });
        updateCandidate(candidate!.candidateId, {
          duplicateRelationships: [
            ...candidate!.duplicateRelationships.filter(
              (relationship) => relationship.type !== "exact-pdf-hash",
            ),
            {
              candidateId: duplicateCandidateId,
              type: "exact-pdf-hash",
            },
          ],
        });
      } else {
        acquiredHashes.set(resolved.pdf.sha256, candidate!.candidateId);
        acquired.push(resolved);
      }
    } else {
      skipped.push({
        candidateId: candidate!.candidateId,
        stage: "acquisition",
        reason: acquisitionErrors.join(" | "),
        retryable: true,
      });
      updateCandidate(candidate!.candidateId, { pdfStatus: "inaccessible" });
    }
  }

  const extractionDirectory = path.join(cacheDirectory, "extraction");
  const script = path.join(options.root, "scripts/batch_extract.py");
  const pythonExecutable =
    options.pythonExecutable ?? process.env.PYTHON ?? "python3";
  let manifest: BatchManifest = {
    schema_version: 1,
    cache_dir: extractionDirectory,
    paper_count: 0,
    cache_hits: 0,
    duplicates: 0,
    papers: [],
  };
  if (acquired.length) {
    manifest = await runBatchExtraction(
      pythonExecutable,
      script,
      extractionDirectory,
      acquired.map((item) => item.pdf.path),
    );
  }
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
        warnings.push({
          candidateId: item.candidate.candidateId,
          stage: "supporting-information",
          reason: `Supporting Information could not be acquired: ${(error as Error).message}`,
        });
      }
    }
  }
  const supportingPdfs = [...supportingByCandidate.values()].flat();
  if (supportingPdfs.length) {
    manifest = await runBatchExtraction(
      pythonExecutable,
      script,
      extractionDirectory,
      [
        ...acquired.map((item) => item.pdf.path),
        ...supportingPdfs.map((item) => item.path),
      ],
    );
  }
  const proposals: StagedPaperProposal[] = [];
  for (const item of acquired) {
    const record = manifest.papers.find(
      (paper) => paper.sha256 === item.pdf.sha256,
    );
    if (!record || record.error || !record.text_path) {
      skipped.push({
        candidateId: item.candidate.candidateId,
        stage: "extraction",
        reason: record?.error ?? "PDF extraction manifest was incomplete",
        retryable: true,
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
      openAccessSource: item.source,
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
    try {
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
      updateCandidate(item.candidate.candidateId, {
        pdfStatus: "acquired",
        importStatus: "parsed",
      });
    } catch (error) {
      skipped.push({
        candidateId: item.candidate.candidateId,
        stage: "extraction",
        reason: (error as Error).message,
        retryable: true,
      });
      warnings.push({
        candidateId: item.candidate.candidateId,
        stage: "extraction",
        reason: "PDF was acquired but no proposal could be staged",
      });
    }
  }
  let persistedProposals = proposals;
  if (!options.dryRun) {
    await withDiscoveryWriteLock(options.root, async () => {
      // Extraction can take minutes. Re-read under the shared lock so a curator
      // decision or another preparation run made in the meantime is retained.
      const [currentProposalRegistry, currentCandidateRegistry] =
        await Promise.all([
          readProposalRegistry(proposalFile),
          readCandidateRegistry(candidateFile),
        ]);
      const proposalIds = new Set(
        currentProposalRegistry.proposals.map(
          (proposal) => proposal.proposalId,
        ),
      );
      const proposalCandidateIds = new Set(
        currentProposalRegistry.proposals.map(
          (proposal) => proposal.candidateId,
        ),
      );
      const proposalHashes = new Map(
        currentProposalRegistry.proposals.map((proposal) => [
          proposal.source.pdfSha256,
          proposal.candidateId,
        ]),
      );
      persistedProposals = [];
      for (const proposal of proposals) {
        const concurrentCandidate = proposalCandidateIds.has(
          proposal.candidateId,
        );
        const concurrentId = proposalIds.has(proposal.proposalId);
        const duplicateHashCandidate = proposalHashes.get(
          proposal.source.pdfSha256,
        );
        if (concurrentCandidate || concurrentId || duplicateHashCandidate) {
          skipped.push({
            candidateId: proposal.candidateId,
            stage: "selection",
            reason: duplicateHashCandidate
              ? `PDF duplicates the source acquired for ${duplicateHashCandidate}`
              : "A staged proposal was created concurrently; existing curator state was preserved",
            retryable: false,
          });
          if (duplicateHashCandidate) {
            const original = currentCandidateRegistry.candidates.find(
              (candidate) => candidate.candidateId === proposal.candidateId,
            );
            if (original)
              updateCandidate(proposal.candidateId, {
                duplicateRelationships: [
                  ...original.duplicateRelationships,
                  {
                    candidateId: duplicateHashCandidate,
                    type: "exact-pdf-hash",
                  },
                ],
              });
          }
          continue;
        }
        persistedProposals.push(proposal);
        proposalIds.add(proposal.proposalId);
        proposalCandidateIds.add(proposal.candidateId);
        proposalHashes.set(proposal.source.pdfSha256, proposal.candidateId);
      }

      if (persistedProposals.length)
        await writeProposalRegistry(proposalFile, {
          ...currentProposalRegistry,
          proposals: [
            ...currentProposalRegistry.proposals,
            ...persistedProposals,
          ],
        });

      if (candidateUpdates.size) {
        const persistedCandidateIds = new Set(
          persistedProposals.map((proposal) => proposal.candidateId),
        );
        await writeCandidateRegistry(candidateFile, {
          ...currentCandidateRegistry,
          candidates: currentCandidateRegistry.candidates.map((candidate) => {
            const patch = candidateUpdates.get(candidate.candidateId);
            const merged = patch
              ? mergeCandidateUpdate(candidate, patch)
              : candidate;
            return persistedCandidateIds.has(candidate.candidateId)
              ? mergeCandidateUpdate(merged, {
                  pdfStatus: "acquired",
                  importStatus: "parsed",
                })
              : merged;
          }),
        });
      }
    });
  }
  return {
    proposals: persistedProposals,
    skipped,
    warnings,
    cacheHits: acquired.filter((item) => item.pdf.cacheHit).length,
  };
}
