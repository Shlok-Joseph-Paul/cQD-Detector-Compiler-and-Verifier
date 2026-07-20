import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  DiscoveryPipeline,
  exportScreeningCsv,
  importScreeningCsv,
  readCandidateRegistry,
  validateRegistry,
  writeCandidateRegistry,
} from "../lib/discovery/index.ts";

const root = process.cwd();
const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith("--")) ?? "help";
const dryRun = args.includes("--dry-run");
const pipeline = new DiscoveryPipeline({ root, dryRun });

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

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
  } else if (command === "import-screening") {
    const input = option("input");
    if (!input) throw new Error("--input=<screening.csv> is required");
    const registry = await readCandidateRegistry(pipeline.paths.registry);
    const updated = importScreeningCsv(
      registry,
      await readFile(path.resolve(root, input), "utf8"),
    );
    const errors = validateRegistry(updated);
    if (errors.length) throw new Error(errors.join("\n"));
    if (!dryRun) await writeCandidateRegistry(pipeline.paths.registry, updated);
    printResult({ candidates: updated.candidates.length, dryRun });
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
      `CQD Paper Discovery Queue\n\nCommands:\n  discover [--query=q1|q2] [--from=YYYY-MM-DD] [--to=YYYY-MM-DD] [--dry-run]\n  expand [--methods=reference,cited-by,related-work,author] [--dry-run]\n  refresh [--dry-run]\n  dedupe [--dry-run]\n  export-screening [--output=file.csv] [--dry-run]\n  import-screening --input=file.csv [--dry-run]\n  summary\n`,
    );
  }
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
});
