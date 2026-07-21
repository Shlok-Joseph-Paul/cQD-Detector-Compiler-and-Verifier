import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  TECHNOLOGY_FAMILIES,
  type TechnologyFamily,
} from "../lib/data/types.ts";
import {
  applyApprovedProposals,
  deduplicateRegistryCandidates,
  DiscoveryPipeline,
  exportProposalDecisionsCsv,
  exportScreeningCsv,
  importProposalDecisionsCsv,
  importScreeningCsv,
  prepareReviewBatch,
  proposeOpenAccessCandidates,
  renderCandidateShortlist,
  readCandidateRegistry,
  readDiscoveryConfig,
  readProposalRegistry,
  validateRegistry,
  withDiscoveryWriteLock,
  writeCandidateRegistry,
  writeProposalRegistry,
} from "../lib/discovery/index.ts";

const root = process.cwd();
const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith("--")) ?? "help";
const dryRun = args.includes("--dry-run");

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const requestedProfile = option("profile") ?? "cqd";
if (!TECHNOLOGY_FAMILIES.includes(requestedProfile as TechnologyFamily))
  throw new Error(`--profile must be one of ${TECHNOLOGY_FAMILIES.join(", ")}`);
const technologyFamily = requestedProfile as TechnologyFamily;
const pipeline = new DiscoveryPipeline({ root, dryRun, technologyFamily });

function printResult(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<void> {
  if (command === "discover") {
    const queries = option("query")?.split("|").filter(Boolean);
    const result = await pipeline.discoverKeywords(
      queries,
      option("from"),
      option("to"),
    );
    printResult({
      retrieved: result.retrieved,
      added: result.added,
      deduplicated: result.deduplicated,
      excludedAtlasDois: result.excludedAtlasDois,
      dryRun,
    });
  } else if (command === "expand") {
    const methods = option("methods")?.split(",").filter(Boolean) as Parameters<
      typeof pipeline.expandAtlasSeeds
    >[0];
    const result = await pipeline.expandAtlasSeeds(methods);
    printResult({
      retrieved: result.retrieved,
      added: result.added,
      deduplicated: result.deduplicated,
      excludedAtlasDois: result.excludedAtlasDois,
      dryRun,
    });
  } else if (command === "refresh") {
    printResult({ ...(await pipeline.refreshMetadata()), dryRun });
  } else if (command === "dedupe") {
    const result = await pipeline.deduplicate();
    printResult({ merged: result.merged, possible: result.possible, dryRun });
  } else if (command === "export-screening") {
    const output = path.resolve(
      root,
      option("output") ?? "data/discovery/screening.csv",
    );
    const registry = await readCandidateRegistry(pipeline.paths.registry);
    const csv = exportScreeningCsv(registry.candidates);
    if (!dryRun) await writeFile(output, csv, "utf8");
    printResult({ candidates: registry.candidates.length, output, dryRun });
  } else if (command === "export-shortlist") {
    const output = path.resolve(
      root,
      option("output") ?? "data/discovery/SHORTLIST.md",
    );
    const registry = await readCandidateRegistry(pipeline.paths.registry);
    const papersCsv = await readFile(
      path.join(root, "data/papers.csv"),
      "utf8",
    );
    const markdown = renderCandidateShortlist(registry.candidates, papersCsv);
    if (!dryRun) await writeFile(output, markdown, "utf8");
    printResult({ output, dryRun });
  } else if (command === "import-screening") {
    const input = option("input");
    if (!input) throw new Error("--input=<screening.csv> is required");
    const screeningCsv = await readFile(path.resolve(root, input), "utf8");
    const updateRegistry = async () => {
      const registry = await readCandidateRegistry(pipeline.paths.registry);
      const next = importScreeningCsv(registry, screeningCsv);
      const errors = validateRegistry(next);
      if (errors.length) throw new Error(errors.join("\n"));
      if (!dryRun) await writeCandidateRegistry(pipeline.paths.registry, next);
      return next;
    };
    const updated = dryRun
      ? await updateRegistry()
      : await withDiscoveryWriteLock(root, updateRegistry);
    printResult({ candidates: updated.candidates.length, dryRun });
  } else if (command === "parse-open-access") {
    const registry = await readCandidateRegistry(pipeline.paths.registry);
    const explicit = option("candidate")?.split(",").filter(Boolean) ?? [];
    const candidateIds = explicit.length
      ? explicit
      : args.includes("--included")
        ? registry.candidates
            .filter(
              (candidate) =>
                candidate.screeningStatus === "include" &&
                candidate.openAccessPdfUrl,
            )
            .map((candidate) => candidate.candidateId)
        : [];
    if (!candidateIds.length)
      throw new Error(
        "Use --candidate=<id[,id]> or --included to select open-access candidates",
      );
    const result = await proposeOpenAccessCandidates({
      root,
      candidateIds,
      dryRun,
    });
    printResult({
      proposed: result.proposals.map((proposal) => ({
        proposalId: proposal.proposalId,
        candidateId: proposal.candidateId,
        scopeStatus: proposal.scopeStatus,
        measurements: proposal.proposedMeasurements.length,
        warnings: proposal.warnings.length,
      })),
      skipped: result.skipped,
      warnings: result.warnings,
      cacheHits: result.cacheHits,
      dryRun,
    });
  } else if (command === "prepare-review") {
    const discovery = args.includes("--discover")
      ? await pipeline.discoverKeywords(undefined, option("from"), option("to"))
      : null;
    const expansion = args.includes("--expand")
      ? await pipeline.expandAtlasSeeds(
          option("methods")?.split(",").filter(Boolean) as Parameters<
            typeof pipeline.expandAtlasSeeds
          >[0],
        )
      : null;
    let dryRunRegistry;
    let deduplication = null;
    if (discovery || expansion) {
      if (dryRun) {
        const config = await readDiscoveryConfig(pipeline.paths.config);
        const combined = deduplicateRegistryCandidates(
          [discovery?.registry, expansion?.registry]
            .filter((registry) => Boolean(registry))
            .flatMap((registry) => registry!.candidates),
          config.ranking.fuzzyTitleThreshold,
        );
        dryRunRegistry = {
          schemaVersion: 1 as const,
          configVersion: config.version,
          candidates: combined.candidates,
        };
        deduplication = {
          ...combined,
          registry: dryRunRegistry,
        };
      } else deduplication = await pipeline.deduplicate();
    }
    const limit = option("limit");
    const minimumScore = option("minimum-score");
    printResult({
      refresh: {
        discovery: discovery
          ? {
              retrieved: discovery.retrieved,
              added: discovery.added,
              deduplicated: discovery.deduplicated,
              excludedAtlasDois: discovery.excludedAtlasDois,
            }
          : null,
        expansion: expansion
          ? {
              retrieved: expansion.retrieved,
              added: expansion.added,
              deduplicated: expansion.deduplicated,
              excludedAtlasDois: expansion.excludedAtlasDois,
            }
          : null,
        deduplication: deduplication
          ? {
              merged: deduplication.merged,
              possible: deduplication.possible,
            }
          : null,
      },
      ...(await prepareReviewBatch({
        root,
        limit: limit === undefined ? undefined : Number(limit),
        minimumScore:
          minimumScore === undefined ? undefined : Number(minimumScore),
        dryRun,
        technologyFamily,
        candidateRegistry: dryRunRegistry,
      })),
    });
  } else if (command === "export-proposal-decisions") {
    const output = path.resolve(
      root,
      option("output") ?? "data/discovery/proposal-decisions.csv",
    );
    const registry = await readProposalRegistry(
      path.join(root, "data/discovery/proposals.json"),
    );
    if (!dryRun)
      await writeFile(output, exportProposalDecisionsCsv(registry), "utf8");
    printResult({ proposals: registry.proposals.length, output, dryRun });
  } else if (command === "import-proposal-decisions") {
    const input = option("input");
    if (!input) throw new Error("--input=<proposal-decisions.csv> is required");
    const proposalFile = path.join(root, "data/discovery/proposals.json");
    const decisionsCsv = await readFile(path.resolve(root, input), "utf8");
    const updateRegistries = async () => {
      const proposalRegistry = await readProposalRegistry(proposalFile);
      const next = importProposalDecisionsCsv(proposalRegistry, decisionsCsv);
      if (!dryRun) await writeProposalRegistry(proposalFile, next);
      const approvedCandidateIds = new Set(
        next.proposals
          .filter((proposal) => proposal.status === "approved")
          .map((proposal) => proposal.candidateId),
      );
      if (!dryRun) {
        const candidateRegistry = await readCandidateRegistry(
          pipeline.paths.registry,
        );
        await writeCandidateRegistry(pipeline.paths.registry, {
          ...candidateRegistry,
          candidates: candidateRegistry.candidates.map((candidate) =>
            approvedCandidateIds.has(candidate.candidateId)
              ? { ...candidate, importStatus: "approved" as const }
              : candidate,
          ),
        });
      }
      return next;
    };
    const updated = dryRun
      ? await updateRegistries()
      : await withDiscoveryWriteLock(root, updateRegistries);
    printResult({
      statuses: Object.fromEntries(
        [
          "awaiting-approval",
          "approved",
          "rejected",
          "needs-correction",
          "applied",
        ].map((status) => [
          status,
          updated.proposals.filter((proposal) => proposal.status === status)
            .length,
        ]),
      ),
      dryRun,
    });
  } else if (command === "apply-approved") {
    const proposalRegistry = await readProposalRegistry(
      path.join(root, "data/discovery/proposals.json"),
    );
    const explicit = option("proposal")?.split(",").filter(Boolean) ?? [];
    const proposalIds = explicit.length
      ? explicit
      : proposalRegistry.proposals
          .filter((proposal) => proposal.status === "approved")
          .map((proposal) => proposal.proposalId);
    if (!proposalIds.length) throw new Error("No approved proposals selected");
    printResult({
      ...(await applyApprovedProposals(root, proposalIds, { dryRun })),
      dryRun,
    });
  } else if (command === "proposal-summary") {
    const registry = await readProposalRegistry(
      path.join(root, "data/discovery/proposals.json"),
    );
    printResult({
      total: registry.proposals.length,
      statuses: Object.fromEntries(
        [
          "awaiting-approval",
          "approved",
          "rejected",
          "needs-correction",
          "applied",
        ].map((status) => [
          status,
          registry.proposals.filter((proposal) => proposal.status === status)
            .length,
        ]),
      ),
      measurements: registry.proposals.reduce(
        (total, proposal) => total + proposal.proposedMeasurements.length,
        0,
      ),
      needsOcr: registry.proposals.filter(
        (proposal) => proposal.source.needsOcr,
      ).length,
    });
  } else if (command === "summary") {
    const registry = await readCandidateRegistry(pipeline.paths.registry);
    const counts = Object.fromEntries(
      ["unreviewed", "include", "exclude", "uncertain"].map((status) => [
        status,
        registry.candidates.filter(
          (candidate) => candidate.screeningStatus === status,
        ).length,
      ]),
    );
    const materials = new Map<string, number>();
    for (const candidate of registry.candidates)
      for (const material of candidate.candidateMaterialClasses)
        materials.set(material, (materials.get(material) ?? 0) + 1);
    printResult({
      total: registry.candidates.length,
      statuses: counts,
      materials: Object.fromEntries([...materials].sort()),
      configVersion: registry.configVersion,
    });
  } else {
    process.stdout.write(
      `Photodiode Paper Discovery Queue\n\nUse --profile=cqd|perovskite on discovery and review commands.\n\nCommands:\n  discover [--profile=cqd|perovskite] [--query=q1|q2] [--from=YYYY-MM-DD] [--to=YYYY-MM-DD] [--dry-run]\n  expand [--profile=cqd|perovskite] [--methods=reference,cited-by,related-work,author] [--dry-run]\n  refresh [--dry-run]\n  dedupe [--dry-run]\n  export-screening [--output=file.csv] [--dry-run]\n  export-shortlist [--output=file.md] [--dry-run]\n  import-screening --input=file.csv [--dry-run]\n  parse-open-access --candidate=id[,id] | --included [--dry-run]\n  prepare-review [--profile=cqd|perovskite] [--limit=N] [--minimum-score=N] [--discover] [--expand] [--from=YYYY-MM-DD] [--to=YYYY-MM-DD] [--dry-run]\n  export-proposal-decisions [--output=file.csv]\n  import-proposal-decisions --input=file.csv [--dry-run]\n  proposal-summary\n  apply-approved [--proposal=id[,id]] [--dry-run]\n  summary\n`,
    );
  }
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
});
