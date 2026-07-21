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

function normalizeEvidenceText(value: string): string {
  return value
    .replace(/\s*<sub>\s*([0-9]+)\s*<\/sub>/gi, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (digit) => String("₀₁₂₃₄₅₆₇₈₉".indexOf(digit)))
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const MATERIAL_PATTERNS: Readonly<Record<string, RegExp>> = {
  HgTe: /\b(?:hgte|mercury telluride)\b/i,
  PbS: /\b(?:pbs|lead sulfide)\b/i,
  PbSe: /\b(?:pbse|lead selenide)\b/i,
  Ag2Se: /\b(?:ag2se|silver selenide)\b/i,
  Ag2Te: /\b(?:ag2te|silver telluride)\b/i,
  InAs: /\b(?:inas|indium arsenide)\b/i,
  InSb: /\b(?:insb|indium antimonide)\b/i,
  HgCdSe: /\b(?:hgcdse|mercury cadmium selenide)\b/i,
  Cd3P2: /\b(?:cd3p2|cadmium phosphide)\b/i,
  AgBiS2: /\b(?:agbis2|silver bismuth sulfide)\b/i,
  "In(As,P)":
    /\b(?:inasp|indium arsenide phosphide)\b|in\s*\(\s*as\s*,\s*p\s*\)/i,
  MAPbI3: /\b(?:mapbi3|methylammonium lead iodide|mapi)\b/i,
  MAPbBr3: /\b(?:mapbbr3|methylammonium lead bromide)\b/i,
  MAPbCl3: /\b(?:mapbcl3|methylammonium lead chloride)\b/i,
  FAPbI3: /\b(?:fapbi3|formamidinium lead iodide)\b/i,
  FAPbBr3: /\b(?:fapbbr3|formamidinium lead bromide)\b/i,
  CsPbBr3: /\b(?:cspbbr3|cesium lead bromide)\b/i,
  CsPbI3: /\b(?:cspbi3|cesium lead iodide)\b/i,
  Cs2AgBiBr6: /\b(?:cs2agbibr6|cesium silver bismuth bromide)\b/i,
  "mixed Pb-Sn perovskite":
    /\b(?:mixed[ -]?(?:lead|pb)[ -]?(?:tin|sn)|pb[ -]?sn)\b[^.]{0,80}\bperovskite/i,
  "mixed-halide perovskite": /\bmixed[ -]halide perovskite/i,
  "quasi-2D perovskite": /\b(?:quasi[ -]?2d|multidimensional) perovskite/i,
  "metal-halide perovskite":
    /\b(?:metal[ -]halide|lead[ -]halide|hybrid) perovskite/i,
};

function matchesMaterial(text: string, term: string): boolean {
  const known = MATERIAL_PATTERNS[term];
  if (known) return has(text, known);
  const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return has(
    text,
    new RegExp(
      `(?:^|[^a-z0-9])${escaped.replace(/\\ /g, "\\s+")}(?=$|[^a-z0-9])`,
      "i",
    ),
  );
}

export function calculateRelevance(
  work: OpenAlexWork,
  config: DiscoveryConfig,
  methods: readonly DiscoveryMethod[] = [],
  technologyFamily?: TechnologyFamily,
): RelevanceResult {
  const title = work.title ?? work.display_name ?? "";
  const abstract = reconstructOpenAlexAbstract(work.abstract_inverted_index);
  const text = normalizeEvidenceText(`${title} ${abstract ?? ""}`);
  const positive = config.ranking.positiveWeights;
  const negative = config.ranking.negativeWeights;
  const profile = resolveDiscoveryProfile(config, technologyFamily);
  const reasons: string[] = [];
  let score = 0;

  const materials = profile.materialTerms.filter((term) =>
    matchesMaterial(text, term),
  );
  const deviceTerms = config.deviceTerms.filter((term) =>
    text.includes(term.toLowerCase()),
  );
  const spectralTerms = config.spectralTerms.filter((term) =>
    text.includes(term.toLowerCase()),
  );

  const hasProfileTerminology =
    profile.terminology === "perovskite"
      ? has(
          text,
          /\b(?:metal[ -]halide |lead[ -]halide |hybrid )?perovskites?\b/i,
        )
      : has(
          text,
          /\b(colloidal quantum dots?|colloidal nanocrystals?|solution[ -]processed (?:colloidal )?quantum dots?|cqds?)\b/i,
        );
  if (hasProfileTerminology) {
    score += positive.colloidalTerminology ?? 0;
    reasons.push(
      profile.terminology === "perovskite"
        ? "Explicit metal-halide perovskite terminology"
        : "Explicit colloidal quantum-dot or nanocrystal terminology",
    );
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
    reasons.push("Spectral-region or wavelength terminology");
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
        profile.terminology === "cqd" &&
        !has(text, /\b(?:colloidal|cqds?)\b/i),
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
import type { TechnologyFamily } from "../data/types.ts";
import { resolveDiscoveryProfile } from "./profiles.ts";
