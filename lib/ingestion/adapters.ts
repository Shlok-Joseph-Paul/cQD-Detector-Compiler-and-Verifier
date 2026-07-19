import type {
  AccessibleDocument,
  DiscoveryPage,
  DiscoveryRequest,
  FullTextResolution,
  ProposalBatch,
  QueueReceipt,
  ReviewEnvelope,
  ScholarlyWorkCandidate,
} from "./types";

/** Searches a scholarly metadata API. It must not scrape publisher pages. */
export interface ScholarlyDiscoveryAdapter {
  readonly provider: string;
  discover(request: DiscoveryRequest): Promise<DiscoveryPage>;
}

/**
 * Locates full text that can be accessed without a user or institutional login.
 * A metadata-only result is valid and should remain in the candidate inbox.
 */
export interface OpenAccessResolverAdapter {
  readonly provider: string;
  resolve(candidate: ScholarlyWorkCandidate): Promise<FullTextResolution>;
}

/** Produces evidence-linked suggestions; it never creates public records. */
export interface MeasurementProposalAdapter {
  readonly version: string;
  propose(
    candidate: ScholarlyWorkCandidate,
    source: AccessibleDocument,
  ): Promise<ProposalBatch>;
}

/** Stores proposals in a private queue for explicit human review. */
export interface HumanReviewQueueAdapter {
  enqueue(envelope: ReviewEnvelope): Promise<QueueReceipt>;
}

/** Dependencies required by a future scheduled ingestion orchestrator. */
export interface IngestionPorts {
  readonly discovery: ScholarlyDiscoveryAdapter;
  readonly openAccess: OpenAccessResolverAdapter;
  readonly proposals: MeasurementProposalAdapter;
  readonly reviewQueue: HumanReviewQueueAdapter;
}
