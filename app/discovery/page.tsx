import type { Metadata } from "next";
import proposalRegistry from "@/data/discovery/proposals.json";
import { DiscoveryQueueClient } from "@/components/discovery/DiscoveryQueueClient";
import { SiteShell } from "@/components/SiteShell";
import { atlasData } from "@/lib/data/generated";
import { filterPublicDiscoveryProposals } from "@/lib/discovery/public-queue";
import type { ProposalRegistry } from "@/lib/discovery/proposal-types";

export const metadata: Metadata = {
  title: "Discovery Queue",
  description:
    "A reproducible, human-screened candidate-paper registry for the Photodiode Atlas.",
};

export default function DiscoveryPage() {
  const proposals = filterPublicDiscoveryProposals(
    (proposalRegistry as unknown as ProposalRegistry).proposals,
    atlasData.papers,
  );
  return (
    <SiteShell>
      <div className="page-shell discovery-page">
        <header className="discovery-hero">
          <div>
            <p className="eyebrow">Literature discovery</p>
            <h1>Discovery Queue</h1>
            <p>
              Candidate CQD and perovskite photodetector papers found through
              reproducible keyword and citation-graph searches, ranked for human
              review.
            </p>
          </div>
          <aside>
            <strong>Screening is not publication.</strong>
            <p>
              Candidates remain separate from the curated atlas. Inclusion
              requires a human decision and the evidence-linked paper importer
              workflow.
            </p>
          </aside>
        </header>
        <DiscoveryQueueClient proposals={proposals} />
      </div>
    </SiteShell>
  );
}
