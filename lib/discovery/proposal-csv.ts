import type { ProposalRegistry, ProposalStatus } from "./proposal-types.ts";
import { PROPOSAL_STATUSES } from "./proposal-types.ts";
import { parseCsv } from "./csv.ts";

export const PROPOSAL_DECISION_COLUMNS = [
  "proposal_id",
  "status",
  "decision_notes",
] as const;

function escape(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportProposalDecisionsCsv(registry: ProposalRegistry): string {
  const rows = registry.proposals.map((proposal) => [
    proposal.proposalId,
    proposal.status,
    proposal.decisionNotes,
  ]);
  return (
    [
      PROPOSAL_DECISION_COLUMNS.join(","),
      ...rows.map((row) => row.map(escape).join(",")),
    ].join("\n") + "\n"
  );
}

export function importProposalDecisionsCsv(
  registry: ProposalRegistry,
  text: string,
  now = new Date(),
): ProposalRegistry {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error("Proposal decision CSV is empty");
  const indexes = new Map(header.map((column, index) => [column, index]));
  for (const required of PROPOSAL_DECISION_COLUMNS)
    if (!indexes.has(required))
      throw new Error(`Missing proposal decision column: ${required}`);
  const decisions = new Map(
    rows
      .filter((row) => row[indexes.get("proposal_id")!])
      .map((row) => [row[indexes.get("proposal_id")!], row]),
  );
  return {
    ...registry,
    proposals: registry.proposals.map((proposal) => {
      const row = decisions.get(proposal.proposalId);
      if (!row) return proposal;
      const status = row[indexes.get("status")!] as ProposalStatus;
      if (!PROPOSAL_STATUSES.includes(status))
        throw new Error(`${proposal.proposalId}: invalid status ${status}`);
      if (proposal.status === "applied" && status !== "applied")
        throw new Error(
          `${proposal.proposalId}: an applied proposal cannot be reopened through CSV`,
        );
      if (
        status === "approved" &&
        (proposal.scopeStatus !== "in-scope" ||
          proposal.proposedMeasurements.length === 0)
      )
        throw new Error(
          `${proposal.proposalId}: only an in-scope proposal with measurements can be approved`,
        );
      return {
        ...proposal,
        status,
        decisionNotes: row[indexes.get("decision_notes")!] || null,
        decidedAt: status === "awaiting-approval" ? null : now.toISOString(),
      };
    }),
  };
}
