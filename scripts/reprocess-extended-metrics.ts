import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { extractExtendedMetricCandidates } from "../lib/discovery/extended-metrics.ts";
import { fuzzyTitleSimilarity } from "../lib/discovery/normalize.ts";
import { splitMarkedPages } from "../lib/discovery/proposal-extractor.ts";
import { parseAtlasCsvTexts } from "../lib/data/parse.ts";
import type { Measurement } from "../lib/data/types.ts";

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

type ExtractedCandidates = ReturnType<typeof extractExtendedMetricCandidates>;

interface ReviewResult {
  paperId: string;
  title: string;
  deviceCount: number;
  measurementCount: number;
  reviewStatus: "source_unavailable" | "needs_review";
  sourceFile: string | null;
  sourceSimilarity: number | null;
  supportingInformationUrls: string[];
  supportingInformationFiles: string[];
  responsivity: ExtractedCandidates["responsivity"];
  temporal: ExtractedCandidates["temporal"];
  bandwidth: ExtractedCandidates["bandwidth"];
  ldr: ExtractedCandidates["ldr"];
  existing: {
    responsivity: string[];
    responseTime: string[];
    bandwidth: string[];
  };
  operatingConditionMatch: string;
  ambiguities: string[];
  proposedCorrections: string[];
}

const SI_PAPER_IDS: Record<string, string> = {
  am5c12011_si_001: "paul-2025-ag2se",
  nl2c00950_si_001: "yang-2022-hgte-ligand",
  nl4c02235_si_001: "wang-2024-hgte-top-imager",
  jp2c02044_si_001: "rastogi-2022-cdse-hgte-ag2te",
  ph4c00911_si_001: "yu-2024-hgte-sam",
  am3c12918_si_001: "wang-2023-pbs-oxidation",
  nn3c12007_si_001: "peng-2024-insb-inp",
  nn5c11108_si_001: "siddik-2025-inas-cmos",
  ja4c10755_si_001: "sheikh-2024-inas-znse",
  nn4c17257_si_001: "hu-2025-hgte-double-heterojunction",
  nl3c02306_si_001: "dang-2023-multiresonant-grating",
  "s41467-026-71335-w-si": "park-2026-internal-field",
  "advs74612-sup-0001-suppmat": "tran-2026-cd3p2-polarity",
  "s43246-024-00499-z-si": "song-2024-ag-hgte",
};

function sourceTitle(filename: string): string {
  return filename
    .replace(/\.pdf$/i, "")
    .replace(/^.+?\s+-\s+(?:19|20)\d{2}\s+-\s+/, "")
    .replace(/^.+?\s+-\s+/, "")
    .trim();
}

function displayNumber(value: number): string {
  if (Math.abs(value) >= 1e4 || (Math.abs(value) > 0 && Math.abs(value) < 1e-3))
    return value.toExponential(3);
  return String(Number(value.toPrecision(5)));
}

function evidenceCell(
  items: Array<{
    value: number;
    sourceLocation: string;
    wavelengthNm: number | null;
    biasV: number | null;
    evidence: string;
    limit?: string;
  }>,
  unit: string,
): string {
  if (!items.length)
    return "No direct-text candidate; visual/SI review pending";
  return items
    .slice(0, 4)
    .map((item) => {
      const conditions = [
        item.wavelengthNm == null ? null : `${item.wavelengthNm} nm`,
        item.biasV == null ? null : `${item.biasV} V`,
      ]
        .filter(Boolean)
        .join(", ");
      const prefix =
        item.limit === "lower_bound"
          ? ">"
          : item.limit === "upper_bound"
            ? "<"
            : "";
      return `${prefix}${displayNumber(item.value)} ${unit} (${item.sourceLocation}${
        conditions ? `; ${conditions}` : ""
      })`;
    })
    .join("<br>");
}

function temporalCell(
  items: Array<{
    value: number;
    sourceLocation: string;
    kind: string;
    definition: string;
  }>,
): string {
  if (!items.length)
    return "No direct-text candidate; visual/SI review pending";
  return items
    .slice(0, 6)
    .map(
      (item) =>
        `${item.kind}: ${displayNumber(item.value)} s (${item.definition}; ${item.sourceLocation})`,
    )
    .join("<br>");
}

function ldrCell(
  items: Array<{
    value: number;
    sourceLocation: string;
    units: string | null;
    minimum: number | null;
    maximum: number | null;
  }>,
): string {
  if (!items.length)
    return "No direct-text candidate; visual/SI review pending";
  return items
    .slice(0, 4)
    .map((item) =>
      item.units === "dB"
        ? `${displayNumber(item.value)} dB (${item.sourceLocation})`
        : `${displayNumber(item.minimum ?? item.value)}-${displayNumber(
            item.maximum ?? item.value,
          )} ${item.units ?? "reported units"} (${item.sourceLocation})`,
    )
    .join("<br>");
}

function existingValues(measurements: Measurement[], field: keyof Measurement) {
  return [
    ...new Set(
      measurements
        .map((measurement) => measurement[field])
        .filter((value): value is number => typeof value === "number")
        .map(displayNumber),
    ),
  ];
}

async function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath)
    throw new Error(
      "Usage: reprocess-extended-metrics.ts MAIN_MANIFEST [SI_MANIFEST] [OUTPUT_DIR]",
    );
  const siManifestPath = process.argv[3];
  const root = process.cwd();
  const outputDirectory = path.resolve(
    root,
    process.argv[4] ?? "data/reprocessing",
  );
  const [papersCsv, devicesCsv, measurementsCsv, manifestText, siManifestText] =
    await Promise.all([
      readFile(path.join(root, "data/papers.csv"), "utf8"),
      readFile(path.join(root, "data/devices.csv"), "utf8"),
      readFile(path.join(root, "data/measurements.csv"), "utf8"),
      readFile(path.resolve(manifestPath), "utf8"),
      siManifestPath
        ? readFile(path.resolve(siManifestPath), "utf8")
        : Promise.resolve('{"papers":[]}'),
    ]);
  const atlas = parseAtlasCsvTexts({
    papers: papersCsv,
    devices: devicesCsv,
    measurements: measurementsCsv,
  });
  if (atlas.issues.length)
    throw new Error(
      `Atlas CSV parsing failed with ${atlas.issues.length} issue(s).`,
    );
  const manifest = JSON.parse(manifestText) as Manifest;
  const siManifest = JSON.parse(siManifestText) as Manifest;
  const siSourcesByPaperId = new Map<string, ManifestPaper[]>();
  const unmatchedSiFiles = new Set(
    siManifest.papers.map((paper) => paper.filename),
  );
  for (const source of siManifest.papers) {
    const stem = source.filename.replace(/\.pdf$/i, "");
    const paperId = SI_PAPER_IDS[stem];
    if (!paperId) continue;
    siSourcesByPaperId.set(paperId, [
      ...(siSourcesByPaperId.get(paperId) ?? []),
      source,
    ]);
    unmatchedSiFiles.delete(source.filename);
  }
  const unmatchedFiles = new Set(
    manifest.papers.map((paper) => paper.filename),
  );
  const results: ReviewResult[] = [];

  for (const paper of atlas.papers) {
    const ranked = manifest.papers
      .filter((source) => !source.error && source.text_path)
      .map((source) => ({
        source,
        similarity: fuzzyTitleSimilarity(
          paper.title,
          sourceTitle(source.filename),
        ),
      }))
      .sort((left, right) => right.similarity - left.similarity);
    const match = ranked[0] && ranked[0].similarity >= 0.72 ? ranked[0] : null;
    const paperDevices = atlas.devices.filter(
      (device) => device.paper_id === paper.paper_id,
    );
    const deviceIds = new Set(paperDevices.map((device) => device.device_id));
    const paperMeasurements = atlas.measurements.filter((measurement) =>
      deviceIds.has(measurement.device_id),
    );
    const siSources = (siSourcesByPaperId.get(paper.paper_id) ?? []).filter(
      (source) => !source.error && source.text_path,
    );
    const siPages = (
      await Promise.all(
        siSources.map(async (source) =>
          splitMarkedPages(
            await readFile(source.text_path!, "utf8"),
            "Supporting Information",
          ),
        ),
      )
    ).flat();
    if (!match) {
      const candidates = extractExtendedMetricCandidates(siPages);
      results.push({
        paperId: paper.paper_id,
        title: paper.title,
        deviceCount: paperDevices.length,
        measurementCount: paperMeasurements.length,
        reviewStatus: "source_unavailable",
        sourceFile: null,
        sourceSimilarity: null,
        supportingInformationUrls: [],
        supportingInformationFiles: siSources.map((source) => source.pdf_path),
        responsivity: candidates.responsivity,
        temporal: candidates.temporal,
        bandwidth: candidates.bandwidth,
        ldr: candidates.ldr,
        existing: {
          responsivity: existingValues(paperMeasurements, "responsivity_a_w"),
          responseTime: existingValues(paperMeasurements, "response_time_s"),
          bandwidth: existingValues(paperMeasurements, "bandwidth_hz"),
        },
        operatingConditionMatch: "not_assessed",
        ambiguities: [
          "No confidently matched local main-article PDF was available.",
          ...(siSources.length
            ? [
                "Supporting Information was checked, but its candidates cannot substitute for a missing main article.",
              ]
            : []),
        ],
        proposedCorrections: [],
      });
      continue;
    }
    unmatchedFiles.delete(match.source.filename);
    const markedText = await readFile(match.source.text_path!, "utf8");
    const candidates = extractExtendedMetricCandidates([
      ...splitMarkedPages(markedText),
      ...siPages,
    ]);
    const hasConditions = [
      ...candidates.responsivity,
      ...candidates.temporal,
      ...candidates.bandwidth,
      ...candidates.ldr,
    ].some(
      (candidate) => candidate.wavelengthNm != null || candidate.biasV != null,
    );
    results.push({
      paperId: paper.paper_id,
      title: paper.title,
      deviceCount: paperDevices.length,
      measurementCount: paperMeasurements.length,
      reviewStatus: "needs_review",
      sourceFile: match.source.pdf_path,
      sourceSimilarity: Number(match.similarity.toFixed(3)),
      supportingInformationUrls: match.source.supporting_information_urls ?? [],
      supportingInformationFiles: siSources.map((source) => source.pdf_path),
      responsivity: candidates.responsivity,
      temporal: candidates.temporal,
      bandwidth: candidates.bandwidth,
      ldr: candidates.ldr,
      existing: {
        responsivity: existingValues(paperMeasurements, "responsivity_a_w"),
        responseTime: existingValues(paperMeasurements, "response_time_s"),
        bandwidth: existingValues(paperMeasurements, "bandwidth_hz"),
      },
      operatingConditionMatch: hasConditions
        ? "candidate_conditions_recorded; curator must confirm the device assignment"
        : "device-level only; operating-condition match not established",
      ambiguities: [
        "Automated direct-text scan completed; figure and Supporting Information review is still pending.",
        ...(paperDevices.length > 1
          ? [
              "The paper contains multiple atlas devices; candidate-to-device assignment requires manual review.",
            ]
          : []),
        ...((match.source.supporting_information_urls?.length ?? 0) > 0 &&
        siSources.length === 0
          ? [
              "Supporting Information links were detected but are not represented unless separately supplied in the batch.",
            ]
          : []),
      ],
      proposedCorrections: [],
    });
  }

  const reported = (key: "responsivity" | "temporal" | "bandwidth" | "ldr") =>
    results.filter((result) => result[key].length > 0).length;
  const available = results.filter(
    (result) => result.reviewStatus !== "source_unavailable",
  ).length;
  const summary = {
    generatedAt: new Date().toISOString(),
    paperCount: results.length,
    deviceCount: atlas.devices.length,
    measurementCount: atlas.measurements.length,
    locallyAvailablePapers: available,
    sourceUnavailablePapers: results.length - available,
    needsReviewPapers: results.filter(
      (result) => result.reviewStatus === "needs_review",
    ).length,
    responsivityReportedPapers: reported("responsivity"),
    temporalResponseReportedPapers: reported("temporal"),
    riseTimeReportedPapers: results.filter((result) =>
      result.temporal.some((item) => item.kind === "rise"),
    ).length,
    fallTimeReportedPapers: results.filter((result) =>
      result.temporal.some((item) => item.kind === "fall"),
    ).length,
    explicit3dBBandwidthReportedPapers: reported("bandwidth"),
    ldrReportedPapers: reported("ldr"),
    directlyReportedCandidates: results.reduce(
      (count, result) =>
        count +
        result.responsivity.length +
        result.temporal.length +
        result.bandwidth.length +
        result.ldr.length,
      0,
    ),
    graphicallyExtractedCandidates: 0,
    unmatchedBatchFiles: [...unmatchedFiles],
    supportingInformationFilesChecked: siManifest.papers.length,
    unmatchedSupportingInformationFiles: [...unmatchedSiFiles],
  };
  const markdown = [
    "# Extended metrics machine-candidate inventory",
    "",
    `Generated ${summary.generatedAt}. These are unfiltered machine candidates, not curator-approved values; no production dataset rows were changed.`,
    "",
    "## Consolidated summary",
    "",
    `- Papers / devices / measurements: ${summary.paperCount} / ${summary.deviceCount} / ${summary.measurementCount}`,
    `- Local main-article PDFs matched: ${summary.locallyAvailablePapers}; source unavailable: ${summary.sourceUnavailablePapers}`,
    `- Supporting Information PDFs checked: ${summary.supportingInformationFilesChecked}`,
    `- Responsivity candidates: ${summary.responsivityReportedPapers} papers`,
    `- Temporal-response candidates: ${summary.temporalResponseReportedPapers} papers (rise: ${summary.riseTimeReportedPapers}; fall: ${summary.fallTimeReportedPapers})`,
    `- Explicit -3 dB bandwidth candidates: ${summary.explicit3dBBandwidthReportedPapers} papers`,
    `- LDR candidates: ${summary.ldrReportedPapers} papers`,
    `- Direct-text candidates: ${summary.directlyReportedCandidates}; graphical extractions: ${summary.graphicallyExtractedCandidates}`,
    `- All available-paper results remain review-pending until a curator confirms figure/SI coverage and device/condition assignment`,
    "",
    "## Paper-by-paper candidate inventory",
    "",
    "| Paper | Devices | Status | Responsivity | Temporal response | Explicit -3 dB BW | LDR | Matching / ambiguity |",
    "|---|---:|---|---|---|---|---|---|",
    ...results.map((result) => {
      const ambiguity = [result.operatingConditionMatch, ...result.ambiguities]
        .filter(Boolean)
        .join(" ");
      return `| ${result.title.replaceAll("|", "\\|")} | ${result.deviceCount} | ${result.reviewStatus} | ${evidenceCell(
        result.responsivity,
        "A/W",
      )} | ${temporalCell(result.temporal)} | ${evidenceCell(
        result.bandwidth,
        "Hz",
      )} | ${ldrCell(result.ldr)} | ${ambiguity.replaceAll("|", "\\|")} |`;
    }),
    "",
    "## Interpretation",
    "",
    "Candidate values are machine-extracted from full text and retain exact PDF page locations. They remain unapproved. Figures, ambiguous device assignments, and Supporting Information not supplied in the batch require curator review before any CSV update.",
  ].join("\n");

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outputDirectory, "extended-metrics-candidate-inventory.json"),
      `${JSON.stringify({ summary, papers: results }, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      path.join(outputDirectory, "EXTENDED_METRICS_CANDIDATES.md"),
      `${markdown}\n`,
      "utf8",
    ),
  ]);
  console.log(JSON.stringify(summary, null, 2));
}

await main();
