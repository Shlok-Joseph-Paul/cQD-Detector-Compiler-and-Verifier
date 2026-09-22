import registry from "@/data/discovery/candidates.json";
import { atlasData } from "@/lib/data/generated";
import { filterPublicDiscoveryCandidates } from "@/lib/discovery/public-queue";
import type { CandidateRegistry } from "@/lib/discovery/types";

let candidatesJson: string | undefined;

export function GET() {
  candidatesJson ??= JSON.stringify(filterPublicDiscoveryCandidates(
    (registry as CandidateRegistry).candidates,
    atlasData.papers,
  ));
  return new Response(candidatesJson, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=300",
    },
  });
}
