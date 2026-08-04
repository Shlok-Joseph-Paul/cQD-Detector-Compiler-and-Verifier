import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseCsv, serializeCsv } from "../lib/data/csv.ts";
import { DEVICE_CSV_COLUMNS } from "../lib/data/parse.ts";
import type { Paper } from "../lib/data/types.ts";
import {
  fuzzyTitleSimilarity,
  normalizeTitle,
} from "../lib/discovery/normalize.ts";
import {
  extractLigandExchange,
  type LigandExchangeExtraction,
} from "../lib/discovery/ligand-exchange.ts";
import { splitMarkedPages } from "../lib/discovery/proposal-extractor.ts";

interface ManifestPaper {
  pdf_path: string;
  filename: string;
  text_path?: string;
  error?: string;
  needs_ocr?: boolean;
  supporting_information_urls?: string[];
}

interface Manifest {
  papers: ManifestPaper[];
}

interface SourceMatch {
  source: ManifestPaper;
  similarity: number;
}

interface ReviewResult {
  paperId: string;
  title: string;
  sourceAvailable: boolean;
  sourceFilename: string | null;
  sourceSimilarity: number | null;
  devices: Array<{
    deviceId: string;
    ligandExchange: Omit<LigandExchangeExtraction, "evidence">;
    evidence: LigandExchangeExtraction["evidence"];
  }>;
}

function args(): { manifests: string[]; output: string; apply: boolean } {
  const values = process.argv.slice(2);
  const manifests: string[] = [];
  let output = "data/reprocessing/ligand-exchange-inventory.json";
  let apply = false;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--manifest") {
      const manifest = values[index + 1];
      if (!manifest) throw new Error("--manifest requires a path");
      manifests.push(manifest);
      index += 1;
    } else if (value === "--output") {
      const next = values[index + 1];
      if (!next) throw new Error("--output requires a path");
      output = next;
      index += 1;
    } else if (value === "--apply") apply = true;
    else
      throw new Error(
        `Unknown argument ${value}. Use --manifest PATH [--manifest PATH] [--output PATH] [--apply].`,
      );
  }
  if (!manifests.length) throw new Error("At least one --manifest is required");
  return { manifests, output, apply };
}

function records(source: string): Record<string, string>[] {
  const parsed = parseCsv(source);
  return parsed.rows.map((row) =>
    Object.fromEntries(
      parsed.headers.map((header, index) => [header, row.fields[index] ?? ""]),
    ),
  );
}

function sourceTitle(filename: string): string {
  return filename
    .replace(/\.pdf$/i, "")
    .replace(/^.+?\s+-\s+(?:19|20)\d{2}\s+-\s+/, "")
    .replace(/^.+?\s+-\s+/, "")
    .trim();
}

function proposalPaperId(filename: string): string | null {
  const match = filename.match(/^proposal-([a-f0-9]{12})\.pdf$/i);
  return match ? `paper-${match[1].toLowerCase()}` : null;
}

function bestSource(
  paper: Paper,
  sources: ManifestPaper[],
): SourceMatch | null {
  const exactProposal = sources.find(
    (source) => proposalPaperId(source.filename) === paper.paper_id,
  );
  if (exactProposal) return { source: exactProposal, similarity: 1 };
  const ranked = sources
    .filter((source) => !source.error && source.text_path)
    .map((source) => {
      const paperTitle = normalizeTitle(paper.title);
      const candidateTitle = normalizeTitle(sourceTitle(source.filename));
      const prefixMatch =
        candidateTitle.length >= 45 &&
        (paperTitle.startsWith(candidateTitle) ||
          candidateTitle.startsWith(paperTitle));
      return {
        source,
        similarity: prefixMatch
          ? 0.95
          : fuzzyTitleSimilarity(paper.title, sourceTitle(source.filename)),
      };
    })
    .sort((left, right) => right.similarity - left.similarity);
  return ranked[0] && ranked[0].similarity >= 0.82 ? ranked[0] : null;
}

function paperFrom(row: Record<string, string>): Paper {
  return {
    paper_id: row.paper_id,
    title: row.title,
    authors: row.authors.split("|").filter(Boolean),
    first_author: row.first_author,
    journal: row.journal || null,
    publication_year: Number(row.publication_year),
    doi: row.doi || null,
    publication_url: row.publication_url || null,
    publication_type: row.publication_type as Paper["publication_type"],
    peer_reviewed: row.peer_reviewed === "true",
    notes: row.notes || null,
  };
}

function fallbackExtraction(
  row: Record<string, string>,
): LigandExchangeExtraction {
  const existing = extractLigandExchange(
    [
      {
        page: 0,
        documentLabel: "Existing curated metadata",
        text: [
          row.material_composition,
          row.device_stack,
          row.device_notes,
        ].join(" "),
      },
    ],
    "cqd",
  );
  const hasHint = existing.ligand_exchange_status !== "not_reported";
  return {
    ligand_exchange_status: "source_unavailable",
    ligand_exchange_type: hasHint ? existing.ligand_exchange_type : null,
    ligand_exchange_chemicals: hasHint
      ? existing.ligand_exchange_chemicals
      : null,
    native_ligands: hasHint ? existing.native_ligands : null,
    ligand_exchange_target: hasHint ? existing.ligand_exchange_target : null,
    ligand_exchange_conditions: hasHint
      ? `Existing curated device metadata indicates a ligand or surface treatment, but the source set was unavailable for method verification: ${row.material_composition || row.device_notes}`
      : null,
    ligand_exchange_source_location: null,
    evidence: [],
  };
}

function chemicalMatchesText(chemical: string, value: string): boolean {
  const acronym = chemical.match(/\(([^)]+)\)$/)?.[1];
  const normalized = value.replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
  const names = [chemical.replace(/\s*\([^)]+\)$/, ""), acronym ?? ""]
    .map((item) => item.replace(/[^A-Za-z0-9]+/g, "").toLowerCase())
    .filter(Boolean);
  return names.some((name) => normalized.includes(name));
}

function narrowToDevice(
  extraction: LigandExchangeExtraction,
  row: Record<string, string>,
): LigandExchangeExtraction {
  if (extraction.ligand_exchange_status !== "reported") return extraction;
  const metadata = extractLigandExchange(
    [
      {
        page: 0,
        documentLabel: "Existing curated metadata",
        text: [
          row.material_composition,
          row.device_stack,
          row.device_notes,
        ].join(" "),
      },
    ],
    "cqd",
  );
  const refinedExtraction: LigandExchangeExtraction =
    extraction.ligand_exchange_type === "other" &&
    metadata.ligand_exchange_type != null &&
    metadata.ligand_exchange_type !== "other"
      ? {
          ...extraction,
          ligand_exchange_type: metadata.ligand_exchange_type,
        }
      : extraction;
  const hints = metadata.ligand_exchange_chemicals?.split(" | ") ?? [];
  const extracted =
    refinedExtraction.ligand_exchange_chemicals?.split(" | ") ?? [];
  const narrowed = extracted.filter((chemical) => hints.includes(chemical));
  if (!narrowed.length || narrowed.length === extracted.length)
    return refinedExtraction;
  const scoredEvidence = refinedExtraction.evidence.map((item) => ({
    item,
    score: narrowed.filter((chemical) =>
      chemicalMatchesText(chemical, item.conciseEvidence),
    ).length,
  }));
  const maximumScore = Math.max(...scoredEvidence.map(({ score }) => score));
  const evidence = scoredEvidence
    .filter(({ score }) => score === maximumScore && score > 0)
    .map(({ item }) => item);
  const narrowedEvidence = evidence.length
    ? extractLigandExchange(
        evidence.map((item) => ({
          page: item.page,
          documentLabel: "Main article",
          text: item.conciseEvidence,
        })),
        "cqd",
      )
    : null;
  return {
    ...refinedExtraction,
    ligand_exchange_chemicals: narrowed.join(" | "),
    ligand_exchange_target:
      narrowedEvidence?.ligand_exchange_target ??
      refinedExtraction.ligand_exchange_target,
    ligand_exchange_source_location:
      evidence.map((item) => item.location).join(" | ") ||
      refinedExtraction.ligand_exchange_source_location,
    evidence: evidence.length ? evidence : refinedExtraction.evidence,
  };
}

function normalizeSourceLimitations(
  extraction: LigandExchangeExtraction,
  source: ManifestPaper,
): LigandExchangeExtraction {
  if (
    extraction.ligand_exchange_status !== "not_reported" ||
    (!source.needs_ocr && !source.supporting_information_urls?.length)
  )
    return extraction;
  return {
    ...extraction,
    ligand_exchange_status: "ambiguous",
    ligand_exchange_conditions: source.needs_ocr
      ? "The main article requires OCR, so the absence of ligand-exchange evidence could not be established."
      : "The main article was checked, but linked Supporting Information was not supplied; absence of a ligand-exchange method could not be established.",
  };
}

function rowWithLigandExchange(
  row: Record<string, string>,
  extraction: LigandExchangeExtraction,
): unknown[] {
  const values: Record<string, unknown> = {
    ...row,
    ligand_exchange_status: extraction.ligand_exchange_status,
    ligand_exchange_type: extraction.ligand_exchange_type,
    ligand_exchange_chemicals: extraction.ligand_exchange_chemicals,
    native_ligands: extraction.native_ligands,
    ligand_exchange_target: extraction.ligand_exchange_target,
    ligand_exchange_conditions: extraction.ligand_exchange_conditions,
    ligand_exchange_source_location: extraction.ligand_exchange_source_location,
  };
  return DEVICE_CSV_COLUMNS.map((column) => values[column] ?? "");
}

async function main() {
  const options = args();
  const root = process.cwd();
  const [papersText, devicesText, ...manifestTexts] = await Promise.all([
    readFile(path.join(root, "data/papers.csv"), "utf8"),
    readFile(path.join(root, "data/devices.csv"), "utf8"),
    ...options.manifests.map((manifest) =>
      readFile(path.resolve(root, manifest), "utf8"),
    ),
  ]);
  const papers = records(papersText).map(paperFrom);
  const deviceRows = records(devicesText);
  const sources = manifestTexts
    .flatMap((text) => (JSON.parse(text) as Manifest).papers)
    .filter((source) => !source.error && source.text_path);
  const results: ReviewResult[] = [];
  const extractions = new Map<string, LigandExchangeExtraction>();

  for (const paper of papers) {
    const sourceMatch = bestSource(paper, sources);
    const paperDeviceRows = deviceRows.filter(
      (device) => device.paper_id === paper.paper_id,
    );
    let sourceExtraction: LigandExchangeExtraction | null = null;
    if (sourceMatch) {
      const markedText = await readFile(sourceMatch.source.text_path!, "utf8");
      sourceExtraction = normalizeSourceLimitations(
        extractLigandExchange(
          splitMarkedPages(markedText),
          paperDeviceRows[0]?.technology_family === "perovskite"
            ? "perovskite"
            : "cqd",
        ),
        sourceMatch.source,
      );
    }

    const deviceResults = paperDeviceRows.map((device) => {
      const everyDeviceHasChemicalHint = paperDeviceRows.every((candidate) => {
        if (candidate.technology_family !== "cqd") return true;
        const hint = extractLigandExchange(
          [
            {
              page: 0,
              documentLabel: "Existing curated metadata",
              text: [
                candidate.material_composition,
                candidate.device_stack,
                candidate.device_notes,
              ].join(" "),
            },
          ],
          "cqd",
        );
        return Boolean(hint.ligand_exchange_chemicals);
      });
      const extraction =
        device.technology_family === "perovskite"
          ? extractLigandExchange([], "perovskite")
          : sourceExtraction
            ? everyDeviceHasChemicalHint
              ? narrowToDevice(sourceExtraction, device)
              : sourceExtraction
            : fallbackExtraction(device);
      extractions.set(device.device_id, extraction);
      return {
        deviceId: device.device_id,
        ligandExchange: {
          ligand_exchange_status: extraction.ligand_exchange_status,
          ligand_exchange_type: extraction.ligand_exchange_type,
          ligand_exchange_chemicals: extraction.ligand_exchange_chemicals,
          native_ligands: extraction.native_ligands,
          ligand_exchange_target: extraction.ligand_exchange_target,
          ligand_exchange_conditions: extraction.ligand_exchange_conditions,
          ligand_exchange_source_location:
            extraction.ligand_exchange_source_location,
        },
        evidence: extraction.evidence,
      };
    });
    results.push({
      paperId: paper.paper_id,
      title: paper.title,
      sourceAvailable: Boolean(sourceMatch),
      sourceFilename: sourceMatch?.source.filename ?? null,
      sourceSimilarity: sourceMatch
        ? Number(sourceMatch.similarity.toFixed(3))
        : null,
      devices: deviceResults,
    });
  }

  const statusCounts = Object.fromEntries(
    [
      "reported",
      "not_used",
      "not_reported",
      "not_applicable",
      "ambiguous",
      "source_unavailable",
      "not_checked",
    ].map((status) => [
      status,
      [...extractions.values()].filter(
        (extraction) => extraction.ligand_exchange_status === status,
      ).length,
    ]),
  );
  const inventory = {
    generatedAt: new Date().toISOString(),
    paperCount: papers.length,
    deviceCount: deviceRows.length,
    matchedSourcePapers: results.filter((result) => result.sourceAvailable)
      .length,
    sourceUnavailablePapers: results.filter((result) => !result.sourceAvailable)
      .length,
    statusCounts,
    papers: results,
  };
  const output = path.resolve(root, options.output);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  if (options.apply) {
    await writeFile(
      path.join(root, "data/devices.csv"),
      serializeCsv(
        DEVICE_CSV_COLUMNS,
        deviceRows.map((row) => {
          const extraction = extractions.get(row.device_id);
          if (!extraction)
            throw new Error(`No ligand extraction for ${row.device_id}`);
          return rowWithLigandExchange(row, extraction);
        }),
      ),
      "utf8",
    );
  }
  console.log(JSON.stringify({ ...inventory, papers: undefined }, null, 2));
}

await main();
