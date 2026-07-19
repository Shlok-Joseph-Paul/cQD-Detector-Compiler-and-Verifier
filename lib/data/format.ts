export const MISSING_VALUE_LABEL = "Not reported" as const;

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "-": "⁻",
  "+": "⁺",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

export function formatMissingValue<T>(
  value: T | null | undefined,
  formatter: (present: T) => string = String,
): string {
  return value == null ? MISSING_VALUE_LABEL : formatter(value);
}

export function superscriptInteger(value: number): string {
  return String(value)
    .split("")
    .map((character) => SUPERSCRIPT_DIGITS[character] ?? character)
    .join("");
}

export function formatScientificNotation(
  value: number | null | undefined,
  significantDigits = 3,
): string {
  if (value == null) return MISSING_VALUE_LABEL;
  if (!Number.isFinite(value)) return MISSING_VALUE_LABEL;
  if (value === 0) return "0";
  const safeDigits = Math.min(15, Math.max(1, Math.trunc(significantDigits)));
  const [coefficient, exponentText] = value
    .toExponential(safeDigits - 1)
    .split("e");
  const exponent = Number(exponentText);
  return `${coefficient} × 10${superscriptInteger(exponent)}`;
}

export function formatNumberWithUnit(
  value: number | null | undefined,
  unit: string,
  maximumFractionDigits = 3,
): string {
  return formatMissingValue(value, (present) =>
    `${present.toLocaleString(undefined, { maximumFractionDigits })} ${unit}`.trim(),
  );
}
