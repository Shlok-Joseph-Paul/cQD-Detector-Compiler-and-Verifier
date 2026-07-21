import { createHash, randomUUID } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import type { TechnologyFamily } from "../data/types.ts";
import { CrossrefClient, OpenAlexClient } from "./api.ts";
import {
  deduplicateRegistryCandidates,
  findCandidateMatch,
  markPossibleDuplicate,
  mergeExactCandidate,
} from "./dedupe.ts";
import { parseCsv } from "./csv.ts";
import {
  normalizeDoi,
  normalizeTitle,
  reconstructOpenAlexAbstract,
} from "./normalize.ts";
import { calculateRelevance } from "./score.ts";
import { resolveDiscoveryProfile } from "./profiles.ts";
import { withDiscoveryWriteLock, writeTextAtomically } from "./storage.ts";
import type {
  CandidateRegistry,
  DiscoveryCandidate,
  DiscoveryConfig,
  DiscoveryMethod,
  DiscoveryRunLog,
  OpenAlexWork,
} from "./types.ts";
import { validateRegistry } from "./validate.ts";

export interface PipelinePaths {
  config: string;
  registry: string;
  atlasPapers: string;
  atlasDevices: string;
  runLog: string;
  cacheDirectory: string;
}

export interface PipelineOptions {
  root: string;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  technologyFamily?: TechnologyFamily;
}

export interface UpdateResult {
  registry: CandidateRegistry;
  retrieved: number;
  added: number;
  deduplicated: number;
  excludedAtlasDois: number;
}

export function defaultPipelinePaths(root: string): PipelinePaths {
  return {
    config: path.join(root, "data/discovery/config.json"),
    registry: path.join(root, "data/discovery/candidates.json"),
    atlasPapers: path.join(root, "data/papers.csv"),
    atlasDevices: path.join(root, "data/devices.csv"),
    runLog: path.join(root, "data/discovery/runs.jsonl"),
    cacheDirectory: path.join(root, "data/discovery/cache"),
  };
}

export async function readDiscoveryConfig(
  file: string,
): Promise<DiscoveryConfig> {
  return JSON.parse(await readFile(file, "utf8")) as DiscoveryConfig;
}

export async function readCandidateRegistry(
  file: string,
): Promise<CandidateRegistry> {
  return JSON.parse(await readFile(file, "utf8")) as CandidateRegistry;
}

export async function writeCandidateRegistry(
  file: string,
  registry: CandidateRegistry,
): Promise<void> {
  const errors = validateRegistry(registry);
  if (errors.length)
    throw new Error(`Invalid candidate registry:\n${errors.join("\n")}`);
  const sorted = {
    ...registry,
    candidates: [...registry.candidates].sort(
      (a, b) =>
        b.relevanceScore - a.relevanceScore ||
        a.candidateId.localeCompare(b.candidateId),
    ),
  };
  await writeTextAtomically(file, `${JSON.stringify(sorted, null, 2)}\n`);
}

export function extractAtlasDoisFromCsv(csv: string): Set<string> {
  const [headerLine, ...lines] = csv.split(/\r?\n/);
  const headers = headerLine.split(",");
  const doiIndex = headers.indexOf("doi");
  if (doiIndex < 0) return new Set();
  const dois = new Set<string>();
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index <= line.length; index += 1) {
      const char = line[index];
      if (char === '"' && quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') quoted = !quoted;
      else if ((char === "," || index === line.length) && !quoted) {
        cells.push(value);
        value = "";
      } else value += char ?? "";
    }
    const doi = normalizeDoi(cells[doiIndex]);
    if (doi) dois.add(doi);
  }
  return dois;
}

function candidateId(work: OpenAlexWork): string {
  const doi = normalizeDoi(work.doi);
  const stable = doi
    ? `doi:${doi}`
    : (work.id ??
      `${work.title ?? work.display_name}:${work.publication_year ?? ""}`);
  return `candidate-${createHash("sha256").update(stable).digest("hex").slice(0, 16)}`;
}

export function candidateFromOpenAlex(
  work: OpenAlexWork,
  config: DiscoveryConfig,
  context: {
    method: DiscoveryMethod;
    query?: string;
    seedPaperId?: string;
    now?: Date;
    technologyFamily?: TechnologyFamily;
  },
): DiscoveryCandidate | null {
  const title = work.title ?? work.display_name;
  if (!title || typeof title !== "string") return null;
  const now = context.now ?? new Date();
  const profile = resolveDiscoveryProfile(config, context.technologyFamily);
  const score = calculateRelevance(
    work,
    config,
    [context.method],
    profile.technologyFamily,
  );
  const doi = normalizeDoi(work.doi);
  const pdf =
    work.best_oa_location?.pdf_url ?? work.primary_location?.pdf_url ?? null;
  const pdfSource = work.best_oa_location?.pdf_url
    ? work.best_oa_location.source?.display_name
    : work.primary_location?.pdf_url
      ? work.primary_location.source?.display_name
      : null;
  return {
    candidateId: candidateId(work),
    doi,
    normalizedDoi: doi,
    title,
    normalizedTitle: normalizeTitle(title),
    authors: (work.authorships ?? [])
      .map((item) => item.author?.display_name)
      .filter((value): value is string => Boolean(value)),
    publicationYear: Number.isInteger(work.publication_year)
      ? work.publication_year!
      : null,
    journal: work.primary_location?.source?.display_name ?? null,
    abstract: reconstructOpenAlexAbstract(work.abstract_inverted_index),
    openAlexId: work.id ?? null,
    crossrefMetadata: null,
    publicationUrl:
      work.primary_location?.landing_page_url ??
      (doi ? `https://doi.org/${doi}` : (work.id ?? null)),
    openAccessPdfUrl: pdf,
    openAccessPdfSource: pdf
      ? (pdfSource ?? "OpenAlex open-access location")
      : null,
    discoverySources: ["OpenAlex"],
    discoveryQueries: context.query ? [context.query] : [],
    seedPaperIds: context.seedPaperId ? [context.seedPaperId] : [],
    discoveryMethods: [context.method],
    technologyFamilies: [profile.technologyFamily],
    candidateMaterialClasses: score.materials,
    candidateDeviceType: score.deviceType,
    candidateSpectralRegions: score.spectralRegions,
    relevanceScore: score.score,
    relevanceReasons: score.reasons,
    screeningStatus: "unreviewed",
    exclusionReason: null,
    screeningNotes: null,
    pdfStatus: pdf ? "available" : "not-checked",
    importStatus: "not-started",
    dateDiscovered: now.toISOString().slice(0, 10),
    lastMetadataRefresh: now.toISOString(),
    duplicateRelationships: [],
    manualOverrides: {},
  };
}

export function updateRegistryIncrementally(
  registry: CandidateRegistry,
  works: readonly OpenAlexWork[],
  config: DiscoveryConfig,
  context: {
    method: DiscoveryMethod;
    query?: string;
    seedPaperId?: string;
    now?: Date;
    technologyFamily?: TechnologyFamily;
  },
  atlasDois = new Set<string>(),
): UpdateResult {
  const candidates = [...registry.candidates];
  let added = 0;
  let deduplicated = 0;
  let excludedAtlasDois = 0;
  for (const work of works) {
    const incoming = candidateFromOpenAlex(work, config, context);
    if (!incoming) continue;
    if (incoming.normalizedDoi && atlasDois.has(incoming.normalizedDoi)) {
      excludedAtlasDois += 1;
      continue;
    }
    const match = findCandidateMatch(
      incoming,
      candidates,
      config.ranking.fuzzyTitleThreshold,
    );
    if (match.kind === "exact" && match.candidate) {
      const index = candidates.findIndex(
        (item) => item.candidateId === match.candidate!.candidateId,
      );
      candidates[index] = mergeExactCandidate(candidates[index], incoming);
      deduplicated += 1;
    } else {
      candidates.push(
        match.kind === "possible" && match.relationship
          ? markPossibleDuplicate(incoming, match.relationship)
          : incoming,
      );
      added += 1;
    }
  }
  return {
    registry: { ...registry, configVersion: config.version, candidates },
    retrieved: works.length,
    added,
    deduplicated,
    excludedAtlasDois,
  };
}

export class DiscoveryPipeline {
  readonly paths: PipelinePaths;
  readonly dryRun: boolean;
  private readonly now: () => Date;
  private readonly options: PipelineOptions;
  private readonly writeLockHeld: boolean;

  constructor(options: PipelineOptions, writeLockHeld = false) {
    this.options = options;
    this.paths = defaultPipelinePaths(options.root);
    this.dryRun = options.dryRun ?? false;
    this.now = options.now ?? (() => new Date());
    this.writeLockHeld = writeLockHeld;
  }

  async discoverKeywords(
    queries?: string[],
    from?: string,
    to?: string,
  ): Promise<UpdateResult> {
    if (!this.dryRun && !this.writeLockHeld)
      return withDiscoveryWriteLock(this.options.root, () =>
        new DiscoveryPipeline(this.options, true).discoverKeywords(
          queries,
          from,
          to,
        ),
      );
    const config = await readDiscoveryConfig(this.paths.config);
    const profile = resolveDiscoveryProfile(
      config,
      this.options.technologyFamily,
    );
    let registry = await readCandidateRegistry(this.paths.registry);
    const atlasDois = extractAtlasDoisFromCsv(
      await readFile(this.paths.atlasPapers, "utf8"),
    );
    const client = new OpenAlexClient(
      config,
      this.paths.cacheDirectory,
      this.dryRun,
      this.options.fetchImpl,
    );
    const selected = queries?.length ? queries : profile.queries;
    const total: UpdateResult = {
      registry,
      retrieved: 0,
      added: 0,
      deduplicated: 0,
      excludedAtlasDois: 0,
    };
    const errors: string[] = [];
    for (const query of selected) {
      try {
        const works = await client.search(query, from, to);
        const result = updateRegistryIncrementally(
          registry,
          works,
          config,
          {
            method: "keyword",
            query,
            now: this.now(),
            technologyFamily: profile.technologyFamily,
          },
          atlasDois,
        );
        registry = result.registry;
        total.retrieved += result.retrieved;
        total.added += result.added;
        total.deduplicated += result.deduplicated;
        total.excludedAtlasDois += result.excludedAtlasDois;
      } catch (error) {
        errors.push(`${query}: ${(error as Error).message}`);
      }
    }
    total.registry = registry;
    if (!this.dryRun)
      await writeCandidateRegistry(this.paths.registry, registry);
    await this.logRun({
      configurationVersion: config.version,
      sourceApi: ["OpenAlex"],
      commands: ["discover"],
      exactQueries: selected,
      seedPapers: [],
      dateFilters: { from, to },
      retrieved: total.retrieved,
      newlyAdded: total.added,
      deduplicated: total.deduplicated,
      errors,
      incompleteRequests: errors,
    });
    if (errors.length === selected.length) throw new Error(errors.join("\n"));
    return total;
  }

  async refreshMetadata(): Promise<{ refreshed: number; errors: string[] }> {
    if (!this.dryRun && !this.writeLockHeld)
      return withDiscoveryWriteLock(this.options.root, () =>
        new DiscoveryPipeline(this.options, true).refreshMetadata(),
      );
    const config = await readDiscoveryConfig(this.paths.config);
    const registry = await readCandidateRegistry(this.paths.registry);
    const client = new CrossrefClient(
      config,
      this.paths.cacheDirectory,
      this.dryRun,
      this.options.fetchImpl,
    );
    let refreshed = 0;
    const errors: string[] = [];
    const candidates: DiscoveryCandidate[] = [];
    for (const candidate of registry.candidates) {
      if (!candidate.normalizedDoi) {
        candidates.push(candidate);
        continue;
      }
      try {
        const crossrefMetadata = await client.work(
          candidate.normalizedDoi,
          this.now(),
        );
        candidates.push({
          ...candidate,
          crossrefMetadata,
          title: crossrefMetadata.title ?? candidate.title,
          normalizedTitle: normalizeTitle(
            crossrefMetadata.title ?? candidate.title,
          ),
          authors: crossrefMetadata.authors.length
            ? crossrefMetadata.authors
            : candidate.authors,
          publicationYear:
            crossrefMetadata.publicationYear ?? candidate.publicationYear,
          journal: crossrefMetadata.journal ?? candidate.journal,
          publicationUrl: crossrefMetadata.url ?? candidate.publicationUrl,
          discoverySources: [
            ...new Set([...candidate.discoverySources, "Crossref"]),
          ],
          lastMetadataRefresh: this.now().toISOString(),
        });
        refreshed += 1;
      } catch (error) {
        candidates.push(candidate);
        errors.push(`${candidate.candidateId}: ${(error as Error).message}`);
      }
    }
    const updated = { ...registry, configVersion: config.version, candidates };
    if (!this.dryRun)
      await writeCandidateRegistry(this.paths.registry, updated);
    await this.logRun({
      configurationVersion: config.version,
      sourceApi: ["Crossref"],
      commands: ["refresh"],
      exactQueries: [],
      seedPapers: [],
      dateFilters: {},
      retrieved: registry.candidates.length,
      newlyAdded: 0,
      deduplicated: 0,
      errors,
      incompleteRequests: errors,
    });
    return { refreshed, errors };
  }

  async expandAtlasSeeds(
    methods: DiscoveryMethod[] = [
      "reference",
      "cited-by",
      "related-work",
      "author",
    ],
  ): Promise<UpdateResult> {
    if (!this.dryRun && !this.writeLockHeld)
      return withDiscoveryWriteLock(this.options.root, () =>
        new DiscoveryPipeline(this.options, true).expandAtlasSeeds(methods),
      );
    const config = await readDiscoveryConfig(this.paths.config);
    const profile = resolveDiscoveryProfile(
      config,
      this.options.technologyFamily,
    );
    let registry = await readCandidateRegistry(this.paths.registry);
    const papersCsv = await readFile(this.paths.atlasPapers, "utf8");
    const devicesCsv = await readFile(this.paths.atlasDevices, "utf8");
    const atlasDois = extractAtlasDoisFromCsv(papersCsv);
    const rows = parseCsv(papersCsv);
    const deviceRows = parseCsv(devicesCsv);
    const deviceHeaders = deviceRows[0] ?? [];
    const devicePaperIdIndex = deviceHeaders.indexOf("paper_id");
    const technologyIndex = deviceHeaders.indexOf("technology_family");
    const profilePaperIds = new Set(
      deviceRows
        .slice(1)
        .filter((row) => {
          const technology =
            technologyIndex >= 0 ? row[technologyIndex] : "cqd";
          return technology === profile.technologyFamily;
        })
        .map((row) => row[devicePaperIdIndex])
        .filter(Boolean),
    );
    const headers = rows[0] ?? [];
    const idIndex = headers.indexOf("paper_id");
    const doiIndex = headers.indexOf("doi");
    const seeds = rows
      .slice(1)
      .map((row) => ({
        paperId: row[idIndex],
        doi: normalizeDoi(row[doiIndex]),
      }))
      .filter(
        (seed) => seed.paperId && seed.doi && profilePaperIds.has(seed.paperId),
      );
    const client = new OpenAlexClient(
      config,
      this.paths.cacheDirectory,
      this.dryRun,
      this.options.fetchImpl,
    );
    const total: UpdateResult = {
      registry,
      retrieved: 0,
      added: 0,
      deduplicated: 0,
      excludedAtlasDois: 0,
    };
    const errors: string[] = [];
    for (const seed of seeds) {
      try {
        const seedWorks = await client.worksByFilter(
          `doi:https://doi.org/${seed.doi}`,
        );
        const seedWork = seedWorks[0];
        if (!seedWork?.id) throw new Error("OpenAlex seed not found");
        for (const method of methods) {
          let works: OpenAlexWork[] = [];
          if (method === "cited-by")
            works = await client.worksByFilter(
              `cites:${seedWork.id.replace(/^https?:\/\/openalex\.org\//i, "")}`,
            );
          else if (method === "reference")
            works = await Promise.all(
              (seedWork.referenced_works ?? [])
                .slice(0, config.openAlex.perPage)
                .map((id) => client.workById(id)),
            );
          else if (method === "related-work")
            works = await Promise.all(
              (seedWork.related_works ?? [])
                .slice(0, config.openAlex.perPage)
                .map((id) => client.workById(id)),
            );
          else if (method === "author") {
            const authorIds = (seedWork.authorships ?? [])
              .map((item) => item.author?.id)
              .filter((id): id is string => Boolean(id));
            for (const authorId of authorIds.slice(0, 3)) {
              works.push(
                ...(await client.worksByFilter(
                  `author.id:${authorId.replace(/^https?:\/\/openalex\.org\//i, "")}`,
                )),
              );
            }
          }
          const result = updateRegistryIncrementally(
            registry,
            works,
            config,
            {
              method,
              seedPaperId: seed.paperId,
              now: this.now(),
              technologyFamily: profile.technologyFamily,
            },
            atlasDois,
          );
          registry = result.registry;
          total.retrieved += result.retrieved;
          total.added += result.added;
          total.deduplicated += result.deduplicated;
          total.excludedAtlasDois += result.excludedAtlasDois;
        }
      } catch (error) {
        errors.push(`${seed.paperId}: ${(error as Error).message}`);
      }
    }
    total.registry = registry;
    if (!this.dryRun)
      await writeCandidateRegistry(this.paths.registry, registry);
    await this.logRun({
      configurationVersion: config.version,
      sourceApi: ["OpenAlex"],
      commands: ["expand"],
      exactQueries: [],
      seedPapers: seeds.map((seed) => seed.paperId),
      dateFilters: {},
      retrieved: total.retrieved,
      newlyAdded: total.added,
      deduplicated: total.deduplicated,
      errors,
      incompleteRequests: errors,
    });
    return total;
  }

  async deduplicate(): Promise<{
    merged: number;
    possible: number;
    registry: CandidateRegistry;
  }> {
    if (!this.dryRun && !this.writeLockHeld)
      return withDiscoveryWriteLock(this.options.root, () =>
        new DiscoveryPipeline(this.options, true).deduplicate(),
      );
    const config = await readDiscoveryConfig(this.paths.config);
    const registry = await readCandidateRegistry(this.paths.registry);
    const result = deduplicateRegistryCandidates(
      registry.candidates,
      config.ranking.fuzzyTitleThreshold,
    );
    const updated = {
      ...registry,
      configVersion: config.version,
      candidates: result.candidates,
    };
    if (!this.dryRun)
      await writeCandidateRegistry(this.paths.registry, updated);
    await this.logRun({
      configurationVersion: config.version,
      sourceApi: [],
      commands: ["dedupe"],
      exactQueries: [],
      seedPapers: [],
      dateFilters: {},
      retrieved: registry.candidates.length,
      newlyAdded: 0,
      deduplicated: result.merged,
      errors: [],
      incompleteRequests: [],
    });
    return { ...result, registry: updated };
  }

  async logRun(
    input: Omit<DiscoveryRunLog, "runId" | "timestamp" | "dryRun">,
  ): Promise<DiscoveryRunLog> {
    const log: DiscoveryRunLog = {
      runId: randomUUID(),
      timestamp: this.now().toISOString(),
      dryRun: this.dryRun,
      ...input,
    };
    if (!this.dryRun)
      await appendFile(this.paths.runLog, `${JSON.stringify(log)}\n`, "utf8");
    return log;
  }
}
