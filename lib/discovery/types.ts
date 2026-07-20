export const SCREENING_STATUSES = [
  "unreviewed",
  "include",
  "exclude",
  "uncertain",
] as const;
export type ScreeningStatus = (typeof SCREENING_STATUSES)[number];

export const PDF_STATUSES = [
  "not-checked",
  "available",
  "acquired",
  "inaccessible",
  "requested",
] as const;
export type PdfStatus = (typeof PDF_STATUSES)[number];

export const IMPORT_STATUSES = [
  "not-started",
  "queued",
  "parsed",
  "approved",
  "published",
] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const DISCOVERY_METHODS = [
  "keyword",
  "reference",
  "cited-by",
  "related-work",
  "author",
] as const;
export type DiscoveryMethod = (typeof DISCOVERY_METHODS)[number];

export type DuplicateRelationshipType =
  "exact-doi" | "openalex-id" | "title-year" | "possible-fuzzy-title";

export interface DuplicateRelationship {
  candidateId: string;
  type: DuplicateRelationshipType;
  similarity?: number;
}

export interface CrossrefMetadata {
  title: string | null;
  authors: string[];
  publicationYear: number | null;
  journal: string | null;
  type: string | null;
  url: string | null;
  retrievedAt: string;
}

export interface DiscoveryCandidate {
  candidateId: string;
  doi: string | null;
  normalizedDoi: string | null;
  title: string;
  normalizedTitle: string;
  authors: string[];
  publicationYear: number | null;
  journal: string | null;
  abstract: string | null;
  openAlexId: string | null;
  crossrefMetadata: CrossrefMetadata | null;
  publicationUrl: string | null;
  openAccessPdfUrl: string | null;
  openAccessPdfSource: string | null;
  discoverySources: string[];
  discoveryQueries: string[];
  seedPaperIds: string[];
  discoveryMethods: DiscoveryMethod[];
  candidateMaterialClasses: string[];
  candidateDeviceType: string | null;
  candidateSpectralRegions: string[];
  relevanceScore: number;
  relevanceReasons: string[];
  screeningStatus: ScreeningStatus;
  exclusionReason: string | null;
  screeningNotes: string | null;
  pdfStatus: PdfStatus;
  importStatus: ImportStatus;
  dateDiscovered: string;
  lastMetadataRefresh: string;
  duplicateRelationships: DuplicateRelationship[];
  manualOverrides: Record<string, unknown>;
}

export interface CandidateRegistry {
  schemaVersion: 1;
  configVersion: string;
  candidates: DiscoveryCandidate[];
}

export interface DiscoveryConfig {
  version: string;
  openAlex: {
    baseUrl: string;
    mailto: string;
    perPage: number;
    maxPagesPerQuery: number;
    minimumRequestIntervalMs: number;
  };
  crossref: {
    baseUrl: string;
    mailto: string;
    minimumRequestIntervalMs: number;
  };
  materialTerms: string[];
  deviceTerms: string[];
  spectralTerms: string[];
  queries: string[];
  ranking: {
    fuzzyTitleThreshold: number;
    positiveWeights: Record<string, number>;
    negativeWeights: Record<string, number>;
  };
}

export interface OpenAlexAuthorship {
  author?: { id?: string; display_name?: string } | null;
}

export interface OpenAlexWork {
  id?: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  publication_date?: string | null;
  type?: string | null;
  is_retracted?: boolean;
  authorships?: OpenAlexAuthorship[];
  primary_location?: {
    landing_page_url?: string | null;
    pdf_url?: string | null;
    source?: { display_name?: string | null } | null;
  } | null;
  best_oa_location?: {
    landing_page_url?: string | null;
    pdf_url?: string | null;
    source?: { display_name?: string | null } | null;
  } | null;
  open_access?: { is_oa?: boolean; oa_url?: string | null } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  referenced_works?: string[];
  related_works?: string[];
}

export interface DiscoveryRunLog {
  runId: string;
  timestamp: string;
  configurationVersion: string;
  sourceApi: string[];
  commands: string[];
  exactQueries: string[];
  seedPapers: string[];
  dateFilters: { from?: string; to?: string };
  retrieved: number;
  newlyAdded: number;
  deduplicated: number;
  errors: string[];
  incompleteRequests: string[];
  dryRun: boolean;
}
