import type { TechnologyFamily } from "../data/types.ts";
import type { DiscoveryCandidate, DiscoveryConfig } from "./types.ts";

export interface DiscoveryProfile {
  label: string;
  technologyFamily: TechnologyFamily;
  terminology: "cqd" | "perovskite";
  materialTerms: string[];
  queries: string[];
}

export function resolveDiscoveryProfile(
  config: DiscoveryConfig,
  requested?: TechnologyFamily,
): DiscoveryProfile {
  const technologyFamily = requested ?? config.defaultProfile ?? "cqd";
  const configured = config.profiles?.[technologyFamily];
  if (configured) return configured;
  if (technologyFamily !== "cqd")
    throw new Error(`Discovery profile is not configured: ${technologyFamily}`);
  return {
    label: "Colloidal quantum dots",
    technologyFamily: "cqd",
    terminology: "cqd",
    materialTerms: config.materialTerms,
    queries: config.queries,
  };
}

export function candidateTechnologyFamilies(
  candidate: DiscoveryCandidate,
): TechnologyFamily[] {
  return candidate.technologyFamilies?.length
    ? candidate.technologyFamilies
    : ["cqd"];
}

export function candidateMatchesTechnology(
  candidate: DiscoveryCandidate,
  technologyFamily?: TechnologyFamily,
): boolean {
  return (
    technologyFamily === undefined ||
    candidateTechnologyFamilies(candidate).includes(technologyFamily)
  );
}
