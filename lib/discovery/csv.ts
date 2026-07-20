import type { CandidateRegistry, DiscoveryCandidate } from "./types.ts";

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const SCREENING_CSV_COLUMNS = [
  "candidate_id",
  "doi",
  "title",
  "publication_year",
  "journal",
  "materials",
  "device_type",
  "spectral_regions",
  "relevance_score",
  "relevance_reasons",
  "duplicate_warnings",
  "screening_status",
  "exclusion_reason",
  "screening_notes",
  "pdf_status",
  "import_status",
] as const;

export function exportScreeningCsv(
  candidates: readonly DiscoveryCandidate[],
): string {
  const rows = candidates.map((candidate) => [
    candidate.candidateId,
    candidate.doi,
    candidate.title,
    candidate.publicationYear,
    candidate.journal,
    candidate.candidateMaterialClasses.join("|"),
    candidate.candidateDeviceType,
    candidate.candidateSpectralRegions.join("|"),
    candidate.relevanceScore,
    candidate.relevanceReasons.join("|"),
    candidate.duplicateRelationships
      .map((item) => `${item.type}:${item.candidateId}`)
      .join("|"),
    candidate.screeningStatus,
    candidate.exclusionReason,
    candidate.screeningNotes,
    candidate.pdfStatus,
    candidate.importStatus,
  ]);
  return (
    [
      SCREENING_CSV_COLUMNS.join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\n") + "\n"
  );
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") value += char;
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

export function importScreeningCsv(
  registry: CandidateRegistry,
  text: string,
): CandidateRegistry {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error("Screening CSV is empty");
  const indexes = new Map(header.map((column, index) => [column, index]));
  const required = [
    "candidate_id",
    "screening_status",
    "pdf_status",
    "import_status",
  ];
  for (const column of required)
    if (!indexes.has(column)) throw new Error(`Missing CSV column: ${column}`);
  const decisions = new Map(
    rows.map((row) => [row[indexes.get("candidate_id")!], row]),
  );
  return {
    ...registry,
    candidates: registry.candidates.map((candidate) => {
      const row = decisions.get(candidate.candidateId);
      if (!row) return candidate;
      return {
        ...candidate,
        screeningStatus: row[
          indexes.get("screening_status")!
        ] as DiscoveryCandidate["screeningStatus"],
        exclusionReason: row[indexes.get("exclusion_reason")!] || null,
        screeningNotes: row[indexes.get("screening_notes")!] || null,
        pdfStatus: row[
          indexes.get("pdf_status")!
        ] as DiscoveryCandidate["pdfStatus"],
        importStatus: row[
          indexes.get("import_status")!
        ] as DiscoveryCandidate["importStatus"],
      };
    }),
  };
}
