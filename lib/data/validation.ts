import { amberReasonsToExplanation } from "./constants.ts";
import {
  AMBER_REASONS,
  CURATOR_STATUSES,
  DETECTIVITY_EXTRACTION_METHODS,
  FLAGS,
  NOISE_INSTRUMENTS,
  NOISE_METHODS,
  PUBLICATION_TYPES,
  type AmberReason,
  type AtlasEntities,
  type CsvSourceRows,
  type Measurement,
  type ValidationIssue,
  type ValidationResult,
} from "./types.ts";

const MIN_PUBLICATION_YEAR = 1900;
const MAX_PUBLICATION_YEAR = new Date().getUTCFullYear() + 1;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

type EntityName = "papers" | "devices" | "measurements";
type UnknownRecord = Record<string, unknown>;

export class DataValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(formatValidationIssues(issues));
    this.name = "DataValidationError";
    this.issues = [...issues];
  }
}

export function formatValidationIssue(problem: ValidationIssue): string {
  const location = [
    problem.entity,
    problem.row == null ? null : `row ${problem.row}`,
    `field "${problem.field}"`,
  ]
    .filter(Boolean)
    .join(", ");
  return `${location}: ${problem.message}`;
}

export function formatValidationIssues(
  issues: readonly ValidationIssue[],
): string {
  if (issues.length === 0) return "Data validation passed.";
  return `Data validation failed with ${issues.length} issue${
    issues.length === 1 ? "" : "s"
  }:\n${issues.map((problem) => `- ${formatValidationIssue(problem)}`).join("\n")}`;
}

function uniqueReasons(reasons: readonly AmberReason[]): AmberReason[] {
  return [...new Set(reasons)];
}

function isAmberReason(value: unknown): value is AmberReason {
  return (
    typeof value === "string" &&
    (AMBER_REASONS as readonly string[]).includes(value)
  );
}

/** Amber reasons that follow mechanically from the record and cannot be waived. */
export function deriveRequiredAmberReasons(
  measurement: Measurement,
): AmberReason[] {
  const reasons: AmberReason[] = [];
  const instruments = Array.isArray(measurement.noise_instruments)
    ? measurement.noise_instruments
    : [];

  if (measurement.noise_method === "shot_noise_approximation") {
    reasons.push("shot_noise_approximation");
  }

  if (instruments.length === 1 && instruments[0] === "lock_in_amplifier") {
    reasons.push("lock_in_only_noise_measurement");
  }

  if (instruments.includes("source_measure_unit")) {
    reasons.push("source_measure_unit_noise_measurement");
  }

  return uniqueReasons(reasons);
}

/**
 * Apply non-negotiable amber rules to an in-memory measurement. This is useful
 * for review tools; CSV validation remains strict so accidental green flags are
 * still surfaced to curators rather than silently hidden.
 */
export function applyAutomaticAmberRules(
  measurement: Measurement,
): Measurement {
  const requiredReasons = deriveRequiredAmberReasons(measurement);
  if (requiredReasons.length === 0) return { ...measurement };

  const amber_reasons = uniqueReasons([
    ...measurement.amber_reasons,
    ...requiredReasons,
  ]);
  return {
    ...measurement,
    flag: "amber",
    amber_reasons,
    amber_explanation:
      measurement.amber_explanation?.trim() ||
      amberReasonsToExplanation(amber_reasons),
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rowFor(
  entity: EntityName,
  record: UnknownRecord,
  sourceRows: CsvSourceRows,
): number | undefined {
  const idField =
    entity === "papers"
      ? "paper_id"
      : entity === "devices"
        ? "device_id"
        : "measurement_id";
  const id = record[idField];
  return typeof id === "string" ? sourceRows[entity]?.get(id) : undefined;
}

function validateIdentifier(
  value: unknown,
  add: (field: string, code: string, message: string, value?: unknown) => void,
  field: string,
): value is string {
  if (typeof value !== "string" || !value.trim()) {
    add(field, "required", "A non-empty identifier is required.", value);
    return false;
  }
  if (!IDENTIFIER_PATTERN.test(value)) {
    add(
      field,
      "invalid_identifier",
      "Use letters, numbers, dots, underscores, colons, or hyphens; do not use spaces.",
      value,
    );
    return false;
  }
  return true;
}

function validateRequiredString(
  value: unknown,
  field: string,
  add: (field: string, code: string, message: string, value?: unknown) => void,
): value is string {
  if (typeof value !== "string" || !value.trim()) {
    add(field, "required", "A non-empty string is required.", value);
    return false;
  }
  return true;
}

function validateNullableString(
  value: unknown,
  field: string,
  add: (field: string, code: string, message: string, value?: unknown) => void,
): void {
  if (value !== null && typeof value !== "string") {
    add(field, "invalid_type", "Expected text or null.", value);
  }
}

function validateNumber(
  value: unknown,
  field: string,
  add: (field: string, code: string, message: string, value?: unknown) => void,
  options: {
    nullable?: boolean;
    positive?: boolean;
    nonnegative?: boolean;
  } = {},
): void {
  if (value === null && options.nullable) return;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    add(field, "invalid_number", "Expected a finite number.", value);
    return;
  }
  if (options.positive && value <= 0) {
    add(field, "not_positive", "Value must be greater than zero.", value);
  }
  if (options.nonnegative && value < 0) {
    add(field, "negative", "Value cannot be negative.", value);
  }
}

function validateEnum(
  value: unknown,
  field: string,
  allowed: readonly string[],
  add: (field: string, code: string, message: string, value?: unknown) => void,
): void {
  if (typeof value !== "string" || !allowed.includes(value)) {
    add(
      field,
      "invalid_enum",
      `Expected one of: ${allowed.join(", ")}.`,
      value,
    );
  }
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}

function validatePaper(
  paper: UnknownRecord,
  add: (field: string, code: string, message: string, value?: unknown) => void,
): void {
  validateIdentifier(paper.paper_id, add, "paper_id");
  validateRequiredString(paper.title, "title", add);
  if (
    !Array.isArray(paper.authors) ||
    paper.authors.length === 0 ||
    paper.authors.some((author) => typeof author !== "string" || !author.trim())
  ) {
    add(
      "authors",
      "invalid_authors",
      "Provide a non-empty list of author names.",
    );
  }
  validateRequiredString(paper.first_author, "first_author", add);
  validateNullableString(paper.journal, "journal", add);
  if (
    typeof paper.publication_year !== "number" ||
    !Number.isInteger(paper.publication_year) ||
    paper.publication_year < MIN_PUBLICATION_YEAR ||
    paper.publication_year > MAX_PUBLICATION_YEAR
  ) {
    add(
      "publication_year",
      "implausible_year",
      `Publication year must be an integer from ${MIN_PUBLICATION_YEAR} through ${MAX_PUBLICATION_YEAR}.`,
      paper.publication_year,
    );
  }
  validateNullableString(paper.doi, "doi", add);
  validateNullableString(paper.publication_url, "publication_url", add);
  if (typeof paper.publication_url === "string") {
    try {
      const url = new URL(paper.publication_url);
      if (url.protocol !== "http:" && url.protocol !== "https:")
        throw new Error();
    } catch {
      add(
        "publication_url",
        "invalid_url",
        "Publication URL must be an absolute http(s) URL or null.",
        paper.publication_url,
      );
    }
  }
  validateEnum(
    paper.publication_type,
    "publication_type",
    PUBLICATION_TYPES,
    add,
  );
  if (typeof paper.peer_reviewed !== "boolean") {
    add(
      "peer_reviewed",
      "invalid_type",
      "Expected true or false.",
      paper.peer_reviewed,
    );
  }
  if (
    paper.publication_type === "journal_article" &&
    paper.peer_reviewed !== true
  ) {
    add(
      "peer_reviewed",
      "publication_mismatch",
      "A journal_article must be marked peer reviewed.",
      paper.peer_reviewed,
    );
  }
  if (
    (paper.publication_type === "preprint" ||
      paper.publication_type === "demonstration") &&
    paper.peer_reviewed !== false
  ) {
    add(
      "peer_reviewed",
      "publication_mismatch",
      `${String(paper.publication_type)} records cannot be marked peer reviewed.`,
      paper.peer_reviewed,
    );
  }
  validateNullableString(paper.notes, "notes", add);
}

function validateDevice(
  device: UnknownRecord,
  add: (field: string, code: string, message: string, value?: unknown) => void,
): void {
  validateIdentifier(device.device_id, add, "device_id");
  validateIdentifier(device.paper_id, add, "paper_id");
  validateRequiredString(device.material_family, "material_family", add);
  validateNullableString(
    device.material_composition,
    "material_composition",
    add,
  );
  validateNullableString(
    device.device_architecture,
    "device_architecture",
    add,
  );
  validateNullableString(device.device_stack, "device_stack", add);
  validateNumber(device.active_area_cm2, "active_area_cm2", add, {
    nullable: true,
    positive: true,
  });
  validateNullableString(device.device_notes, "device_notes", add);
}

function validateMeasurement(
  measurement: UnknownRecord,
  add: (field: string, code: string, message: string, value?: unknown) => void,
): void {
  validateIdentifier(measurement.measurement_id, add, "measurement_id");
  validateIdentifier(measurement.device_id, add, "device_id");
  validateNumber(measurement.wavelength_nm, "wavelength_nm", add, {
    positive: true,
  });
  validateNumber(measurement.detectivity_jones, "detectivity_jones", add, {
    positive: true,
  });
  validateNumber(measurement.responsivity_a_w, "responsivity_a_w", add, {
    nullable: true,
    nonnegative: true,
  });
  validateNumber(measurement.eqe_percent, "eqe_percent", add, {
    nullable: true,
    nonnegative: true,
  });
  validateNumber(measurement.temperature_k, "temperature_k", add, {
    nullable: true,
    positive: true,
  });
  validateNumber(measurement.bias_v, "bias_v", add, { nullable: true });
  validateNumber(
    measurement.measurement_frequency_hz,
    "measurement_frequency_hz",
    add,
    { nullable: true, positive: true },
  );
  validateNumber(measurement.response_time_s, "response_time_s", add, {
    nullable: true,
    positive: true,
  });
  validateNumber(measurement.bandwidth_hz, "bandwidth_hz", add, {
    nullable: true,
    positive: true,
  });
  validateEnum(measurement.noise_method, "noise_method", NOISE_METHODS, add);
  if (
    !Array.isArray(measurement.noise_instruments) ||
    measurement.noise_instruments.length === 0
  ) {
    add(
      "noise_instruments",
      "required",
      "Provide at least one noise-instrument classification.",
      measurement.noise_instruments,
    );
  } else {
    const instruments = measurement.noise_instruments;
    for (const instrument of instruments) {
      validateEnum(instrument, "noise_instruments", NOISE_INSTRUMENTS, add);
    }
    if (new Set(instruments).size !== instruments.length) {
      add(
        "noise_instruments",
        "duplicate_instrument",
        "Noise instruments must not contain duplicates.",
      );
    }
    if (
      instruments.length > 1 &&
      (instruments.includes("not_reported") ||
        instruments.includes("not_applicable"))
    ) {
      add(
        "noise_instruments",
        "exclusive_instrument_status",
        "Not reported and not applicable cannot be combined with an instrument.",
      );
    }
    if (
      measurement.noise_method === "shot_noise_approximation" &&
      (instruments.length !== 1 || instruments[0] !== "not_applicable")
    ) {
      add(
        "noise_instruments",
        "shot_noise_instrument_mismatch",
        "Shot-noise approximations must use not_applicable because total noise was not measured.",
      );
    }
    if (
      measurement.noise_method === "measured_noise" &&
      instruments.includes("not_applicable")
    ) {
      add(
        "noise_instruments",
        "measured_noise_instrument_mismatch",
        "Measured-noise records cannot use not_applicable.",
      );
    }
  }
  validateNullableString(
    measurement.noise_instrument_details,
    "noise_instrument_details",
    add,
  );
  validateNullableString(
    measurement.noise_instrument_source,
    "noise_instrument_source",
    add,
  );
  validateEnum(
    measurement.detectivity_extraction_method,
    "detectivity_extraction_method",
    DETECTIVITY_EXTRACTION_METHODS,
    add,
  );
  validateNullableString(measurement.source_location, "source_location", add);
  validateEnum(
    measurement.curator_status,
    "curator_status",
    CURATOR_STATUSES,
    add,
  );
  validateEnum(measurement.flag, "flag", FLAGS, add);
  if (!Array.isArray(measurement.amber_reasons)) {
    add(
      "amber_reasons",
      "invalid_type",
      "Expected a list of amber-reason keys.",
    );
  } else {
    const reasons = measurement.amber_reasons;
    for (const reason of reasons) {
      if (!isAmberReason(reason)) {
        add(
          "amber_reasons",
          "invalid_enum",
          `Unknown amber reason "${String(reason)}".`,
          reason,
        );
      }
    }
    if (new Set(reasons).size !== reasons.length) {
      add(
        "amber_reasons",
        "duplicate_reason",
        "Amber reasons must not contain duplicates.",
      );
    }
  }
  validateNullableString(
    measurement.amber_explanation,
    "amber_explanation",
    add,
  );
  validateNullableString(measurement.curator_notes, "curator_notes", add);
  if (!isIsoDate(measurement.date_added)) {
    add(
      "date_added",
      "invalid_date",
      "Use a real ISO date in YYYY-MM-DD format.",
      measurement.date_added,
    );
  }
  if (!isIsoDate(measurement.date_updated)) {
    add(
      "date_updated",
      "invalid_date",
      "Use a real ISO date in YYYY-MM-DD format.",
      measurement.date_updated,
    );
  }
  if (
    isIsoDate(measurement.date_added) &&
    isIsoDate(measurement.date_updated) &&
    measurement.date_updated < measurement.date_added
  ) {
    add(
      "date_updated",
      "date_order",
      "date_updated cannot be earlier than date_added.",
      measurement.date_updated,
    );
  }
}

function validateUniqueIds(
  records: readonly UnknownRecord[],
  entity: EntityName,
  idField: string,
  sourceRows: CsvSourceRows,
  issues: ValidationIssue[],
): void {
  const seen = new Set<string>();
  for (const record of records) {
    const id = record[idField];
    if (typeof id !== "string" || !id) continue;
    if (seen.has(id)) {
      issues.push({
        entity,
        row: rowFor(entity, record, sourceRows),
        field: idField,
        code: "duplicate_id",
        message: `Duplicate ${idField} "${id}". Identifiers must be unique.`,
        value: id,
      });
    }
    seen.add(id);
  }
}

export function validateAtlasEntities(
  input: unknown,
  sourceRows: CsvSourceRows = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return {
      valid: false,
      issues: [
        {
          entity: "atlas",
          field: "root",
          code: "invalid_type",
          message:
            "Expected an object containing papers, devices, and measurements.",
          value: input,
        },
      ],
    };
  }

  const entityRecords: Record<EntityName, UnknownRecord[]> = {
    papers: [],
    devices: [],
    measurements: [],
  };

  for (const entity of ["papers", "devices", "measurements"] as const) {
    const value = input[entity];
    if (!Array.isArray(value)) {
      issues.push({
        entity: "atlas",
        field: entity,
        code: "invalid_type",
        message: `Expected ${entity} to be an array.`,
        value,
      });
      continue;
    }
    value.forEach((record, index) => {
      if (!isRecord(record)) {
        issues.push({
          entity,
          row: index + 2,
          field: "row",
          code: "invalid_type",
          message: "Expected an object record.",
          value: record,
        });
      } else {
        entityRecords[entity].push(record);
      }
    });
  }

  for (const paper of entityRecords.papers) {
    const row = rowFor("papers", paper, sourceRows);
    const add = (
      field: string,
      code: string,
      message: string,
      value?: unknown,
    ) => issues.push({ entity: "papers", row, field, code, message, value });
    validatePaper(paper, add);
  }
  for (const device of entityRecords.devices) {
    const row = rowFor("devices", device, sourceRows);
    const add = (
      field: string,
      code: string,
      message: string,
      value?: unknown,
    ) => issues.push({ entity: "devices", row, field, code, message, value });
    validateDevice(device, add);
  }
  for (const measurement of entityRecords.measurements) {
    const row = rowFor("measurements", measurement, sourceRows);
    const add = (
      field: string,
      code: string,
      message: string,
      value?: unknown,
    ) =>
      issues.push({ entity: "measurements", row, field, code, message, value });
    validateMeasurement(measurement, add);
  }

  validateUniqueIds(
    entityRecords.papers,
    "papers",
    "paper_id",
    sourceRows,
    issues,
  );
  validateUniqueIds(
    entityRecords.devices,
    "devices",
    "device_id",
    sourceRows,
    issues,
  );
  validateUniqueIds(
    entityRecords.measurements,
    "measurements",
    "measurement_id",
    sourceRows,
    issues,
  );

  const papersById = new Map(
    entityRecords.papers
      .filter((paper) => typeof paper.paper_id === "string")
      .map((paper) => [paper.paper_id as string, paper]),
  );
  const devicesById = new Map(
    entityRecords.devices
      .filter((device) => typeof device.device_id === "string")
      .map((device) => [device.device_id as string, device]),
  );

  for (const device of entityRecords.devices) {
    if (
      typeof device.paper_id === "string" &&
      !papersById.has(device.paper_id)
    ) {
      issues.push({
        entity: "devices",
        row: rowFor("devices", device, sourceRows),
        field: "paper_id",
        code: "foreign_key",
        message: `No paper has paper_id "${device.paper_id}".`,
        value: device.paper_id,
      });
    }
  }

  for (const measurement of entityRecords.measurements) {
    const row = rowFor("measurements", measurement, sourceRows);
    const device =
      typeof measurement.device_id === "string"
        ? devicesById.get(measurement.device_id)
        : undefined;
    if (typeof measurement.device_id === "string" && !device) {
      issues.push({
        entity: "measurements",
        row,
        field: "device_id",
        code: "foreign_key",
        message: `No device has device_id "${measurement.device_id}".`,
        value: measurement.device_id,
      });
      continue;
    }

    const requiredReasons = deriveRequiredAmberReasons(
      measurement as unknown as Measurement,
    );
    const flag = measurement.flag;
    const reasons = Array.isArray(measurement.amber_reasons)
      ? measurement.amber_reasons.filter((reason): reason is AmberReason =>
          isAmberReason(reason),
        )
      : [];

    if (flag === "green" && requiredReasons.length > 0) {
      issues.push({
        entity: "measurements",
        row,
        field: "flag",
        code: "green_requirements",
        message: `Green criteria are not met; required amber reasons: ${requiredReasons.join(", ")}.`,
        value: flag,
      });
    }
    for (const requiredReason of requiredReasons) {
      if (!reasons.includes(requiredReason)) {
        issues.push({
          entity: "measurements",
          row,
          field: "amber_reasons",
          code: "missing_required_reason",
          message: `Add the automatically required reason "${requiredReason}".`,
          value: measurement.amber_reasons,
        });
      }
    }

    if (flag === "amber") {
      if (reasons.length === 0) {
        issues.push({
          entity: "measurements",
          row,
          field: "amber_reasons",
          code: "amber_reason_required",
          message: "Every amber record must include at least one reason.",
        });
      }
      if (
        typeof measurement.amber_explanation !== "string" ||
        !measurement.amber_explanation.trim()
      ) {
        issues.push({
          entity: "measurements",
          row,
          field: "amber_explanation",
          code: "amber_explanation_required",
          message:
            "Every amber record must include a human-readable explanation.",
          value: measurement.amber_explanation,
        });
      }
    }
    if (flag === "green") {
      if (reasons.length > 0) {
        issues.push({
          entity: "measurements",
          row,
          field: "amber_reasons",
          code: "green_has_amber_reasons",
          message: "A green record cannot contain amber reasons.",
          value: measurement.amber_reasons,
        });
      }
      if (measurement.amber_explanation !== null) {
        issues.push({
          entity: "measurements",
          row,
          field: "amber_explanation",
          code: "green_has_amber_explanation",
          message: "A green record must use a blank (null) amber explanation.",
          value: measurement.amber_explanation,
        });
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

/** Discoverable alias for callers treating the three entity arrays as one dataset. */
export function validateAtlasData(
  input: unknown,
  sourceRows: CsvSourceRows = {},
): ValidationResult {
  return validateAtlasEntities(input, sourceRows);
}

export function assertValidAtlasEntities(
  input: unknown,
  sourceRows: CsvSourceRows = {},
): asserts input is AtlasEntities {
  const result = validateAtlasEntities(input, sourceRows);
  if (!result.valid) throw new DataValidationError(result.issues);
}

export const assertValidAtlasData = assertValidAtlasEntities;
