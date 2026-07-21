import { readFile } from "node:fs/promises";
import type {
  ProposalRegistry,
  StagedPaperProposal,
} from "./proposal-types.ts";
import { PROPOSAL_STATUSES, SCOPE_STATUSES } from "./proposal-types.ts";
import { writeTextAtomically } from "./storage.ts";

export async function readProposalRegistry(
  file: string,
): Promise<ProposalRegistry> {
  return JSON.parse(await readFile(file, "utf8")) as ProposalRegistry;
}

export function validateProposal(proposal: StagedPaperProposal): string[] {
  const errors: string[] = [];
  if (!proposal.proposalId) errors.push("proposalId is required");
  if (!proposal.candidateId) errors.push("candidateId is required");
  if (!PROPOSAL_STATUSES.includes(proposal.status))
    errors.push(`invalid proposal status: ${proposal.status}`);
  if (!SCOPE_STATUSES.includes(proposal.scopeStatus))
    errors.push(`invalid scope status: ${proposal.scopeStatus}`);
  if (
    !proposal.source.url.startsWith("https://") &&
    !proposal.source.url.startsWith("http://")
  )
    errors.push("source URL must be HTTP(S)");
  if (!proposal.source.pdfSha256) errors.push("source PDF hash is required");
  if (!proposal.proposedPaper.paper_id)
    errors.push("proposed paper ID is required");
  for (const device of proposal.proposedDevices) {
    if (device.paper_id !== proposal.proposedPaper.paper_id)
      errors.push(`${device.device_id}: paper foreign key mismatch`);
  }
  const deviceIds = new Set(
    proposal.proposedDevices.map((device) => device.device_id),
  );
  for (const measurement of proposal.proposedMeasurements) {
    if (!deviceIds.has(measurement.device_id))
      errors.push(`${measurement.measurement_id}: unknown device`);
    if (!(measurement.wavelength_nm > 0))
      errors.push(`${measurement.measurement_id}: wavelength must be positive`);
    if (!(measurement.detectivity_jones > 0))
      errors.push(
        `${measurement.measurement_id}: detectivity must be positive`,
      );
  }
  if (proposal.status === "approved") {
    if (proposal.scopeStatus !== "in-scope")
      errors.push("only in-scope proposals can be approved");
    if (proposal.proposedMeasurements.length === 0)
      errors.push("approved proposal requires at least one measurement");
  }
  return errors;
}

export function validateProposalRegistry(registry: ProposalRegistry): string[] {
  const errors: string[] = [];
  if (registry.schemaVersion !== 1)
    errors.push("unsupported proposal registry schema");
  const ids = new Set<string>();
  for (const proposal of registry.proposals) {
    if (ids.has(proposal.proposalId))
      errors.push(`duplicate proposal ID: ${proposal.proposalId}`);
    ids.add(proposal.proposalId);
    for (const error of validateProposal(proposal))
      errors.push(`${proposal.proposalId}: ${error}`);
  }
  return errors;
}

export async function writeProposalRegistry(
  file: string,
  registry: ProposalRegistry,
): Promise<void> {
  const errors = validateProposalRegistry(registry);
  if (errors.length)
    throw new Error(`Invalid proposal registry:\n${errors.join("\n")}`);
  const sorted = {
    ...registry,
    proposals: [...registry.proposals].sort(
      (left, right) =>
        right.proposedAt.localeCompare(left.proposedAt) ||
        left.proposalId.localeCompare(right.proposalId),
    ),
  };
  await writeTextAtomically(file, `${JSON.stringify(sorted, null, 2)}\n`);
}
