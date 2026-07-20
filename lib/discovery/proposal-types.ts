import type { Device, Measurement, Paper } from "../data/types.ts";

export const PROPOSAL_STATUSES = [
  "awaiting-approval",
  "approved",
  "rejected",
  "needs-correction",
  "applied",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const SCOPE_STATUSES = [
  "in-scope",
  "out-of-scope",
  "uncertain",
] as const;
export type ProposalScopeStatus = (typeof SCOPE_STATUSES)[number];

export interface ProposalEvidence {
  field: string;
  page: number;
  location: string;
  conciseEvidence: string;
  confidence: number;
}

export interface ProposalSource {
  url: string;
  openAccessSource: string;
  pdfSha256: string;
  acquiredAt: string;
  contentType: string;
  byteLength: number;
  extractionEngine: string;
  pageCount: number;
  needsOcr: boolean;
  supportingDocuments?: Array<{
    url: string;
    pdfSha256: string;
    extractionEngine: string;
    pageCount: number;
    needsOcr: boolean;
  }>;
}

export interface StagedPaperProposal {
  proposalId: string;
  candidateId: string;
  source: ProposalSource;
  scopeStatus: ProposalScopeStatus;
  scopeReasons: string[];
  proposedPaper: Paper;
  proposedDevices: Device[];
  proposedMeasurements: Measurement[];
  evidence: ProposalEvidence[];
  warnings: string[];
  missingFields: string[];
  status: ProposalStatus;
  decisionNotes: string | null;
  proposedAt: string;
  decidedAt: string | null;
  appliedAt: string | null;
  extractorVersion: "cqd-proposal-extractor-v1";
}

export interface ProposalRegistry {
  schemaVersion: 1;
  proposals: StagedPaperProposal[];
}

export interface BatchManifestPaper {
  pdf_path: string;
  filename: string;
  sha256: string;
  page_count?: number;
  extracted_characters?: number;
  extraction_engine?: string;
  needs_ocr?: boolean;
  candidate_pages?: Record<string, number[]>;
  text_path?: string;
  cache_hit?: boolean;
  duplicate_of?: string | null;
  error?: string;
  supporting_information_urls?: string[];
}

export interface BatchManifest {
  schema_version: 1;
  cache_dir: string;
  paper_count: number;
  cache_hits: number;
  duplicates: number;
  papers: BatchManifestPaper[];
}
