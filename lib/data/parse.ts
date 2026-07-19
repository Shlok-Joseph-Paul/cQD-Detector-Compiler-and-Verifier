import { parseCsv, CsvSyntaxError, type ParsedCsv } from "./csv.ts";
import {
  AMBER_REASONS,
  CURATOR_STATUSES,
  DETECTIVITY_EXTRACTION_METHODS,
  FLAGS,
  NOISE_METHODS,
  PUBLICATION_TYPES,
  type AmberReason,
  type AtlasEntities,
  type CsvSourceRows,
  type CsvTexts,
  type Device,
  type Measurement,
  type Paper,
  type ValidationIssue,
} from "./types.ts";

export const PAPER_CSV_COLUMNS = [
  "paper_id",
  "title",
  "authors",
  "first_author",
  "journal",
  "publication_year",
  "doi",
  "publication_url",
  "publication_type",
  "peer_reviewed",
  "notes",
] as const;

export const DEVICE_CSV_COLUMNS = [
  "device_id",
  "paper_id",
  "material_family",
  "material_composition",
  "device_architecture",
  "device_stack",
  "active_area_cm2",
  "device_notes",
] as const;

export const MEASUREMENT_CSV_COLUMNS = [
  "measurement_id",
  "device_id",
  "wavelength_nm",
  "detectivity_jones",
  "responsivity_a_w",
  "eqe_percent",
  "temperature_k",
  "bias_v",
  "measurement_frequency_hz",
  "response_time_s",
  "bandwidth_hz",
  "noise_method",
  "detectivity_extraction_method",
  "source_location",
  "curator_status",
  "flag",
  "amber_reasons",
  "amber_explanation",
  "curator_notes",
  "date_added",
  "date_updated",
] as const;

type EntityName = "papers" | "devices" | "measurements";

interface PreparedRow {
  rowNumber: number;
  values: Record<string, string>;
}

interface ParsedEntity<T> {
  records: T[];
  rowsById: Map<string, number>;
  issues: ValidationIssue[];
}

export interface ParsedAtlasCsv extends AtlasEntities {
  sourceRows: CsvSourceRows;
  issues: ValidationIssue[];
}

function issue(
  entity: EntityName | "csv",
  row: number | undefined,
  field: string,
  code: string,
  message: string,
  value?: unknown,
): ValidationIssue {
  return { entity, row, field, code, message, value };
}

function prepareRows(
  source: string,
  entity: EntityName,
  expectedColumns: readonly string[],
): { rows: PreparedRow[]; issues: ValidationIssue[] } {
  let table: ParsedCsv;
  try {
    table = parseCsv(source);
  } catch (error) {
    if (error instanceof CsvSyntaxError) {
      return {
        rows: [],
        issues: [issue("csv", error.line, entity, "csv_syntax", error.message)],
      };
    }
    throw error;
  }

  const issues: ValidationIssue[] = [];
  if (table.headers.length === 0) {
    issues.push(
      issue(
        entity,
        1,
        "header",
        "missing_header",
        "CSV file has no header row.",
      ),
    );
    return { rows: [], issues };
  }

  const seenHeaders = new Set<string>();
  for (const header of table.headers) {
    if (!header) {
      issues.push(
        issue(
          entity,
          1,
          "header",
          "blank_header",
          "CSV headers cannot be blank.",
        ),
      );
    } else if (seenHeaders.has(header)) {
      issues.push(
        issue(
          entity,
          1,
          header,
          "duplicate_header",
          `CSV header "${header}" appears more than once.`,
        ),
      );
    }
    seenHeaders.add(header);
  }

  for (const column of expectedColumns) {
    if (!seenHeaders.has(column)) {
      issues.push(
        issue(
          entity,
          1,
          column,
          "missing_column",
          `Required column "${column}" is missing.`,
        ),
      );
    }
  }
  for (const header of table.headers) {
    if (header && !expectedColumns.includes(header)) {
      issues.push(
        issue(
          entity,
          1,
          header,
          "unknown_column",
          `Unknown column "${header}". Add it to the schema or remove it.`,
        ),
      );
    }
  }

  if (issues.length > 0) return { rows: [], issues };

  const rows: PreparedRow[] = [];
  for (const row of table.rows) {
    if (row.fields.length !== table.headers.length) {
      issues.push(
        issue(
          entity,
          row.row_number,
          "row",
          "column_count",
          `Expected ${table.headers.length} columns but found ${row.fields.length}.`,
        ),
      );
      continue;
    }

    rows.push({
      rowNumber: row.row_number,
      values: Object.fromEntries(
        table.headers.map((header, index) => [
          header,
          row.fields[index].trim(),
        ]),
      ),
    });
  }

  return { rows, issues };
}

class RowReader {
  readonly issues: ValidationIssue[] = [];
  private readonly entity: EntityName;
  private readonly row: PreparedRow;

  constructor(entity: EntityName, row: PreparedRow) {
    this.entity = entity;
    this.row = row;
  }

  requiredString(field: string): string {
    const value = this.row.values[field] ?? "";
    if (!value) {
      this.issues.push(
        issue(
          this.entity,
          this.row.rowNumber,
          field,
          "required",
          "A value is required.",
          value,
        ),
      );
    }
    return value;
  }

  nullableString(field: string): string | null {
    return this.row.values[field] || null;
  }

  requiredNumber(field: string): number {
    const raw = this.requiredString(field);
    const value = Number(raw);
    if (raw && !Number.isFinite(value)) {
      this.issues.push(
        issue(
          this.entity,
          this.row.rowNumber,
          field,
          "invalid_number",
          `Expected a finite number, received "${raw}".`,
          raw,
        ),
      );
    }
    return value;
  }

  nullableNumber(field: string): number | null {
    const raw = this.row.values[field] ?? "";
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      this.issues.push(
        issue(
          this.entity,
          this.row.rowNumber,
          field,
          "invalid_number",
          `Expected a finite number or a blank cell, received "${raw}".`,
          raw,
        ),
      );
    }
    return value;
  }

  boolean(field: string): boolean {
    const raw = this.requiredString(field).toLowerCase();
    if (["true", "1", "yes"].includes(raw)) return true;
    if (["false", "0", "no"].includes(raw)) return false;
    if (raw) {
      this.issues.push(
        issue(
          this.entity,
          this.row.rowNumber,
          field,
          "invalid_boolean",
          `Use true or false, received "${raw}".`,
          raw,
        ),
      );
    }
    return false;
  }

  oneOf<const T extends readonly string[]>(
    field: string,
    allowed: T,
  ): T[number] {
    const raw = this.requiredString(field);
    if (raw && !allowed.includes(raw)) {
      this.issues.push(
        issue(
          this.entity,
          this.row.rowNumber,
          field,
          "invalid_enum",
          `Expected one of ${allowed.join(", ")}; received "${raw}".`,
          raw,
        ),
      );
    }
    return raw as T[number];
  }

  list<const T extends readonly string[]>(
    field: string,
    allowed?: T,
  ): (T extends readonly string[] ? T[number] : string)[] {
    const raw = this.row.values[field] ?? "";
    if (!raw) return [];
    const values = raw.split("|").map((value) => value.trim());
    if (values.some((value) => value.length === 0)) {
      this.issues.push(
        issue(
          this.entity,
          this.row.rowNumber,
          field,
          "blank_list_item",
          "Pipe-separated lists cannot contain blank items.",
          raw,
        ),
      );
    }
    if (allowed) {
      for (const value of values) {
        if (!allowed.includes(value)) {
          this.issues.push(
            issue(
              this.entity,
              this.row.rowNumber,
              field,
              "invalid_enum",
              `Unknown value "${value}"; expected one of ${allowed.join(", ")}.`,
              value,
            ),
          );
        }
      }
    }
    return values as (T extends readonly string[] ? T[number] : string)[];
  }
}

function parsePapers(source: string): ParsedEntity<Paper> {
  const prepared = prepareRows(source, "papers", PAPER_CSV_COLUMNS);
  const records: Paper[] = [];
  const rowsById = new Map<string, number>();

  for (const row of prepared.rows) {
    const read = new RowReader("papers", row);
    const paper: Paper = {
      paper_id: read.requiredString("paper_id"),
      title: read.requiredString("title"),
      authors: read.list("authors") as string[],
      first_author: read.requiredString("first_author"),
      journal: read.nullableString("journal"),
      publication_year: read.requiredNumber("publication_year"),
      doi: read.nullableString("doi"),
      publication_url: read.nullableString("publication_url"),
      publication_type: read.oneOf("publication_type", PUBLICATION_TYPES),
      peer_reviewed: read.boolean("peer_reviewed"),
      notes: read.nullableString("notes"),
    };
    if (paper.authors.length === 0) {
      read.issues.push(
        issue(
          "papers",
          row.rowNumber,
          "authors",
          "required",
          "Provide at least one author; separate multiple authors with |.",
        ),
      );
    }
    prepared.issues.push(...read.issues);
    if (read.issues.length === 0) {
      records.push(paper);
      if (rowsById.has(paper.paper_id)) {
        prepared.issues.push(
          issue(
            "papers",
            row.rowNumber,
            "paper_id",
            "duplicate_id",
            `Duplicate paper_id "${paper.paper_id}". Identifiers must be unique.`,
            paper.paper_id,
          ),
        );
      } else {
        rowsById.set(paper.paper_id, row.rowNumber);
      }
    }
  }

  return { records, rowsById, issues: prepared.issues };
}

function parseDevices(source: string): ParsedEntity<Device> {
  const prepared = prepareRows(source, "devices", DEVICE_CSV_COLUMNS);
  const records: Device[] = [];
  const rowsById = new Map<string, number>();

  for (const row of prepared.rows) {
    const read = new RowReader("devices", row);
    const device: Device = {
      device_id: read.requiredString("device_id"),
      paper_id: read.requiredString("paper_id"),
      material_family: read.requiredString("material_family"),
      material_composition: read.nullableString("material_composition"),
      device_architecture: read.nullableString("device_architecture"),
      device_stack: read.nullableString("device_stack"),
      active_area_cm2: read.nullableNumber("active_area_cm2"),
      device_notes: read.nullableString("device_notes"),
    };
    prepared.issues.push(...read.issues);
    if (read.issues.length === 0) {
      records.push(device);
      if (rowsById.has(device.device_id)) {
        prepared.issues.push(
          issue(
            "devices",
            row.rowNumber,
            "device_id",
            "duplicate_id",
            `Duplicate device_id "${device.device_id}". Identifiers must be unique.`,
            device.device_id,
          ),
        );
      } else {
        rowsById.set(device.device_id, row.rowNumber);
      }
    }
  }

  return { records, rowsById, issues: prepared.issues };
}

function parseMeasurements(source: string): ParsedEntity<Measurement> {
  const prepared = prepareRows(source, "measurements", MEASUREMENT_CSV_COLUMNS);
  const records: Measurement[] = [];
  const rowsById = new Map<string, number>();

  for (const row of prepared.rows) {
    const read = new RowReader("measurements", row);
    const measurement: Measurement = {
      measurement_id: read.requiredString("measurement_id"),
      device_id: read.requiredString("device_id"),
      wavelength_nm: read.requiredNumber("wavelength_nm"),
      detectivity_jones: read.requiredNumber("detectivity_jones"),
      responsivity_a_w: read.nullableNumber("responsivity_a_w"),
      eqe_percent: read.nullableNumber("eqe_percent"),
      temperature_k: read.nullableNumber("temperature_k"),
      bias_v: read.nullableNumber("bias_v"),
      measurement_frequency_hz: read.nullableNumber("measurement_frequency_hz"),
      response_time_s: read.nullableNumber("response_time_s"),
      bandwidth_hz: read.nullableNumber("bandwidth_hz"),
      noise_method: read.oneOf("noise_method", NOISE_METHODS),
      detectivity_extraction_method: read.oneOf(
        "detectivity_extraction_method",
        DETECTIVITY_EXTRACTION_METHODS,
      ),
      source_location: read.nullableString("source_location"),
      curator_status: read.oneOf("curator_status", CURATOR_STATUSES),
      flag: read.oneOf("flag", FLAGS),
      amber_reasons: read.list("amber_reasons", AMBER_REASONS) as AmberReason[],
      amber_explanation: read.nullableString("amber_explanation"),
      curator_notes: read.nullableString("curator_notes"),
      date_added: read.requiredString("date_added"),
      date_updated: read.requiredString("date_updated"),
    };
    prepared.issues.push(...read.issues);
    if (read.issues.length === 0) {
      records.push(measurement);
      if (rowsById.has(measurement.measurement_id)) {
        prepared.issues.push(
          issue(
            "measurements",
            row.rowNumber,
            "measurement_id",
            "duplicate_id",
            `Duplicate measurement_id "${measurement.measurement_id}". Identifiers must be unique.`,
            measurement.measurement_id,
          ),
        );
      } else {
        rowsById.set(measurement.measurement_id, row.rowNumber);
      }
    }
  }

  return { records, rowsById, issues: prepared.issues };
}

export function parseAtlasCsvTexts(texts: CsvTexts): ParsedAtlasCsv {
  const papers = parsePapers(texts.papers);
  const devices = parseDevices(texts.devices);
  const measurements = parseMeasurements(texts.measurements);

  return {
    papers: papers.records,
    devices: devices.records,
    measurements: measurements.records,
    sourceRows: {
      papers: papers.rowsById,
      devices: devices.rowsById,
      measurements: measurements.rowsById,
    },
    issues: [...papers.issues, ...devices.issues, ...measurements.issues],
  };
}
