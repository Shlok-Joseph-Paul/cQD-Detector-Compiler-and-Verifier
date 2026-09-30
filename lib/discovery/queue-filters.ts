import type { DiscoveryCandidate, ScreeningStatus } from "./types.ts";

export interface QueueFilters {
  search: string;
  status: ScreeningStatus | "all";
  material: string;
  afterYear: string;
  beforeYear: string;
  sort: string;
}

export function yearRangeError(
  afterYear: string,
  beforeYear: string,
): string | null {
  for (const year of [afterYear, beforeYear]) {
    if (year && !/^[1-9]\d{3}$/.test(year)) return "Enter a four-digit year.";
  }
  if (afterYear && beforeYear && Number(afterYear) >= Number(beforeYear))
    return "The after year must be earlier than the before year.";
  return null;
}

export function filterQueueCandidates(
  candidates: readonly DiscoveryCandidate[],
  filters: QueueFilters,
): DiscoveryCandidate[] {
  if (yearRangeError(filters.afterYear, filters.beforeYear)) return [];
  const query = filters.search.trim().toLowerCase();
  return candidates
    .filter((candidate) => {
      if (
        filters.status !== "all" &&
        candidate.screeningStatus !== filters.status
      )
        return false;
      if (
        filters.material !== "all" &&
        !candidate.candidateMaterialClasses.includes(filters.material)
      )
        return false;
      if (filters.afterYear || filters.beforeYear) {
        if (candidate.publicationYear == null) return false;
        if (
          filters.afterYear &&
          candidate.publicationYear <= Number(filters.afterYear)
        )
          return false;
        if (
          filters.beforeYear &&
          candidate.publicationYear >= Number(filters.beforeYear)
        )
          return false;
      }
      return (
        !query ||
        [
          candidate.title,
          candidate.doi,
          candidate.journal,
          ...candidate.authors,
          candidate.abstract,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    })
    .sort((left, right) => {
      if (filters.sort === "year-desc" || filters.sort === "year-asc") {
        // Undated papers stay at the end in either direction.
        if (left.publicationYear == null && right.publicationYear != null)
          return 1;
        if (right.publicationYear == null && left.publicationYear != null)
          return -1;
        const difference =
          (left.publicationYear ?? 0) - (right.publicationYear ?? 0);
        if (difference)
          return filters.sort === "year-asc" ? difference : -difference;
      }
      const score =
        filters.sort === "score-asc"
          ? left.relevanceScore - right.relevanceScore
          : right.relevanceScore - left.relevanceScore;
      return (
        score ||
        (right.publicationYear ?? 0) - (left.publicationYear ?? 0) ||
        left.title.localeCompare(right.title)
      );
    });
}
