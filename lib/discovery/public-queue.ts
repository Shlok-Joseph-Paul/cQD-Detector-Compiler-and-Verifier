import type { Paper } from "../data/types.ts";
import { normalizeDoi, normalizeTitle } from "./normalize.ts";
import type { StagedPaperProposal } from "./proposal-types.ts";
import type { DiscoveryCandidate } from "./types.ts";
import { looksLikeNonPrimaryCandidate } from "./shortlist.ts";

const PHOTODIODE = /\bphoto[\s-]?diodes?\b|\bphotovoltaic detectors?\b/i;
const OTHER_DETECTOR =
  /\bphotoconductors?\b|\bphotoresistors?\b|\b(?:photo)?transistors?\b|\bphoto[ -]?fets?\b/i;

function evidenceText(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/[‐‑–—−]/g, "-");
}

/** Keep the public queue conservative; discovery keywords alone are not evidence. */
export function isPhotodiodeCandidate(candidate: DiscoveryCandidate): boolean {
  if (looksLikeNonPrimaryCandidate(candidate)) return false;
  const title = evidenceText(candidate.title);
  if (/\b(?:thesis|dissertation|correction|erratum|retraction)\b/i.test(title))
    return false;
  if (PHOTODIODE.test(title)) return true;
  if (OTHER_DETECTOR.test(title)) return false;
  if (OTHER_DETECTOR.test(candidate.candidateDeviceType ?? "")) return false;
  const abstract = evidenceText(candidate.abstract ?? "");
  // Ambiguous abstracts that discuss multiple device classes need full-text review.
  return PHOTODIODE.test(abstract) && !OTHER_DETECTOR.test(abstract);
}

// These records are retained in the versioned discovery registry for auditability,
// but are not useful screening candidates for the photodiode atlas.
export const PUBLIC_QUEUE_EXCLUSIONS: Readonly<Record<string, string>> = {
  "candidate-6a453ed1f34e23ea": "General photodetector review",
  "candidate-50dae34fdf1cf73e":
    "Nanocrystal electronic-structure study without a qualifying detector measurement",
  "candidate-b3329c9b578c2b5b": "Temperature-dependent HgTe spectroscopy study",
  "candidate-7a36cd48ec1aaadf":
    "Reported detectivity belongs to a lateral photoconductor",
  "candidate-e267ac054661d6dd": "General nanocrystal optoelectronics review",
  "candidate-e75a05cc5bea95b4":
    "Doctoral thesis rather than a primary journal paper",
  "candidate-1a83622286fe171c":
    "HgTe film structure study without a qualifying photodiode measurement",
  "candidate-beee40b9c5f822b8": "Emitter-only PbS nanocrystal study",
  "candidate-71a7f3dac85168f5": "Theoretical resonator-optimization study",
  "candidate-2206d145709be166": "Doctoral thesis duplicate",
  "candidate-61e25f17827e5d15":
    "Photoemission characterization study without reported photodiode detectivity",
  "candidate-e3e5d104b5960df1": "Infrared-detector review article",
  "candidate-00930eb1b362d1f2": "Mercury-chalcogenide CQD review article",
  "candidate-6d75de2413fbe344":
    "Nanocrystal-superlattice crystallization study unrelated to photodiodes",
  "candidate-b5d5cbadeafff773": "Field-effect-transistor spectroscopy study",
  "candidate-170faadb72fc3b16":
    "Operando electronic-structure study without reported photodiode detectivity",
};

function atlasKeys(papers: readonly Paper[]) {
  return {
    dois: new Set(
      papers
        .map((paper) => normalizeDoi(paper.doi))
        .filter((doi): doi is string => Boolean(doi)),
    ),
    titles: new Set(papers.map((paper) => normalizeTitle(paper.title))),
  };
}

export function filterPublicDiscoveryCandidates(
  candidates: readonly DiscoveryCandidate[],
  papers: readonly Paper[],
): DiscoveryCandidate[] {
  const existing = atlasKeys(papers);
  return candidates.filter((candidate) => {
    if (!isPhotodiodeCandidate(candidate)) return false;
    if (candidate.importStatus === "published") return false;
    if (candidate.screeningStatus === "exclude") return false;
    if (PUBLIC_QUEUE_EXCLUSIONS[candidate.candidateId]) return false;
    if (candidate.normalizedDoi && existing.dois.has(candidate.normalizedDoi))
      return false;
    return !existing.titles.has(normalizeTitle(candidate.title));
  });
}

export function filterPublicDiscoveryProposals(
  proposals: readonly StagedPaperProposal[],
  papers: readonly Paper[],
): StagedPaperProposal[] {
  const existing = atlasKeys(papers);
  return proposals.filter((proposal) => {
    if (proposal.status === "applied") return false;
    if (proposal.scopeStatus === "out-of-scope") return false;
    if (PUBLIC_QUEUE_EXCLUSIONS[proposal.candidateId]) return false;
    const hasPhotodiode = proposal.proposedDevices.some(
      (device) => device.detector_class === "photodiode",
    );
    const hasClassifiedDevice = proposal.proposedDevices.some((device) =>
      Boolean(device.detector_class),
    );
    // Older proposals may predate detector_class; explicit title evidence is enough
    // to list the paper, but does not make its extracted data approvable.
    if (
      !hasPhotodiode &&
      (hasClassifiedDevice ||
        !PHOTODIODE.test(evidenceText(proposal.proposedPaper.title)))
    )
      return false;
    const doi = normalizeDoi(proposal.proposedPaper.doi);
    if (doi && existing.dois.has(doi)) return false;
    return !existing.titles.has(normalizeTitle(proposal.proposedPaper.title));
  });
}
