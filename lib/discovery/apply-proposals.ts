import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildAtlasFromCsvTexts, serializeAtlasData } from "../data/atlas.ts";
import { parseCsv, serializeCsv } from "../data/csv.ts";
import {
  DEVICE_CSV_COLUMNS,
  MEASUREMENT_CSV_COLUMNS,
  PAPER_CSV_COLUMNS,
} from "../data/parse.ts";
import type { Device, Measurement, Paper } from "../data/types.ts";
import { normalizeDoi } from "./normalize.ts";
import { readCandidateRegistry, writeCandidateRegistry } from "./pipeline.ts";
import {
  readProposalRegistry,
  writeProposalRegistry,
} from "./proposal-registry.ts";

function paperRow(paper: Paper): unknown[] {
  return [
    paper.paper_id,
    paper.title,
    paper.authors.join("|"),
    paper.first_author,
    paper.journal,
    paper.publication_year,
    paper.doi,
    paper.publication_url,
    paper.publication_type,
    paper.peer_reviewed,
    paper.notes,
  ];
}

function deviceRow(device: Device): unknown[] {
  return [
    device.device_id,
    device.paper_id,
    device.material_family,
    device.material_composition,
    device.device_architecture,
    device.device_stack,
    device.active_area_cm2,
    device.device_notes,
  ];
}

function measurementRow(measurement: Measurement): unknown[] {
  return [
    measurement.measurement_id,
    measurement.device_id,
    measurement.wavelength_nm,
    measurement.detectivity_jones,
    measurement.responsivity_a_w,
    measurement.responsivity_wavelength_nm,
    measurement.responsivity_bias_v,
    measurement.responsivity_temperature_k,
    measurement.responsivity_source_location,
    measurement.responsivity_extraction_method,
    measurement.eqe_percent,
    measurement.temperature_k,
    measurement.bias_v,
    measurement.measurement_frequency_hz,
    measurement.response_time_s,
    measurement.rise_time_s,
    measurement.fall_time_s,
    measurement.response_time_definition,
    measurement.response_time_wavelength_nm,
    measurement.response_time_bias_v,
    measurement.response_time_source_location,
    measurement.response_time_limit,
    measurement.response_time_extraction_method,
    measurement.bandwidth_hz,
    measurement.bandwidth_bias_v,
    measurement.bandwidth_source_location,
    measurement.bandwidth_limit,
    measurement.bandwidth_extraction_method,
    measurement.linear_dynamic_range_db,
    measurement.linear_dynamic_range_min,
    measurement.linear_dynamic_range_max,
    measurement.linear_dynamic_range_units,
    measurement.linear_dynamic_range_definition,
    measurement.linear_dynamic_range_source_location,
    measurement.linear_dynamic_range_extraction_method,
    measurement.extended_metrics_review_status,
    measurement.extended_metrics_review_date,
    measurement.extended_metrics_notes,
    measurement.noise_method,
    measurement.noise_instruments.join("|"),
    measurement.noise_instrument_details,
    measurement.noise_instrument_source,
    measurement.detectivity_extraction_method,
    measurement.source_location,
    measurement.curator_status,
    measurement.flag,
    measurement.amber_reasons.join("|"),
    measurement.amber_explanation,
    measurement.curator_notes,
    measurement.date_added,
    measurement.date_updated,
  ];
}

function rows(source: string): string[][] {
  return parseCsv(source).rows.map((row) => row.fields);
}

function rowsForColumns(
  source: string,
  columns: readonly string[],
): string[][] {
  const parsed = parseCsv(source);
  const sourceColumns = parsed.headers;
  const sourceIndexes = new Map(
    sourceColumns.map((column, index) => [column, index]),
  );
  return parsed.rows.map((row) =>
    columns.map((column) => {
      const index = sourceIndexes.get(column);
      return index == null ? "" : (row.fields[index] ?? "");
    }),
  );
}

export async function applyApprovedProposals(
  root: string,
  proposalIds: string[],
  options: { dryRun?: boolean; now?: Date } = {},
): Promise<{
  applied: string[];
  atlasCounts: { papers: number; devices: number; measurements: number };
}> {
  const dataDirectory = path.join(root, "data");
  const proposalFile = path.join(dataDirectory, "discovery/proposals.json");
  const candidateFile = path.join(dataDirectory, "discovery/candidates.json");
  const proposalRegistry = await readProposalRegistry(proposalFile);
  const candidateRegistry = await readCandidateRegistry(candidateFile);
  const selected = proposalRegistry.proposals.filter((proposal) =>
    proposalIds.includes(proposal.proposalId),
  );
  if (selected.length !== proposalIds.length)
    throw new Error("One or more proposal IDs were not found");
  for (const proposal of selected) {
    if (proposal.status !== "approved")
      throw new Error(
        `${proposal.proposalId}: proposal must be explicitly approved before application`,
      );
    if (
      proposal.scopeStatus !== "in-scope" ||
      proposal.proposedMeasurements.length === 0
    )
      throw new Error(
        `${proposal.proposalId}: proposal is not an applicable in-scope measurement set`,
      );
  }
  const [paperText, deviceText, measurementText] = await Promise.all([
    readFile(path.join(dataDirectory, "papers.csv"), "utf8"),
    readFile(path.join(dataDirectory, "devices.csv"), "utf8"),
    readFile(path.join(dataDirectory, "measurements.csv"), "utf8"),
  ]);
  const existingPaperRows = rows(paperText);
  const doiIndex = PAPER_CSV_COLUMNS.indexOf("doi");
  const existingDois = new Set(
    existingPaperRows.map((row) => normalizeDoi(row[doiIndex])).filter(Boolean),
  );
  for (const proposal of selected) {
    const doi = normalizeDoi(proposal.proposedPaper.doi);
    if (doi && existingDois.has(doi))
      throw new Error(
        `${proposal.proposalId}: DOI already exists in the published atlas`,
      );
    if (doi) existingDois.add(doi);
  }
  const reviewedMeasurements = selected.flatMap((proposal) =>
    proposal.proposedMeasurements.map((measurement) => ({
      ...measurement,
      curator_status: "reviewed" as const,
      date_updated: (options.now ?? new Date()).toISOString().slice(0, 10),
    })),
  );
  const nextTexts = {
    papers: serializeCsv(PAPER_CSV_COLUMNS, [
      ...existingPaperRows,
      ...selected.map((proposal) => paperRow(proposal.proposedPaper)),
    ]),
    devices: serializeCsv(DEVICE_CSV_COLUMNS, [
      ...rows(deviceText),
      ...selected.flatMap((proposal) =>
        proposal.proposedDevices.map(deviceRow),
      ),
    ]),
    measurements: serializeCsv(MEASUREMENT_CSV_COLUMNS, [
      ...rowsForColumns(measurementText, MEASUREMENT_CSV_COLUMNS),
      ...reviewedMeasurements.map(measurementRow),
    ]),
  };
  const atlas = buildAtlasFromCsvTexts(nextTexts);
  if (!options.dryRun) {
    await Promise.all([
      writeFile(
        path.join(dataDirectory, "papers.csv"),
        nextTexts.papers,
        "utf8",
      ),
      writeFile(
        path.join(dataDirectory, "devices.csv"),
        nextTexts.devices,
        "utf8",
      ),
      writeFile(
        path.join(dataDirectory, "measurements.csv"),
        nextTexts.measurements,
        "utf8",
      ),
      writeFile(
        path.join(dataDirectory, "generated/atlas.json"),
        serializeAtlasData(atlas),
        "utf8",
      ),
    ]);
    const appliedAt = (options.now ?? new Date()).toISOString();
    await writeProposalRegistry(proposalFile, {
      ...proposalRegistry,
      proposals: proposalRegistry.proposals.map((proposal) =>
        proposalIds.includes(proposal.proposalId)
          ? { ...proposal, status: "applied" as const, appliedAt }
          : proposal,
      ),
    });
    const candidateIds = new Set(
      selected.map((proposal) => proposal.candidateId),
    );
    await writeCandidateRegistry(candidateFile, {
      ...candidateRegistry,
      candidates: candidateRegistry.candidates.map((candidate) =>
        candidateIds.has(candidate.candidateId)
          ? { ...candidate, importStatus: "published" as const }
          : candidate,
      ),
    });
  }
  return {
    applied: proposalIds,
    atlasCounts: {
      papers: atlas.papers.length,
      devices: atlas.devices.length,
      measurements: atlas.measurements.length,
    },
  };
}
