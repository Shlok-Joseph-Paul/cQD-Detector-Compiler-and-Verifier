import type {
  DiscoveryConfig,
  DiscoveryMethod,
  OpenAlexWork,
} from "./types.ts";
import { reconstructOpenAlexAbstract } from "./normalize.ts";

export interface RelevanceResult {
  score: number;
  reasons: string[];
  materials: string[];
  deviceType: string | null;
  spectralRegions: string[];
}

function has(text: string, expression: RegExp): boolean {
  expression.lastIndex = 0;
  return expression.test(text);
}

export function calculateRelevance(
  work: OpenAlexWork,
  config: DiscoveryConfig,
  methods: readonly DiscoveryMethod[] = [],
): RelevanceResult {
  const title = work.title ?? work.display_name ?? "";
  const abstract = reconstructOpenAlexAbstract(work.abstract_inverted_index);
  const text = `${title} ${abstract ?? ""}`.toLowerCase();
  const positive = config.ranking.positiveWeights;
  const negative = config.ranking.negativeWeights;
  const reasons: string[] = [];
  let score = 0;

  const materials = config.materialTerms.filter((term) => {
    const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return has(
      text,
      new RegExp(`\\b${escaped.replace(/\\ /g, "\\s+")}\\b`, "i"),
    );
  });
  const deviceTerms = config.deviceTerms.filter((term) =>
    text.includes(term.toLowerCase()),
  );
  const spectralTerms = config.spectralTerms.filter((term) =>
    text.includes(term.toLowerCase()),
  );

  if (
    has(
      text,
      /\b(colloidal quantum dots?|colloidal nanocrystals?|nanocrystals?)\b/i,
    )
  ) {
    score += positive.colloidalTerminology ?? 0;
    reasons.push("Explicit colloidal quantum-dot or nanocrystal terminology");
  }
  if (materials.length) {
    score += positive.configuredMaterial ?? 0;
    reasons.push(`Configured material: ${materials.join(", ")}`);
  }
  if (deviceTerms.length) {
    score += positive.deviceTerminology ?? 0;
    reasons.push(`Detector terminology: ${deviceTerms.join(", ")}`);
  }
  if (spectralTerms.length || has(text, /\b\d(?:\.\d+)?\s*(?:µm|um|nm)\b/i)) {
    score += positive.infraredTerminology ?? 0;
    reasons.push("Infrared or wavelength terminology");
  }
  const performanceMatches = [
    "detectivity",
    "responsivity",
    "external quantum efficiency",
    "eqe",
    "noise",
    "dark current",
    "bandwidth",
    "response time",
  ].filter((term) => text.includes(term));
  if (performanceMatches.length) {
    score += positive.performanceTerminology ?? 0;
    reasons.push(`Performance metrics: ${performanceMatches.join(", ")}`);
  }
  if (methods.some((method) => method !== "keyword")) {
    score += positive.atlasCitationConnection ?? 0;
    reasons.push("Citation-graph connection to an included atlas paper");
  }
  if (work.type === "article") {
    score += positive.journalArticle ?? 0;
    reasons.push("Journal article");
  }

  const negatives: Array<[boolean, string, keyof typeof negative]> = [
    [
      has(text, /\b(review|perspective|outlook|roadmap)\b/i),
      "Review or perspective",
      "reviewOrPerspective",
    ],
    [
      has(text, /\b(led|light emitting diode|laser|luminescen|emitter)\b/i) &&
        !deviceTerms.length,
      "Emitter, LED, laser, or luminescence-only focus",
      "emitterOnly",
    ],
    [
      has(text, /\b(solar cell|photovoltaic)\b/i) && !deviceTerms.length,
      "Solar-cell-only focus",
      "solarCellOnly",
    ],
    [
      has(text, /\b(synthesis|growth)\b/i) && !deviceTerms.length,
      "Synthesis-only focus",
      "synthesisOnly",
    ],
    [
      has(
        text,
        /\b(theoretical|simulation|first principles|density functional)\b/i,
      ) && !has(text, /\bexperiment/i),
      "Theoretical or simulation-only focus",
      "theoryOnly",
    ],
    [
      has(text, /\b(epitaxial|self assembled|self-assembled)\b/i) &&
        !has(text, /\bcolloidal\b/i),
      "Epitaxial, self-assembled, or non-colloidal quantum dots",
      "nonColloidalQuantumDots",
    ],
    [
      Boolean(work.is_retracted) ||
        has(title, /\b(correction|erratum|retraction)\b/i),
      "Retraction, correction, or non-primary record",
      "nonPrimaryRecord",
    ],
  ];
  for (const [matched, reason, key] of negatives) {
    if (!matched) continue;
    score += negative[key] ?? 0;
    reasons.push(reason);
  }

  const spectralRegions: string[] = [];
  if (has(text, /\b(near infrared|near-infrared|nir)\b/i))
    spectralRegions.push("NIR");
  if (has(text, /\b(short wave infrared|short-wave infrared|swir)\b/i))
    spectralRegions.push("SWIR");
  if (has(text, /\b(extended swir|eswir|e-swir)\b/i))
    spectralRegions.push("eSWIR");
  if (has(text, /\b(mid wave infrared|mid-wave infrared|mwir)\b/i))
    spectralRegions.push("MWIR");
  if (!spectralRegions.length && spectralTerms.length)
    spectralRegions.push("infrared");

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
    materials,
    deviceType: deviceTerms[0] ?? null,
    spectralRegions,
  };
}
