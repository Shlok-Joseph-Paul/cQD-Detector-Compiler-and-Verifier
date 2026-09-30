import type { Metadata } from "next";
import proposalRegistry from "@/data/discovery/proposals.json";
import { DiscoveryQueueClient } from "@/components/discovery/DiscoveryQueueClient";
import { SiteShell } from "@/components/SiteShell";
import { atlasData } from "@/lib/data/generated";
import { filterPublicDiscoveryProposals } from "@/lib/discovery/public-queue";
import type { ProposalRegistry } from "@/lib/discovery/proposal-types";

export const metadata: Metadata = {
  title: "Photodiode Discovery",
  description:
    "Discover CQD and perovskite photodiode papers by material, publication year, and review status.",
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
            <h1>Discover photodiode papers.</h1>
            <p>
              Explore CQD and perovskite photodiode research. Find your next
              paper by material, year, or relevance.
            </p>
          </div>
          <aside>
            <strong>Photodiodes only</strong>
            <p>
              Papers need explicit photodiode evidence in their title or
              abstract. Full-text review is still required before atlas
              inclusion.
            </p>
          </aside>
        </header>
        <DiscoveryQueueClient proposals={proposals} />
      </div>
    </SiteShell>
  );
}
