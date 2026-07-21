import { parseCsv } from "../data/csv.ts";
import { normalizeDoi, normalizeTitle } from "./normalize.ts";
import { candidateTechnologyFamilies } from "./profiles.ts";
import type { DiscoveryCandidate } from "./types.ts";

export interface RankedCandidate extends DiscoveryCandidate {
  atlasRank: number;
  atlasFit: "high" | "medium" | "low";
  atlasPriorityScore: number;
}

export function extractAtlasKeys(papersCsv: string): {
  dois: Set<string>;
  titles: Set<string>;
} {
  const parsed = parseCsv(papersCsv);
  const doiIndex = parsed.headers.indexOf("doi");
  const titleIndex = parsed.headers.indexOf("title");
  return {
    dois: new Set(
      parsed.rows
        .map((row) => normalizeDoi(row.fields[doiIndex]))
        .filter((doi): doi is string => Boolean(doi)),
    ),
    titles: new Set(
      parsed.rows
        .map((row) => normalizeTitle(row.fields[titleIndex]))
        .filter(Boolean),
    ),
  };
}

export function looksLikeNonPrimaryCandidate(
  candidate: DiscoveryCandidate,
): boolean {
  const text = `${candidate.title} ${candidate.abstract ?? ""}`.toLowerCase();
  return (
    candidate.relevanceReasons.some((reason) =>
      /review or perspective|retraction|correction/i.test(reason),
    ) ||
    /\b(review|perspective|outlook|roadmap|types of photodetectors)\b/i.test(
      candidate.title,
    ) ||
    (/\b(emission|emitting|light emitting|luminescen)\b/i.test(text) &&
      !/\bphotodiode\b/i.test(text))
  );
}

function normalizedEvidenceText(candidate: DiscoveryCandidate): string {
  return `${candidate.title} ${candidate.abstract ?? ""}`
    .replace(/\s*<sub>\s*([0-9]+)\s*<\/sub>/gi, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (digit) => String("₀₁₂₃₄₅₆₇₈₉".indexOf(digit)))
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function classifyAtlasFit(
  candidate: DiscoveryCandidate,
): RankedCandidate["atlasFit"] {
  const text = normalizedEvidenceText(candidate);
  const hasDStar = /detectivit|\bd\s*\*/i.test(text);
  const hasPhotodiode =
    /photodiode|photovoltaic detector|\b(?:p-?n|p-?i-?n)\s+junction/i.test(
      text,
    );
  const hasDetector =
    /photodiode|photodetector|photo detector|photovoltaic detector|image sensor|\bimager\b|focal plane array/i.test(
      text,
    );
  const hasCqd =
    /colloidal quantum dot|colloidal nanocrystal|solution[ -]processed (?:colloidal )?quantum dot|\bcqds?\b/i.test(
      text,
    );
  const isPerovskite =
    candidateTechnologyFamilies(candidate).includes("perovskite");
  const hasPerovskite = /\bperovskites?\b/i.test(text);
  const hasProfileAbsorber = isPerovskite ? hasPerovskite : hasCqd;
  if (
    candidate.relevanceScore >= 74 &&
    hasDStar &&
    hasPhotodiode &&
    hasProfileAbsorber
  )
    return "high";
  if (
    candidate.relevanceScore >= 64 &&
    hasDStar &&
    hasDetector &&
    hasProfileAbsorber
  )
    return "medium";
  return "low";
}

export function atlasPriorityScore(candidate: DiscoveryCandidate): number {
  const text = `${candidate.title} ${candidate.abstract ?? ""} ${candidate.candidateMaterialClasses.join(" ")}`;
  const fitValue = classifyAtlasFit(candidate);
  const isPerovskite =
    candidateTechnologyFamilies(candidate).includes("perovskite");
  const nonHeavyMetal =
    /Ag\s*2\s*(?:Te|Se)|silver\s+(?:telluride|selenide)|AgBiS|\bInAs\b|\bInSb\b|III.?V/i.test(
      text,
    );
  const heavyMetal =
    /\bHg|mercury|\bPb(?:S|Se)?\b|lead\s+(?:sulfide|selenide)/i.test(text);
  return Math.max(
    0,
    Math.min(
      100,
      candidate.relevanceScore +
        (candidate.openAccessPdfUrl ? 8 : 0) +
        (!isPerovskite && nonHeavyMetal ? 12 : 0) -
        (!isPerovskite && heavyMetal ? 6 : 0) +
        (fitValue === "high" ? 8 : fitValue === "medium" ? 4 : -20),
    ),
  );
}

export function rankNewCandidates(
  candidates: readonly DiscoveryCandidate[],
  papersCsv: string,
): RankedCandidate[] {
  const existing = extractAtlasKeys(papersCsv);
  return candidates
    .filter((candidate) => candidate.importStatus !== "published")
    .filter((candidate) => candidate.screeningStatus !== "exclude")
    .filter(
      (candidate) =>
        !candidate.normalizedDoi || !existing.dois.has(candidate.normalizedDoi),
    )
    .filter(
      (candidate) => !existing.titles.has(normalizeTitle(candidate.title)),
    )
    .filter((candidate) => !looksLikeNonPrimaryCandidate(candidate))
    .map((candidate) => ({
      ...candidate,
      atlasFit: classifyAtlasFit(candidate),
      atlasPriorityScore: atlasPriorityScore(candidate),
    }))
    .sort(
      (left, right) =>
        right.atlasPriorityScore - left.atlasPriorityScore ||
        right.relevanceScore - left.relevanceScore ||
        (right.publicationYear ?? 0) - (left.publicationYear ?? 0) ||
        left.title.localeCompare(right.title),
    )
    .map((candidate, index) => ({ ...candidate, atlasRank: index + 1 }));
}

function paperUrl(candidate: DiscoveryCandidate): string | null {
  return candidate.normalizedDoi
    ? `https://doi.org/${candidate.normalizedDoi}`
    : candidate.publicationUrl;
}

function link(label: string, url: string | null): string {
  return url ? `[${label}](${url})` : label;
}

export function renderCandidateShortlist(
  candidates: readonly DiscoveryCandidate[],
  papersCsv: string,
): string {
  const ranked = rankNewCandidates(candidates, papersCsv);
  const rows = ranked.length
    ? ranked
        .map((candidate) => {
          const metadata = [
            `${candidate.atlasFit.toUpperCase()} atlas fit`,
            candidate.publicationYear ?? "year unknown",
            candidate.candidateMaterialClasses.join("/") ||
              "material unclassified",
            `priority ${candidate.atlasPriorityScore}`,
            candidate.openAccessPdfUrl
              ? link("open PDF", candidate.openAccessPdfUrl)
              : "PDF not located",
          ].join(" · ");
          return `${candidate.atlasRank}. ${link(candidate.title, paperUrl(candidate))} — ${metadata}`;
        })
        .join("\n")
    : "No new candidates remain after atlas deduplication.";
  return [
    "# Ranked new-paper shortlist",
    "",
    "Generated from `candidates.json`, excluding papers already published in the atlas by DOI or normalized title, explicitly excluded records, and obvious reviews or non-primary publications. Priority combines the recorded relevance score with open-PDF availability, non-heavy-metal preference, and likely atlas scope; every candidate still requires full-text scope and detectivity verification.",
    "",
    "## Papers to screen",
    "",
    rows,
    "",
  ].join("\n");
}
