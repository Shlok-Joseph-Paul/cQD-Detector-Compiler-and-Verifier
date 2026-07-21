import {
  IMPORT_STATUSES,
  PDF_STATUSES,
  SCREENING_STATUSES,
  type CandidateRegistry,
  type DiscoveryCandidate,
} from "./types.ts";
import { TECHNOLOGY_FAMILIES } from "../data/types.ts";
import { normalizeDoi, normalizeTitle } from "./normalize.ts";

export function validateCandidate(candidate: DiscoveryCandidate): string[] {
  const errors: string[] = [];
  if (!candidate.candidateId) errors.push("candidateId is required");
  if (!candidate.title) errors.push("title is required");
  if (candidate.normalizedDoi !== normalizeDoi(candidate.doi)) {
    errors.push("normalizedDoi does not match doi");
  }
  if (candidate.normalizedTitle !== normalizeTitle(candidate.title)) {
    errors.push("normalizedTitle does not match title");
  }
  if (!SCREENING_STATUSES.includes(candidate.screeningStatus)) {
    errors.push(`invalid screeningStatus: ${candidate.screeningStatus}`);
  }
  if (!PDF_STATUSES.includes(candidate.pdfStatus)) {
    errors.push(`invalid pdfStatus: ${candidate.pdfStatus}`);
  }
  if (!IMPORT_STATUSES.includes(candidate.importStatus)) {
    errors.push(`invalid importStatus: ${candidate.importStatus}`);
  }
  if (
    candidate.technologyFamilies?.some(
      (family) => !TECHNOLOGY_FAMILIES.includes(family),
    )
  )
    errors.push("technologyFamilies contains an unsupported value");
  return errors;
}

export function validateRegistry(registry: CandidateRegistry): string[] {
  const errors: string[] = [];
  if (registry.schemaVersion !== 1)
    errors.push("unsupported registry schemaVersion");
  const ids = new Set<string>();
  for (const candidate of registry.candidates) {
    for (const error of validateCandidate(candidate)) {
      errors.push(`${candidate.candidateId || "unknown"}: ${error}`);
    }
    if (ids.has(candidate.candidateId))
      errors.push(`duplicate candidateId: ${candidate.candidateId}`);
    ids.add(candidate.candidateId);
  }
  return errors;
}
