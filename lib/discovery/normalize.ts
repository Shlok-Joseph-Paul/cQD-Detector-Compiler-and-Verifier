export function normalizeDoi(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .replace(/^doi\s*:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  return normalized || null;
}

export function normalizeTitle(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function reconstructOpenAlexAbstract(
  index: Record<string, number[]> | null | undefined,
): string | null {
  if (!index || typeof index !== "object") return null;
  const words: Array<[number, string]> = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions) {
      if (Number.isInteger(position) && position >= 0)
        words.push([position, word]);
    }
  }
  if (words.length === 0) return null;
  return words
    .sort((a, b) => a[0] - b[0])
    .map((entry) => entry[1])
    .join(" ");
}

function trigrams(value: string): Set<string> {
  const padded = `  ${value}  `;
  const result = new Set<string>();
  for (let index = 0; index <= padded.length - 3; index += 1) {
    result.add(padded.slice(index, index + 3));
  }
  return result;
}

export function fuzzyTitleSimilarity(left: string, right: string): number {
  const a = trigrams(normalizeTitle(left));
  const b = trigrams(normalizeTitle(right));
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return (2 * intersection) / (a.size + b.size);
}
