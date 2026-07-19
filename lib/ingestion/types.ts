/**
 * Provider-neutral types for a future, review-gated ingestion service.
 *
 * These types deliberately describe candidates and proposals—not public atlas
 * records. Only the curated CSV/data layer may create publishable records.
 */

export type IsoDateTime = string;

export interface DiscoveryWindow {
  /** Inclusive ISO-8601 timestamp. */
  readonly from: IsoDateTime;
  /** Exclusive ISO-8601 timestamp. */
  readonly to: IsoDateTime;
}

export interface DiscoveryRequest {
  readonly window: DiscoveryWindow;
  readonly queryTerms: readonly string[];
  readonly cursor?: string;
  readonly pageSize?: number;
}

export type CandidatePublicationType = "peer_reviewed" | "preprint" | "unknown";

export interface ScholarlyWorkCandidate {
  /** Stable identifier assigned by the metadata provider. */
  readonly providerRecordId: string;
  readonly provider: string;
  readonly title: string;
  readonly authors: readonly string[];
  readonly abstract: string | null;
  readonly doi: string | null;
  readonly publicationUrl: string;
  readonly publicationYear: number | null;
  readonly publicationType: CandidatePublicationType;
  readonly discoveredAt: IsoDateTime;
  /** Unmodified provider fields retained for audit/debugging. */
  readonly sourceMetadata?: Readonly<Record<string, unknown>>;
}

export interface DiscoveryPage {
  readonly candidates: readonly ScholarlyWorkCandidate[];
  readonly nextCursor: string | null;
}

export type OpenAccessBasis =
  | "publisher_open_access"
  | "public_repository"
  | "author_manuscript"
  | "preprint";

export interface AccessibleDocument {
  readonly url: string;
  readonly mediaType: "text/html" | "application/pdf" | "text/plain";
  readonly accessBasis: OpenAccessBasis;
  readonly license: string | null;
  readonly retrievedAt: IsoDateTime;
  /** A compliant resolver must never depend on institutional credentials. */
  readonly requiresAuthentication: false;
}

export type FullTextResolution =
  | {
      readonly status: "accessible";
      readonly document: AccessibleDocument;
    }
  | {
      readonly status: "metadata_only" | "not_found" | "access_disallowed";
      readonly reason: string;
    };

export interface EvidenceLocator {
  readonly sourceUrl: string;
  readonly location: string;
  readonly quotedText: string | null;
}

export interface ProposedField<T = unknown> {
  readonly value: T | null;
  readonly confidence: number | null;
  readonly evidence: readonly EvidenceLocator[];
}

export interface ProposedMeasurement {
  /** Temporary queue identifier; a curator assigns the public record ID. */
  readonly proposalId: string;
  readonly fields: Readonly<Record<string, ProposedField>>;
  readonly warnings: readonly string[];
}

export interface ProposalBatch {
  readonly candidate: ScholarlyWorkCandidate;
  readonly source: AccessibleDocument;
  readonly measurements: readonly ProposedMeasurement[];
  readonly proposedAt: IsoDateTime;
  readonly extractorVersion: string;
}

export interface ReviewEnvelope {
  readonly stage: "awaiting_human_review";
  readonly proposal: ProposalBatch;
}

export interface QueueReceipt {
  readonly queueId: string;
  readonly enqueuedAt: IsoDateTime;
}
