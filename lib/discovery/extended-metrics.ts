import type {
  BandwidthLimit,
  ExtendedMetricExtractionMethod,
} from "../data/types.ts";

export interface ExtendedMetricPage {
  page: number;
  text: string;
  documentLabel: string;
}

export interface MetricCandidate {
  value: number;
  wavelengthNm: number | null;
  biasV: number | null;
  temperatureK: number | null;
  sourceLocation: string;
  evidence: string;
  extractionMethod: ExtendedMetricExtractionMethod;
}

export interface TemporalMetricCandidate extends MetricCandidate {
  kind: "response" | "rise" | "fall";
  definition: string;
  limit:
    | "measured"
    | "instrument_limited"
    | "source_limited"
    | "upper_bound"
    | "lower_bound";
}

export interface LdrCandidate extends MetricCandidate {
  minimum: number | null;
  maximum: number | null;
  units: string | null;
  definition: string;
}

export interface BandwidthCandidate extends MetricCandidate {
  limit: Exclude<BandwidthLimit, "not_reported">;
}

export interface ExtendedMetricCandidates {
  responsivity: MetricCandidate[];
  temporal: TemporalMetricCandidate[];
  bandwidth: BandwidthCandidate[];
  ldr: LdrCandidate[];
}

const PREFIX_SCALE: Record<string, number> = {
  "": 1,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  m: 1e-3,
  u: 1e-6,
  µ: 1e-6,
  μ: 1e-6,
  n: 1e-9,
  p: 1e-12,
};

export function convertPrefixedValue(value: number, prefix: string): number {
  return value * (PREFIX_SCALE[prefix] ?? 1);
}

function location(page: ExtendedMetricPage): string {
  return page.documentLabel === "Main article"
    ? `PDF page ${page.page}`
    : `${page.documentLabel} PDF page ${page.page}`;
}

function compact(value: string, limit = 420): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1)}…`;
}

function sentences(page: ExtendedMetricPage): string[] {
  return page.text
    .replace(/\r/g, "\n")
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((sentence) => compact(sentence))
    .filter(Boolean);
}

function contextConditions(text: string): {
  wavelengthNm: number | null;
  biasV: number | null;
  temperatureK: number | null;
} {
  const wavelength = text.match(/(\d+(?:\.\d+)?)\s*(nm|µm|μm|um)\b/i);
  const bias = text.match(/([+\-−]?\d+(?:\.\d+)?)\s*V\b/i);
  const temperature = text.match(/(\d+(?:\.\d+)?)\s*K\b/);
  return {
    wavelengthNm: wavelength
      ? Number(wavelength[1]) * (/nm/i.test(wavelength[2]) ? 1 : 1000)
      : null,
    biasV: bias ? Number(bias[1].replace("−", "-")) : null,
    temperatureK: temperature ? Number(temperature[1]) : null,
  };
}

function baseCandidate(
  page: ExtendedMetricPage,
  sentence: string,
  value: number,
): MetricCandidate {
  return {
    value,
    ...contextConditions(sentence),
    sourceLocation: location(page),
    evidence: compact(sentence),
    extractionMethod: "directly_reported",
  };
}

function unique<T extends MetricCandidate>(candidates: T[]): T[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = [
      candidate.value,
      candidate.wavelengthNm,
      candidate.biasV,
      candidate.sourceLocation,
      "kind" in candidate ? candidate.kind : "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function temporalLimit(sentence: string): TemporalMetricCandidate["limit"] {
  if (
    /instrument[\s-]*limited|limited by (?:the )?(?:oscilloscope|setup|electronics)/i.test(
      sentence,
    )
  )
    return "instrument_limited";
  if (
    /source[\s-]*limited|limited by (?:the )?(?:laser|led|pulse)/i.test(
      sentence,
    )
  )
    return "source_limited";
  if (/less than|<|no more than|upper bound/i.test(sentence))
    return "upper_bound";
  if (/greater than|>|at least|lower bound/i.test(sentence))
    return "lower_bound";
  return "measured";
}

function bandwidthLimit(sentence: string): BandwidthCandidate["limit"] {
  if (
    /exceed|in excess|greater than|more than|at least|\babove\b|>/i.test(
      sentence,
    )
  )
    return "lower_bound";
  if (/less than|no more than|at most|</i.test(sentence)) return "upper_bound";
  if (/instrument|measurement limit|setup limit/i.test(sentence))
    return "instrument_limited";
  return "measured";
}

export function extractExtendedMetricCandidates(
  pages: readonly ExtendedMetricPage[],
): ExtendedMetricCandidates {
  const responsivity: MetricCandidate[] = [];
  const temporal: TemporalMetricCandidate[] = [];
  const bandwidth: BandwidthCandidate[] = [];
  const ldr: LdrCandidate[] = [];

  for (const page of pages) {
    for (const sentence of sentences(page)) {
      if (/responsiv(?:ity|ities)|photoresponsivity/i.test(sentence)) {
        const expression =
          /(\d+(?:\.\d+)?)\s*(m|u|µ|μ)?A\s*(?:\/\s*W|W\s*(?:−1|-1|\^\s*-?1))/gi;
        for (
          let match = expression.exec(sentence);
          match;
          match = expression.exec(sentence)
        ) {
          responsivity.push(
            baseCandidate(
              page,
              sentence,
              convertPrefixedValue(Number(match[1]), match[2] ?? ""),
            ),
          );
        }
      }

      if (
        /response time|rise time|fall time|temporal response|transient response|switching time/i.test(
          sentence,
        )
      ) {
        const paired = sentence.match(
          /ris(?:e|ing)(?:\s+time)?(?:\s*\([^)]*\))?\s*(?:and|\/)\s*fall(?:ing)?(?:\s+time)?(?:\s*\([^)]*\))?[^\d]{0,45}(\d+(?:\.\d+)?)\s*(s|ms|u?s|µs|μs|ns|ps)?\s*(?:and|,|\/)\s*(\d+(?:\.\d+)?)\s*(s|ms|u?s|µs|μs|ns|ps)\b/i,
        );
        if (paired) {
          const firstUnit = paired[2] ?? paired[4];
          const units = [firstUnit, paired[4]];
          const values = [paired[1], paired[3]];
          (["rise", "fall"] as const).forEach((kind, index) => {
            const unit = units[index].toLowerCase();
            const prefix =
              unit === "ms"
                ? "m"
                : /^(?:us|µs|μs)$/.test(unit)
                  ? "u"
                  : unit === "ns"
                    ? "n"
                    : unit === "ps"
                      ? "p"
                      : "";
            temporal.push({
              ...baseCandidate(
                page,
                sentence,
                convertPrefixedValue(Number(values[index]), prefix),
              ),
              kind,
              definition: /10\s*[–-]\s*90\s*%/i.test(sentence)
                ? "10-90%"
                : /20\s*[–-]\s*80\s*%/i.test(sentence)
                  ? "20-80%"
                  : `${kind} time; threshold definition not reported`,
              limit: temporalLimit(sentence),
            });
          });
        } else {
          const expression =
            /(?:(rise|fall|response|switching)\s*time[^\d]{0,45})?(\d+(?:\.\d+)?)\s*(s|ms|u?s|µs|μs|ns|ps)\b/gi;
          for (
            let match = expression.exec(sentence);
            match;
            match = expression.exec(sentence)
          ) {
            const unit = match[3].toLowerCase();
            const prefix =
              unit === "ms"
                ? "m"
                : /^(?:us|µs|μs)$/.test(unit)
                  ? "u"
                  : unit === "ns"
                    ? "n"
                    : unit === "ps"
                      ? "p"
                      : "";
            const nearby = sentence
              .slice(
                Math.max(0, (match.index ?? 0) - 45),
                (match.index ?? 0) + match[0].length,
              )
              .toLowerCase();
            const kind: TemporalMetricCandidate["kind"] = /fall/.test(
              match[1] ?? nearby,
            )
              ? "fall"
              : /rise/.test(match[1] ?? nearby)
                ? "rise"
                : "response";
            temporal.push({
              ...baseCandidate(
                page,
                sentence,
                convertPrefixedValue(Number(match[2]), prefix),
              ),
              kind,
              definition: /10\s*[–-]\s*90\s*%/i.test(sentence)
                ? "10-90%"
                : /20\s*[–-]\s*80\s*%/i.test(sentence)
                  ? "20-80%"
                  : /fwhm|full width at half maximum/i.test(sentence)
                    ? "FWHM"
                    : kind === "rise"
                      ? "rise time; threshold definition not reported"
                      : kind === "fall"
                        ? "fall time; threshold definition not reported"
                        : "response time; definition not reported",
              limit: temporalLimit(sentence),
            });
          }
        }
      }

      if (
        /(?:[−-]?3\s*dB).{0,70}(?:bandwidth|frequency|cutoff)|(?:bandwidth|cutoff frequency).{0,70}[−-]?3\s*dB/i.test(
          sentence,
        )
      ) {
        if (
          /noise(?:-equivalent)? bandwidth|instrument bandwidth|initial voltage/i.test(
            sentence,
          )
        )
          continue;
        const expression = /(\d+(?:\.\d+)?)\s*(k|K|M|G)?Hz\b/g;
        for (
          let match = expression.exec(sentence);
          match;
          match = expression.exec(sentence)
        ) {
          bandwidth.push({
            ...baseCandidate(
              page,
              sentence,
              convertPrefixedValue(Number(match[1]), match[2] ?? ""),
            ),
            limit: bandwidthLimit(sentence),
          });
        }
      }

      if (/linear dynamic range|\bLDR\b/i.test(sentence)) {
        const dbMatch = sentence.match(
          /(?:linear dynamic range|\bLDR\b)[^.!?]{0,120}?(\d+(?:\.\d+)?)\s*dB\b|(\d+(?:\.\d+)?)\s*dB\b[^.!?]{0,120}?(?:linear dynamic range|\bLDR\b)/i,
        );
        const rangeMatch = sentence.match(
          /(?:from|between)\s+([\d.]+)\s*(p|n|u|µ|μ|m)?(W\s*cm(?:−2|-2|\^-?2)?|W\/cm2|W\/cm²|W|mW\/cm2)\s+(?:to|and)\s+([\d.]+)\s*(p|n|u|µ|μ|m)?(W\s*cm(?:−2|-2|\^-?2)?|W\/cm2|W\/cm²|W|mW\/cm2)/i,
        );
        if (dbMatch || rangeMatch) {
          const conditions = contextConditions(sentence);
          const minimum = rangeMatch
            ? convertPrefixedValue(Number(rangeMatch[1]), rangeMatch[2] ?? "")
            : null;
          const maximum = rangeMatch
            ? convertPrefixedValue(Number(rangeMatch[4]), rangeMatch[5] ?? "")
            : null;
          ldr.push({
            value: dbMatch
              ? Number(dbMatch[1] ?? dbMatch[2])
              : (maximum ?? minimum ?? 0),
            ...conditions,
            sourceLocation: location(page),
            evidence: compact(sentence),
            extractionMethod: "directly_reported",
            minimum,
            maximum,
            units: rangeMatch ? rangeMatch[6].replace(/\s+/g, "") : "dB",
            definition: dbMatch
              ? "Linear dynamic range reported by the source"
              : "Reported linear optical-input range",
          });
        }
      }
    }
  }

  return {
    responsivity: unique(responsivity),
    temporal: unique(temporal),
    bandwidth: unique(bandwidth),
    ldr: unique(ldr),
  };
}

export function selectMetricCandidate<T extends MetricCandidate>(
  candidates: readonly T[],
  wavelengthNm: number,
  biasV: number | null,
): T | null {
  if (!candidates.length) return null;
  return [...candidates].sort((left, right) => {
    const score = (candidate: T) => {
      let value = candidate.wavelengthNm == null ? 0 : -2;
      if (
        candidate.wavelengthNm != null &&
        Math.abs(candidate.wavelengthNm - wavelengthNm) <=
          Math.max(10, wavelengthNm * 0.015)
      )
        value += 8;
      if (candidate.biasV != null && biasV != null) {
        value += Math.abs(candidate.biasV - biasV) < 1e-6 ? 4 : -2;
      }
      return value;
    };
    return score(right) - score(left) || right.value - left.value;
  })[0];
}
