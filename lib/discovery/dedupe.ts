import type { DiscoveryCandidate, DuplicateRelationship } from "./types.ts";
import { fuzzyTitleSimilarity } from "./normalize.ts";

export type MatchKind = "exact" | "possible" | "none";

export interface CandidateMatch {
  kind: MatchKind;
  candidate: DiscoveryCandidate | null;
  relationship: DuplicateRelationship | null;
}

export function findCandidateMatch(
  incoming: DiscoveryCandidate,
  existing: readonly DiscoveryCandidate[],
  fuzzyThreshold = 0.94,
): CandidateMatch {
  if (incoming.normalizedDoi) {
    const match = existing.find(
      (candidate) => candidate.normalizedDoi === incoming.normalizedDoi,
    );
    if (match) {
      return {
        kind: "exact",
        candidate: match,
        relationship: { candidateId: match.candidateId, type: "exact-doi" },
      };
    }
  }
  if (incoming.openAlexId) {
    const match = existing.find(
      (candidate) => candidate.openAlexId === incoming.openAlexId,
    );
    if (match) {
      return {
        kind: "exact",
        candidate: match,
        relationship: { candidateId: match.candidateId, type: "openalex-id" },
      };
    }
  }
  const titleYearMatch = existing.find(
    (candidate) =>
      Boolean(incoming.normalizedTitle) &&
      candidate.normalizedTitle === incoming.normalizedTitle &&
      candidate.publicationYear === incoming.publicationYear,
  );
  if (titleYearMatch) {
    return {
      kind: "exact",
      candidate: titleYearMatch,
      relationship: {
        candidateId: titleYearMatch.candidateId,
        type: "title-year",
      },
    };
  }
  let possible: CandidateMatch = {
    kind: "none",
    candidate: null,
    relationship: null,
  };
  for (const candidate of existing) {
    if (
      incoming.publicationYear &&
      candidate.publicationYear &&
      Math.abs(incoming.publicationYear - candidate.publicationYear) > 1
    )
      continue;
    const similarity = fuzzyTitleSimilarity(incoming.title, candidate.title);
    if (
      similarity >= fuzzyThreshold &&
      (!possible.relationship ||
        similarity > (possible.relationship.similarity ?? 0))
    ) {
      possible = {
        kind: "possible",
        candidate,
        relationship: {
          candidateId: candidate.candidateId,
          type: "possible-fuzzy-title",
          similarity,
        },
      };
    }
  }
  return possible;
}

function union<T>(left: readonly T[], right: readonly T[]): T[] {
  return [...new Set([...left, ...right])];
}

export function mergeExactCandidate(
  existing: DiscoveryCandidate,
  incoming: DiscoveryCandidate,
): DiscoveryCandidate {
  return {
    ...existing,
    doi: existing.doi ?? incoming.doi,
    normalizedDoi: existing.normalizedDoi ?? incoming.normalizedDoi,
    title: existing.title || incoming.title,
    normalizedTitle: existing.normalizedTitle || incoming.normalizedTitle,
    authors: existing.authors.length ? existing.authors : incoming.authors,
    publicationYear: existing.publicationYear ?? incoming.publicationYear,
    journal: existing.journal ?? incoming.journal,
    abstract: existing.abstract ?? incoming.abstract,
    openAlexId: existing.openAlexId ?? incoming.openAlexId,
    crossrefMetadata: incoming.crossrefMetadata ?? existing.crossrefMetadata,
    publicationUrl: existing.publicationUrl ?? incoming.publicationUrl,
    openAccessPdfUrl: existing.openAccessPdfUrl ?? incoming.openAccessPdfUrl,
    openAccessPdfSource:
      existing.openAccessPdfSource ?? incoming.openAccessPdfSource,
    discoverySources: union(
      existing.discoverySources,
      incoming.discoverySources,
    ),
    discoveryQueries: union(
      existing.discoveryQueries,
      incoming.discoveryQueries,
    ),
    seedPaperIds: union(existing.seedPaperIds, incoming.seedPaperIds),
    discoveryMethods: union(
      existing.discoveryMethods,
      incoming.discoveryMethods,
    ),
    candidateMaterialClasses: union(
      existing.candidateMaterialClasses,
      incoming.candidateMaterialClasses,
    ),
    candidateSpectralRegions: union(
      existing.candidateSpectralRegions,
      incoming.candidateSpectralRegions,
    ),
    relevanceScore: Math.max(existing.relevanceScore, incoming.relevanceScore),
    relevanceReasons: union(
      existing.relevanceReasons,
      incoming.relevanceReasons,
    ),
    lastMetadataRefresh: incoming.lastMetadataRefresh,
  };
}

export function markPossibleDuplicate(
  incoming: DiscoveryCandidate,
  relationship: DuplicateRelationship,
): DiscoveryCandidate {
  return {
    ...incoming,
    duplicateRelationships: union(incoming.duplicateRelationships, [
      relationship,
    ]),
  };
}

export function deduplicateRegistryCandidates(
  candidates: readonly DiscoveryCandidate[],
  fuzzyThreshold = 0.94,
): { candidates: DiscoveryCandidate[]; merged: number; possible: number } {
  const output: DiscoveryCandidate[] = [];
  let merged = 0;
  let possible = 0;
  for (const candidate of candidates) {
    const match = findCandidateMatch(candidate, output, fuzzyThreshold);
    if (match.kind === "exact" && match.candidate) {
      const index = output.findIndex(
        (item) => item.candidateId === match.candidate!.candidateId,
      );
      output[index] = mergeExactCandidate(output[index], candidate);
      merged += 1;
    } else if (match.kind === "possible" && match.relationship) {
      output.push(markPossibleDuplicate(candidate, match.relationship));
      possible += 1;
    } else output.push(candidate);
  }
  return { candidates: output, merged, possible };
}
