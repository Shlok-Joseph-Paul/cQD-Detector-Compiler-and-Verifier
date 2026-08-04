import type {
  Device,
  LigandExchangeType,
  TechnologyFamily,
} from "../data/types.ts";

export interface LigandExchangePage {
  page: number;
  text: string;
  documentLabel: string;
}

export interface LigandExchangeEvidence {
  page: number;
  location: string;
  conciseEvidence: string;
  confidence: number;
}

export type LigandExchangeExtraction = Pick<
  Device,
  | "ligand_exchange_status"
  | "ligand_exchange_type"
  | "ligand_exchange_chemicals"
  | "native_ligands"
  | "ligand_exchange_target"
  | "ligand_exchange_conditions"
  | "ligand_exchange_source_location"
> & {
  evidence: LigandExchangeEvidence[];
};

const CHEMICAL_PATTERNS: Array<[string, RegExp]> = [
  ["1,2-ethanedithiol (EDT)", /\b(?:1,2[- ]ethanedithiol|EDT)\b/i],
  [
    "3-mercaptopropionic acid (MPA)",
    /\b(?:3[- ]mercaptopropionic acid|MPA)\b/i,
  ],
  ["1-dodecanethiol (DDT)", /\b(?:1[- ]dodecanethiol|dodecanethiol|DDT)\b/i],
  [
    "cetyltrimethylammonium bromide (CTAB)",
    /\b(?:cetyltrimethylammonium bromide|CTAB)\b/i,
  ],
  [
    "tetrabutylammonium iodide (TBAI)",
    /\b(?:tetrabutylammonium iodide|TBAI)\b/i,
  ],
  [
    "tetramethylammonium iodide (TMAI)",
    /\b(?:tetramethylammonium iodide|TMAI)\b/i,
  ],
  ["methylammonium iodide (MAI)", /\b(?:methylammonium iodide|MAI)\b/i],
  ["ammonium iodide (NH4I)", /\bammonium\s*iodide|\bNH\s*4\s*I\b/i],
  [
    "indium(III) bromide (InBr3)",
    /\b(?:indium(?:\(III\))? bromide|InBr\s*3)\b/i,
  ],
  ["indium(III) iodide (InI3)", /\b(?:indium(?:\(III\))? iodide|InI\s*3)\b/i],
  [
    "ammonium acetate (NH4OAc)",
    /\b(?:ammonium[\s-]*acetate|NH\s*4\s*OAc|InBr\s*3\s*\/\s*AA)\b/i,
  ],
  ["lead(II) iodide (PbI2)", /\b(?:lead(?:\(II\))? iodide|PbI\s*2)\b/i],
  ["cadmium chloride (CdCl2)", /\b(?:cadmium chloride|CdCl\s*2)\b/i],
  [
    "mercury(II) chloride (HgCl2)",
    /\b(?:mercury(?:\(II\))? chloride|HgCl\s*2)\b/i,
  ],
  ["hydrochloric acid (HCl)", /\b(?:hydrochloric acid|HCl)\b/i],
  ["silver nitrate (AgNO3)", /\b(?:silver nitrate|AgNO\s*3)\b/i],
  ["malonic acid", /\bmalonic acid\b/i],
  ["mercaptoalkylamine (MTA)", /\b(?:mercaptoalkylamine|MTA)\b/i],
  ["halide", /\bhalide(?:s)?\b/i],
  ["iodide", /\biodide\b/i],
  ["bromide", /\bbromide\b/i],
  ["chloride", /\bchloride\b/i],
];

const NATIVE_LIGAND_PATTERNS: Array<[string, RegExp]> = [
  ["oleic acid (OA)", /\b(?:oleic[\s-]acid|OA)\b/i],
  ["oleylamine (OLA)", /\b(?:oleylamine|OLA)\b/i],
  ["trioctylphosphine (TOP)", /\b(?:trioctylphosphine|TOP)\b/i],
  ["trioctylphosphine oxide (TOPO)", /\b(?:trioctylphosphine oxide|TOPO)\b/i],
  ["dodecanethiol (DDT)", /\b(?:dodecanethiol|DDT)\b/i],
];

const EXPLICIT_TRIGGER =
  /ligand(?:s)?[\s-]*(?:exchange|exchanged|engineering)|(?:solid|solution|liquid|ink)[\s-]*phase[^.\n]{0,60}ligand|(?:exchange|replace|remove)[^.\n]{0,80}(?:native |long[\s-]*chain )?ligand|(?:CQD|QDs?|PbS|PbSe|HgTe|InAs|InSb|Ag2Te)[-@](?:EDT|MPA|DDT|TBAI|TMAI)|(?:EDT|MPA|DDT|CTAB|TBAI|TMAI|MAI|NH\s*4\s*(?:I|OAc)|InBr\s*3|InI\s*3|PbI\s*2|CdCl\s*2|HgCl\s*2|AgNO\s*3)(?:[^.\n]|\d\.\d){0,140}(?:treat|exchange|cross[\s-]*link|passivat|cap)|(?:treat|exchange|cross[\s-]*link|passivat|cap)(?:[^.\n]|\d\.\d){0,140}(?:EDT|MPA|DDT|CTAB|TBAI|TMAI|MAI|NH\s*4\s*(?:I|OAc)|InBr\s*3|InI\s*3|PbI\s*2|CdCl\s*2|HgCl\s*2|AgNO\s*3)/gi;

const VAGUE_TRIGGER =
  /(?:CQD|quantum dot|nanocrystal)[^.\n]{0,100}surface[\s-]*(?:treat|chemistry|passivat|reconstruct)|surface[\s-]*(?:treat|chemistry|passivat|reconstruct)[^.\n]{0,100}(?:CQD|quantum dot|nanocrystal)|hybrid[\s-]*ligand|ligand[\s-]*(?:engineered|capped|passivated)|resurfaced[^.\n]{0,80}(?:CQD|quantum dot|nanocrystal)/gi;

const NEGATED_TRIGGER =
  /without\s+(?!further\b)[^.\n]{0,70}ligand[\s-]*exchange|(?:no|obviat(?:e|es|ed|ing)|avoid(?:s|ed|ing)?) [^.\n]{0,70}ligand[\s-]*exchange|ligand[\s-]*exchange [^.\n]{0,50}(?:was |is )?(?:not used|unnecessary|avoided)/gi;

function clean(value: string, limit = 260): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= limit
    ? normalized
    : `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

function location(page: LigandExchangePage): string {
  return page.documentLabel === "Main article"
    ? `PDF page ${page.page}`
    : `${page.documentLabel} PDF page ${page.page}`;
}

function valuesFor(value: string, patterns: Array<[string, RegExp]>): string[] {
  return patterns
    .filter(([, pattern]) => pattern.test(value))
    .map(([label]) => label);
}

function processTypes(value: string): LigandExchangeType[] {
  const normalized = value.replace(/ﬁ/g, "fi").replace(/ﬂ/g, "fl");
  const types: LigandExchangeType[] = [];
  if (
    /solid[\s‐‑‒–—-]*(?:state|phase)|layer[\s‐‑‒–—-]*by[\s‐‑‒–—-]*layer|film[^.]{0,220}(?:dip|wash|rinse|treat)|(?:dip|wash|rinse|treat)[^.]{0,220}(?:film|layer)/i.test(
      normalized,
    )
  )
    types.push("solid_state");
  if (
    /solution[\s‐‑‒–—-]*phase|liquid[\s‐‑‒–—-]*phase|phase transfer|in solution|before (?:film|device) deposition/i.test(
      normalized,
    )
  )
    types.push("solution_phase");
  if (/ink[\s‐‑‒–—-]*phase|QD ink|CQD ink|quantum dot ink/i.test(normalized))
    types.push("ink_phase");
  return types;
}

function targets(value: string): string[] {
  const normalized = value.replace(/ﬁ/g, "fi").replace(/ﬂ/g, "fl");
  const matches: Array<[string, RegExp]> = [
    [
      "CQD absorber",
      /(?:CQD|quantum dot|nanocrystal)[^.]{0,45}(?:absorber|active layer)|(?:absorber|active layer)[^.]{0,45}(?:CQD|quantum dot|nanocrystal)/i,
    ],
    [
      "CQD film",
      /(?:CQD|quantum dot|nanocrystal) films?|films? of (?:CQD|quantum dots?|nanocrystals?)/i,
    ],
    ["CQD ink", /(?:CQD|quantum dot|nanocrystal) ink/i],
    ["hole-transport layer", /hole[\s-]*transport(?:ing)? layer|\bHTL\b/i],
    [
      "electron-transport layer",
      /electron[\s-]*transport(?:ing)? layer|\bETL\b/i,
    ],
  ];
  return valuesFor(normalized, matches);
}

function conditionDetails(value: string): string {
  const patterns = [
    /\b\d+(?:\.\d+)?\s*(?:mM|M|mg\s*\/\s*mL|vol\s*%|wt\s*%)\b/gi,
    /\bv\s*\/\s*v(?:\s*\/\s*v)?\s*=\s*\d+(?::\d+){1,2}\b/gi,
    /\b\d+(?:\.\d+)?\s*(?:s|sec(?:ond)?s?|min(?:ute)?s?|h|hours?)\b/gi,
    /\b\d+(?:\.\d+)?\s*(?:°\s*C|K)\b/gi,
    /\b\d+(?:,\d{3})?\s*rpm\b/gi,
    /\b(?:acetonitrile|methanol|ethanol|isopropanol|2-propanol|DMF|DMSO|butylamine|octane|hexane|toluene|chlorobenzene)\b/gi,
    /\b(?:spin[\s-]*coat(?:ed|ing)?|dip(?:ped|ping)?|rinse[ds]?|wash(?:ed|ing)?|stirred|phase transfer|layer[\s‐‑‒–—-]*by[\s‐‑‒–—-]*layer)\b/gi,
  ];
  const details = [
    ...new Set(patterns.flatMap((pattern) => value.match(pattern) ?? [])),
  ].slice(0, 14);
  return details.length
    ? `Automatically extracted reported parameters: ${details.join("; ")}.`
    : "Automatic text extraction identified the exchange chemistry and process; consult the cited source for recipe details.";
}

interface Candidate {
  page: LigandExchangePage;
  snippet: string;
  confidence: number;
  explicit: boolean;
}

function isReferencePage(normalized: string): boolean {
  return (
    /\bREFERENCES\b/i.test(normalized.slice(0, 1200)) ||
    ((normalized.match(/\b(?:19|20)\d{2}[,;.]/g) ?? []).length >= 10 &&
      (normalized.match(/\b(?:doi|vol\.|pp\.|et al\.)\b/gi) ?? []).length >= 4)
  );
}

function candidatesForPage(page: LigandExchangePage): Candidate[] {
  const normalized = page.text.replace(/\s+/g, " ");
  if (isReferencePage(normalized)) return [];
  const found: Candidate[] = [];
  for (const [pattern, explicit] of [
    [EXPLICIT_TRIGGER, true],
    [VAGUE_TRIGGER, false],
  ] as const) {
    pattern.lastIndex = 0;
    for (
      let match = pattern.exec(normalized);
      match;
      match = pattern.exec(normalized)
    ) {
      const start = Math.max(0, (match.index ?? 0) - 150);
      const end = Math.min(
        normalized.length,
        (match.index ?? 0) + match[0].length + 210,
      );
      const snippet = clean(normalized.slice(start, end));
      if (
        /references|reported by|previous (?:report|work)|literature comparison|state[\s-]*of[\s-]*the[\s-]*art/i.test(
          snippet,
        )
      )
        continue;
      const methodContext =
        /experimental|method|fabrication|preparation|deposition|spin[\s-]*coat|device/i.test(
          snippet,
        );
      const chemicalCount = valuesFor(snippet, CHEMICAL_PATTERNS).length;
      found.push({
        page,
        snippet,
        explicit,
        confidence: Math.min(
          0.98,
          (explicit ? (methodContext ? 0.9 : 0.8) : 0.6) +
            Math.min(0.06, chemicalCount * 0.02),
        ),
      });
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  }
  return found;
}

export function extractLigandExchange(
  pages: readonly LigandExchangePage[],
  technologyFamily: TechnologyFamily,
): LigandExchangeExtraction {
  if (technologyFamily !== "cqd")
    return {
      ligand_exchange_status: "not_applicable",
      ligand_exchange_type: null,
      ligand_exchange_chemicals: null,
      native_ligands: null,
      ligand_exchange_target: null,
      ligand_exchange_conditions: null,
      ligand_exchange_source_location: null,
      evidence: [],
    };

  for (const page of pages) {
    const normalized = page.text.replace(/\s+/g, " ");
    if (isReferencePage(normalized)) continue;
    NEGATED_TRIGGER.lastIndex = 0;
    const match = NEGATED_TRIGGER.exec(normalized);
    if (!match) continue;
    const start = Math.max(0, (match.index ?? 0) - 150);
    const end = Math.min(
      normalized.length,
      (match.index ?? 0) + match[0].length + 210,
    );
    const snippet = clean(normalized.slice(start, end));
    if (
      /\(\d+\)[^.]{0,180}\b(?:19|20)\d{2}\b|\b(?:ACS Nano|Adv\. Mater\.|Nano Lett\.|et al\.)\b/i.test(
        snippet,
      )
    )
      continue;
    return {
      ligand_exchange_status: "not_used",
      ligand_exchange_type: null,
      ligand_exchange_chemicals: null,
      native_ligands:
        valuesFor(snippet, NATIVE_LIGAND_PATTERNS).join(" | ") || null,
      ligand_exchange_target: targets(snippet).join(" | ") || null,
      ligand_exchange_conditions: snippet,
      ligand_exchange_source_location: location(page),
      evidence: [
        {
          page: page.page,
          location: location(page),
          conciseEvidence: snippet,
          confidence: 0.9,
        },
      ],
    };
  }

  const candidates = pages
    .flatMap(candidatesForPage)
    .sort((left, right) => right.confidence - left.confidence)
    .filter(
      (candidate, index, all) =>
        all.findIndex(
          (other) =>
            other.page.page === candidate.page.page &&
            other.page.documentLabel === candidate.page.documentLabel &&
            other.snippet === candidate.snippet,
        ) === index,
    )
    .slice(0, 6);
  if (!candidates.length)
    return {
      ligand_exchange_status: "not_reported",
      ligand_exchange_type: null,
      ligand_exchange_chemicals: null,
      native_ligands: null,
      ligand_exchange_target: null,
      ligand_exchange_conditions: null,
      ligand_exchange_source_location: null,
      evidence: [],
    };

  const evidenceText = candidates
    .map((candidate) => candidate.snippet)
    .join(" ");
  let chemicals = [...new Set(valuesFor(evidenceText, CHEMICAL_PATTERNS))];
  if (
    chemicals.some((chemical) =>
      /\((?:EDT|MPA|DDT|CTAB|TBAI|TMAI|MAI|NH4I|NH4OAc|InBr3|InI3|PbI2|CdCl2|HgCl2|HCl|AgNO3)\)/.test(
        chemical,
      ),
    )
  )
    chemicals = chemicals.filter(
      (chemical) =>
        !["halide", "iodide", "bromide", "chloride"].includes(chemical),
    );
  const nativeLigands = [
    ...new Set(valuesFor(evidenceText, NATIVE_LIGAND_PATTERNS)),
  ].filter((ligand) => !chemicals.includes(ligand));
  const detectedTypes =
    candidates
      .map((candidate) => [...new Set(processTypes(candidate.snippet))])
      .find((types) => types.length > 0) ?? [];
  const ligandType: LigandExchangeType =
    detectedTypes.length > 1 ? "mixed" : (detectedTypes[0] ?? "other");
  const targetLayers = [
    ...new Set(
      targets(
        candidates
          .slice(0, 3)
          .map((candidate) => candidate.snippet)
          .join(" "),
      ),
    ),
  ];
  const explicit = candidates.some((candidate) => candidate.explicit);
  const status = explicit && chemicals.length ? "reported" : "ambiguous";
  const selectedEvidence = candidates.slice(0, 3).map((candidate) => ({
    page: candidate.page.page,
    location: location(candidate.page),
    conciseEvidence: candidate.snippet,
    confidence: candidate.confidence,
  }));

  return {
    ligand_exchange_status: status,
    ligand_exchange_type: ligandType,
    ligand_exchange_chemicals: chemicals.join(" | ") || null,
    native_ligands: nativeLigands.join(" | ") || null,
    ligand_exchange_target: targetLayers.join(" | ") || null,
    ligand_exchange_conditions: conditionDetails(evidenceText),
    ligand_exchange_source_location: selectedEvidence
      .map((item) => item.location)
      .join(" | "),
    evidence: selectedEvidence,
  };
}
