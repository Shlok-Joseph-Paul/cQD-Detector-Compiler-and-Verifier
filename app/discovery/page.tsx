import type { Metadata } from "next";
import registry from "@/data/discovery/candidates.json";
import proposalRegistry from "@/data/discovery/proposals.json";
import { DiscoveryQueueClient } from "@/components/discovery/DiscoveryQueueClient";
import { SiteShell } from "@/components/SiteShell";
import type { CandidateRegistry } from "@/lib/discovery/types";
import type { ProposalRegistry } from "@/lib/discovery/proposal-types";

export const metadata: Metadata = {
  title: "Discovery Queue",
  description:
    "A reproducible, human-screened candidate-paper registry for the CQD Photodiode Atlas.",
};

export default function DiscoveryPage() {
  const candidates = (registry as CandidateRegistry).candidates;
  const proposals = (proposalRegistry as ProposalRegistry).proposals;
  return (
    <SiteShell>
      <div className="page-shell discovery-page">
        <header className="discovery-hero">
          <div>
            <p className="eyebrow">Literature discovery</p>
            <h1>Discovery Queue</h1>
            <p>
              Candidate CQD infrared-detector papers found through reproducible
              keyword and citation-graph searches, ranked for human review.
            </p>
          </div>
          <aside>
            <strong>Screening is not publication.</strong>
            <p>
              Candidates remain separate from the curated atlas. Inclusion
              requires a human decision and the existing CQD Paper Importer
              workflow.
            </p>
          </aside>
        </header>
        <DiscoveryQueueClient candidates={candidates} proposals={proposals} />
      </div>
    </SiteShell>
  );
}
