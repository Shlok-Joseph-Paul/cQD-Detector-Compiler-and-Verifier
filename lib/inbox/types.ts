import type { StagedPaperProposal } from "../discovery/proposal-types.ts";

export const INBOX_JOB_STATUSES = [
  "settling",
  "queued",
  "processing",
  "ready-for-review",
  "needs-attention",
  "duplicate",
  "missing",
] as const;

export type InboxJobStatus = (typeof INBOX_JOB_STATUSES)[number];

export interface InboxFileSignature {
  relativePath: string;
  size: number;
  modifiedAtMs: number;
}

export interface InboxJob {
  jobId: string;
  sourceKey: string;
  displayName: string;
  mainPdf: string | null;
  supportingPdfs: string[];
  metadataFile: string | null;
  signatures: InboxFileSignature[];
  signatureKey: string;
  lastChangedAt: string;
  status: InboxJobStatus;
  stage: string;
  attempts: number;
  mainPdfSha256: string | null;
  duplicateOf: string | null;
  proposalFile: string | null;
  summaryFile: string | null;
  needsOcr: boolean | null;
  error: string | null;
  discoveredAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface InboxLedger {
  schemaVersion: 1;
  jobs: InboxJob[];
}

export interface LocalPaperMetadata {
  title?: string;
  authors?: string[];
  journal?: string;
  publicationYear?: number;
  doi?: string;
  publicationUrl?: string;
  technologyFamily?: "cqd" | "perovskite";
  materialClasses?: string[];
}

export interface InboxReviewPackage {
  schemaVersion: 1;
  job: {
    jobId: string;
    sourceKey: string;
    displayName: string;
    mainPdf: string;
    supportingPdfs: string[];
    processedAt: string;
  };
  proposal: StagedPaperProposal;
}

export interface InboxRunSummary {
  inbox: string;
  discovered: number;
  processed: number;
  readyForReview: number;
  duplicates: number;
  needsAttention: number;
  settling: number;
  missing: number;
}
