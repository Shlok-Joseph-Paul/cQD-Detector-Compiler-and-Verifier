/** Dependency-free RFC 4180-style CSV parsing and serialization. */

export interface CsvRow {
  /** One-based physical line on which this logical row begins. */
  row_number: number;
  fields: string[];
}

export interface ParsedCsv {
  headers: string[];
  rows: CsvRow[];
}

export class CsvSyntaxError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(message: string, line: number, column: number) {
    super(`CSV syntax error at line ${line}, column ${column}: ${message}`);
    this.name = "CsvSyntaxError";
    this.line = line;
    this.column = column;
  }
}

/**
 * Parse CSV with quoted commas, escaped quotes, embedded newlines, CRLF input,
 * UTF-8 BOMs, and useful source locations. Completely blank lines are ignored.
 */
export function parseCsv(source: string): ParsedCsv {
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const rawRows: CsvRow[] = [];

  let fields: string[] = [];
  let field = "";
  let line = 1;
  let column = 1;
  let rowStartLine = 1;
  let inQuotedField = false;
  let closedQuotedField = false;
  let rowHasSyntax = false;

  const finishField = () => {
    fields.push(field);
    field = "";
    closedQuotedField = false;
  };

  const finishRow = () => {
    finishField();
    const isBlank = !rowHasSyntax && fields.length === 1 && fields[0] === "";
    if (!isBlank) {
      rawRows.push({ row_number: rowStartLine, fields });
    }
    fields = [];
    rowHasSyntax = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotedField) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
          column += 2;
          continue;
        }
        inQuotedField = false;
        closedQuotedField = true;
        column += 1;
        continue;
      }

      if (character === "\r" || character === "\n") {
        field += "\n";
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        line += 1;
        column = 1;
        continue;
      }

      field += character;
      column += 1;
      continue;
    }

    if (closedQuotedField) {
      if (character === " " || character === "\t") {
        column += 1;
        continue;
      }
      if (character !== "," && character !== "\r" && character !== "\n") {
        throw new CsvSyntaxError(
          "unexpected character after a closing quote",
          line,
          column,
        );
      }
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new CsvSyntaxError(
          "a quote may only begin an empty field",
          line,
          column,
        );
      }
      inQuotedField = true;
      rowHasSyntax = true;
      column += 1;
      continue;
    }

    if (character === ",") {
      finishField();
      rowHasSyntax = true;
      column += 1;
      continue;
    }

    if (character === "\r" || character === "\n") {
      finishRow();
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      line += 1;
      column = 1;
      rowStartLine = line;
      continue;
    }

    field += character;
    if (character !== " " && character !== "\t") rowHasSyntax = true;
    column += 1;
  }

  if (inQuotedField) {
    throw new CsvSyntaxError("unterminated quoted field", line, column);
  }

  if (
    field.length > 0 ||
    fields.length > 0 ||
    rowHasSyntax ||
    closedQuotedField
  ) {
    finishRow();
  }

  if (rawRows.length === 0) return { headers: [], rows: [] };

  const [headerRow, ...rows] = rawRows;
  return {
    headers: headerRow.fields.map((header) => header.trim()),
    rows,
  };
}

export function escapeCsvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text) || text.startsWith(" ") || text.endsWith(" ")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function serializeCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n")
    .concat("\n");
}
