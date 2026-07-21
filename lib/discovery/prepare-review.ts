import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TechnologyFamily } from "../data/types.ts";
import { normalizeTitle } from "./normalize.ts";
import { readCandidateRegistry, readDiscoveryConfig } from "./pipeline.ts";
import {
  proposeOpenAccessCandidates,
  type ProposalPipelineOptions,
  type ProposalPipelineResult,
} from "./proposal-pipeline.ts";
import { readProposalRegistry } from "./proposal-registry.ts";
import {
  candidateMatchesTechnology,
  candidateTechnologyFamilies,
} from "./profiles.ts";
import {
  atlasPriorityScore,
  classifyAtlasFit,
  extractAtlasKeys,
  looksLikeNonPrimaryCandidate,
  type RankedCandidate,
} from "./shortlist.ts";
import type {
  CandidateRegistry,
  DiscoveryCandidate,
  DiscoveryConfig,
} from "./types.ts";

export type ReviewEligibilityDecision = "eligible" | "skipped";

export interface ReviewEligibility {
  candidate: DiscoveryCandidate;
  decision: ReviewEligibilityDecision;
  reason: string;
  atlasFit: RankedCandidate["atlasFit"];
  priorityScore: number;
}

export interface ReviewBatchCandidate {
  candidateId: string;
  title: string;
  relevanceScore: number;
  priorityScore: number;
  atlasFit: RankedCandidate["atlasFit"];
  reason: string;
}

export interface PrepareReviewSkip {
  candidateId: string;
  title: string | null;
  stage:
    "eligibility" | "selection" | "resolution" | "acquisition" | "extraction";
  reason: string;
  retryable: boolean;
}

export interface PrepareReviewResult {
  run: {
    limit: number;
    minimumScore: number;
    dryRun: boolean;
    technologyFamily: TechnologyFamily;
  };
  counts: {
    considered: number;
    eligible: number;
    selected: number;
    proposed: number;
    unresolved: number;
    failed: number;
    skipped: number;
    deferred: number;
  };
  selected: ReviewBatchCandidate[];
  proposed: Array<{
    proposalId: string;
    candidateId: string;
    scopeStatus: string;
    devices: number;
    measurements: number;
    warnings: number;
  }>;
  skipped: PrepareReviewSkip[];
  deferred: ReviewBatchCandidate[];
  warnings: ProposalPipelineResult["warnings"];
  cacheHits: number;
}

export interface PrepareReviewOptions {
  root: string;
  limit?: number;
  minimumScore?: number;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  pythonExecutable?: string;
  cacheDirectory?: string;
  technologyFamily?: TechnologyFamily;
  candidateRegistry?: CandidateRegistry;
  proposalRunner?: (
    options: ProposalPipelineOptions,
  ) => Promise<ProposalPipelineResult>;
}

interface EligibilityContext {
  config: DiscoveryConfig;
  atlasDois: ReadonlySet<string>;
  atlasTitles: ReadonlySet<string>;
  proposalCandidateIds: ReadonlySet<string>;
  minimumScore: number;
}

export function assessReviewEligibility(
  candidate: DiscoveryCandidate,
  context: EligibilityContext,
): ReviewEligibility {
  const atlasFit = classifyAtlasFit(candidate);
  const priorityScore = atlasPriorityScore(candidate);
  const result = (
    decision: ReviewEligibilityDecision,
    reason: string,
  ): ReviewEligibility => ({
    candidate,
    decision,
    reason,
    atlasFit,
    priorityScore,
  });

  if (
    (candidate.normalizedDoi &&
      context.atlasDois.has(candidate.normalizedDoi)) ||
    context.atlasTitles.has(normalizeTitle(candidate.title))
  )
    return result("skipped", "Paper already exists in the published atlas");
  if (context.proposalCandidateIds.has(candidate.candidateId))
    return result("skipped", "A staged proposal already exists");
  const exactPdfDuplicate = candidate.duplicateRelationships.find(
    (relationship) => relationship.type === "exact-pdf-hash",
  );
  if (exactPdfDuplicate)
    return result(
      "skipped",
      `PDF duplicates candidate ${exactPdfDuplicate.candidateId}`,
    );
  if (["parsed", "approved", "published"].includes(candidate.importStatus))
    return result("skipped", `Candidate is already ${candidate.importStatus}`);
  if (candidate.screeningStatus === "exclude")
    return result("skipped", "Candidate was explicitly excluded");
  if (candidate.screeningStatus === "uncertain")
    return result("skipped", "Candidate requires manual scope screening");
  if (
    context.config.reviewPreparation?.excludePossibleDuplicates !== false &&
    candidate.duplicateRelationships.some(
      (relationship) => relationship.type === "possible-fuzzy-title",
    )
  )
    return result("skipped", "Possible duplicate requires manual screening");

  if (candidate.screeningStatus === "include")
    return result("eligible", "Explicit curator include decision");
  if (looksLikeNonPrimaryCandidate(candidate))
    return result(
      "skipped",
      "Title or abstract indicates a non-primary record",
    );
  if (candidate.relevanceScore < context.minimumScore)
    return result(
      "skipped",
      `Relevance score ${candidate.relevanceScore} is below ${context.minimumScore}`,
    );
  if (atlasFit === "low")
    return result(
      "skipped",
      `Title and abstract lack a complete ${
        candidateTechnologyFamilies(candidate).includes("perovskite")
          ? "perovskite"
          : "CQD"
      }, detector, and detectivity signal`,
    );
  if (
    atlasFit === "medium" &&
    context.config.reviewPreparation?.allowMediumAtlasFit === false
  )
    return result(
      "skipped",
      "Medium-fit candidates are disabled by configuration",
    );
  return result(
    "eligible",
    `Automatic ${atlasFit}-fit candidate with score ${candidate.relevanceScore}`,
  );
}

function compareEligibility(left: ReviewEligibility, right: ReviewEligibility) {
  const leftIncluded = left.candidate.screeningStatus === "include" ? 1 : 0;
  const rightIncluded = right.candidate.screeningStatus === "include" ? 1 : 0;
  const leftPdf = left.candidate.openAccessPdfUrl ? 1 : 0;
  const rightPdf = right.candidate.openAccessPdfUrl ? 1 : 0;
  const fitValue = { high: 2, medium: 1, low: 0 } as const;
  return (
    rightIncluded - leftIncluded ||
    rightPdf - leftPdf ||
    fitValue[right.atlasFit] - fitValue[left.atlasFit] ||
    right.candidate.relevanceScore - left.candidate.relevanceScore ||
    (right.candidate.publicationYear ?? 0) -
      (left.candidate.publicationYear ?? 0) ||
    left.candidate.title.localeCompare(right.candidate.title) ||
    left.candidate.candidateId.localeCompare(right.candidate.candidateId)
  );
}

function batchCandidate(item: ReviewEligibility): ReviewBatchCandidate {
  return {
    candidateId: item.candidate.candidateId,
    title: item.candidate.title,
    relevanceScore: item.candidate.relevanceScore,
    priorityScore: item.priorityScore,
    atlasFit: item.atlasFit,
    reason: item.reason,
  };
}

export async function prepareReviewBatch(
  options: PrepareReviewOptions,
): Promise<PrepareReviewResult> {
  const configFile = path.join(options.root, "data/discovery/config.json");
  const candidatesFile = path.join(
    options.root,
    "data/discovery/candidates.json",
  );
  const proposalsFile = path.join(
    options.root,
    "data/discovery/proposals.json",
  );
  const papersFile = path.join(options.root, "data/papers.csv");
  const [config, candidateRegistry, proposalRegistry, papersCsv] =
    await Promise.all([
      readDiscoveryConfig(configFile),
      options.candidateRegistry ?? readCandidateRegistry(candidatesFile),
      readProposalRegistry(proposalsFile),
      readFile(papersFile, "utf8"),
    ]);
  const limit = options.limit ?? config.reviewPreparation?.defaultLimit ?? 5;
  const minimumScore =
    options.minimumScore ??
    config.reviewPreparation?.minimumRelevanceScore ??
    70;
  const technologyFamily = options.technologyFamily ?? "cqd";
  if (!Number.isInteger(limit) || limit <= 0)
    throw new Error("--limit must be a positive integer");
  if (!Number.isFinite(minimumScore) || minimumScore < 0 || minimumScore > 100)
    throw new Error("--minimum-score must be between 0 and 100");

  const atlasKeys = extractAtlasKeys(papersCsv);
  const context: EligibilityContext = {
    config,
    atlasDois: atlasKeys.dois,
    atlasTitles: atlasKeys.titles,
    proposalCandidateIds: new Set(
      proposalRegistry.proposals.map((proposal) => proposal.candidateId),
    ),
    minimumScore,
  };
  const assessments = candidateRegistry.candidates
    .filter((candidate) =>
      candidateMatchesTechnology(candidate, technologyFamily),
    )
    .map((candidate) => assessReviewEligibility(candidate, context));
  const eligible = assessments
    .filter((item) => item.decision === "eligible")
    .sort(compareEligibility);
  const selectedAssessments = eligible.slice(0, limit);
  const deferredAssessments = eligible.slice(limit);
  const selected = selectedAssessments.map(batchCandidate);
  const deferred = deferredAssessments.map((item) => ({
    ...batchCandidate(item),
    reason: "Eligible but deferred by the batch limit",
  }));
  const eligibilitySkips: PrepareReviewSkip[] = assessments
    .filter((item) => item.decision === "skipped")
    .map((item) => ({
      candidateId: item.candidate.candidateId,
      title: item.candidate.title,
      stage: "eligibility",
      reason: item.reason,
      retryable:
        item.reason.includes("manual") || item.reason.includes("score"),
    }));

  const pipelineResult = selected.length
    ? await (options.proposalRunner ?? proposeOpenAccessCandidates)({
        root: options.root,
        candidateIds: selected.map((item) => item.candidateId),
        dryRun: options.dryRun,
        fetchImpl: options.fetchImpl,
        now: options.now,
        pythonExecutable: options.pythonExecutable,
        cacheDirectory: options.cacheDirectory,
        candidateRegistry: options.candidateRegistry,
      })
    : { proposals: [], skipped: [], warnings: [], cacheHits: 0 };
  const titles = new Map(
    candidateRegistry.candidates.map((candidate) => [
      candidate.candidateId,
      candidate.title,
    ]),
  );
  const pipelineSkips: PrepareReviewSkip[] = pipelineResult.skipped.map(
    (item) => ({
      ...item,
      title: titles.get(item.candidateId) ?? null,
    }),
  );
  const unresolved = pipelineSkips.filter((item) =>
    ["resolution", "acquisition"].includes(item.stage),
  ).length;
  const failed = pipelineSkips.filter(
    (item) => item.stage === "extraction",
  ).length;

  return {
    run: {
      limit,
      minimumScore,
      dryRun: options.dryRun ?? false,
      technologyFamily,
    },
    counts: {
      considered: assessments.length,
      eligible: eligible.length,
      selected: selected.length,
      proposed: pipelineResult.proposals.length,
      unresolved,
      failed,
      skipped: eligibilitySkips.length + pipelineSkips.length,
      deferred: deferred.length,
    },
    selected,
    proposed: pipelineResult.proposals.map((proposal) => ({
      proposalId: proposal.proposalId,
      candidateId: proposal.candidateId,
      scopeStatus: proposal.scopeStatus,
      devices: proposal.proposedDevices.length,
      measurements: proposal.proposedMeasurements.length,
      warnings: proposal.warnings.length,
    })),
    skipped: [...eligibilitySkips, ...pipelineSkips],
    deferred,
    warnings: pipelineResult.warnings,
    cacheHits: pipelineResult.cacheHits,
  };
}
