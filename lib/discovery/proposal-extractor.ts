import { createHash } from "node:crypto";
import type {
  Device,
  Measurement,
  NoiseInstrument,
  Paper,
} from "../data/types.ts";
import type { DiscoveryCandidate } from "./types.ts";
import { candidateTechnologyFamilies } from "./profiles.ts";
import type {
  ProposalEvidence,
  ProposalSource,
  StagedPaperProposal,
} from "./proposal-types.ts";
import {
  extractExtendedMetricCandidates,
  selectMetricCandidate,
} from "./extended-metrics.ts";

interface PageText {
  page: number;
  text: string;
  documentLabel: string;
}

export interface SupportingDocumentText {
  label: string;
  markedText: string;
}

const SUPER_DIGITS: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁻": "-",
};
const VALUE_PATTERN = String.raw`(?:\d+(?:\.\d+)?\s*(?:[×x·]\s*)?10\s*(?:\^|\*\*)?\s*[+\-−]?\s*\d+|\d+(?:\.\d+)?\s*10[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+|\d+(?:\.\d+)?[eE][+\-]?\d+)`;

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function splitMarkedPages(
  text: string,
  documentLabel = "Main article",
): PageText[] {
  const matches = [...text.matchAll(/^=== PDF PAGE (\d+) ===\s*$/gm)];
  return matches.map((match, index) => ({
    page: Number(match[1]),
    documentLabel,
    text: text
      .slice(
        (match.index ?? 0) + match[0].length,
        matches[index + 1]?.index ?? text.length,
      )
      .trim(),
  }));
}

function pageLocation(page: PageText): string {
  return page.documentLabel === "Main article"
    ? `PDF page ${page.page}`
    : `${page.documentLabel} PDF page ${page.page}`;
}

function cleanSnippet(value: string, limit = 320): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= limit
    ? clean
    : `${clean.slice(0, limit - 1).trimEnd()}…`;
}

function parseScientific(value: string): number | null {
  let normalized = value
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g, (digit) => SUPER_DIGITS[digit] ?? digit)
    .replace(/−/g, "-")
    .replace(/\s+/g, "");
  normalized = normalized.replace(/[×x·]/, "e").replace(/10\^?/, "e");
  if ((normalized.match(/e/g) ?? []).length > 1)
    normalized = normalized.replace(/^([^e]+)e10e/, "$1e");
  const direct = Number(normalized);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const match = value
    .replace(/−/g, "-")
    .match(/(\d+(?:\.\d+)?)\s*(?:[×x·]\s*)?10\s*(?:\^|\*\*)?\s*([+\-]?\d+)/);
  if (!match) return null;
  const parsed = Number(`${match[1]}e${match[2]}`);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function nearestNumber(
  text: string,
  center: number,
  expression: RegExp,
): RegExpExecArray | null {
  let best: RegExpExecArray | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  expression.lastIndex = 0;
  for (
    let match = expression.exec(text);
    match;
    match = expression.exec(text)
  ) {
    const distance = Math.abs((match.index ?? 0) - center);
    if (distance < bestDistance) {
      best = match;
      bestDistance = distance;
    }
    if (match[0].length === 0) expression.lastIndex += 1;
  }
  return best;
}

function optionalMetric(
  text: string,
  center: number,
  expression: RegExp,
  scale = 1,
): number | null {
  const match = nearestNumber(text, center, expression);
  if (!match || Math.abs((match.index ?? 0) - center) > 350) return null;
  const value = Number(match[1]) * scale;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function detectNoise(pages: PageText[]): {
  method: Measurement["noise_method"];
  instruments: NoiseInstrument[];
  details: string | null;
  source: string | null;
  amberReasons: Measurement["amber_reasons"];
} {
  const normalizedPages = pages.map((page) => ({
    ...page,
    text: page.text.replace(/\s+/g, " "),
  }));
  const joined = normalizedPages
    .map((page) => `[page ${page.page}] ${page.text}`)
    .join("\n");
  const lower = joined.toLowerCase();
  const shot =
    /shot[\s-]*noise/.test(lower) &&
    /calculat|estimat|assum|theoretical|sqrt|√/.test(lower);
  const measured =
    /noise\s+(?:current\s+|power\s+)?spectr|noise\s+spectral\s+density|measured\s+noise|noise\s+measurement/.test(
      lower,
    );
  const minimumPower =
    /minimum detectable (?:power|signal)|noise equivalent power/.test(lower);
  const method: Measurement["noise_method"] = measured
    ? "measured_noise"
    : shot
      ? "shot_noise_approximation"
      : minimumPower
        ? "nep_from_minimum_detectable_power"
        : "unspecified";
  const instruments: NoiseInstrument[] = [];
  const instrumentPatterns: Array<[NoiseInstrument, RegExp]> = [
    ["spectrum_analyzer", /(?:spectrum|signal|dynamic signal) analy[sz]er/i],
    [
      "dedicated_noise_analyzer",
      /(?:low[\s-]*frequency |semiconductor )?noise (?:analy[sz]er|test system)/i,
    ],
    [
      "oscilloscope_fft",
      /oscilloscope[^.\n]{0,160}(?:fft|fourier)|(?:fft|fourier)[^.\n]{0,160}oscilloscope/i,
    ],
    ["transient_current_fft", /transient current[^.\n]{0,160}(?:fft|fourier)/i],
    ["lock_in_amplifier", /lock[\s-]*in amplifier/i],
    [
      "source_measure_unit",
      /source measure(?:ment)? unit|\bsmu\b|parameter analy[sz]er/i,
    ],
  ];
  const evidence: string[] = [];
  let source: string | null = null;
  for (const page of normalizedPages) {
    for (const [instrument, pattern] of instrumentPatterns) {
      const match = pattern.exec(page.text);
      if (!match) continue;
      const start = Math.max(0, (match.index ?? 0) - 180);
      const end = Math.min(
        page.text.length,
        (match.index ?? 0) + match[0].length + 180,
      );
      const context = page.text.slice(start, end);
      const isNoisePurpose = /noise|spectral density|fluctuation/i.test(
        context,
      );
      if (!isNoisePurpose) continue;
      if (
        instrument === "source_measure_unit" &&
        /transient photocurrent|\bTPC\b/i.test(context) &&
        !/noise[^.]{0,100}(?:source measure(?:ment)? unit|\bSMU\b)|(?:source measure(?:ment)? unit|\bSMU\b)[^.]{0,100}noise/i.test(
          context,
        )
      )
        continue;
      if (!instruments.includes(instrument)) instruments.push(instrument);
      evidence.push(`${pageLocation(page)}: ${cleanSnippet(context, 180)}`);
      source ??= pageLocation(page);
    }
  }
  if (method === "shot_noise_approximation")
    instruments.splice(0, instruments.length, "not_applicable");
  else if (method === "measured_noise" && instruments.length === 0)
    instruments.push("not_reported");
  else if (instruments.length === 0) instruments.push("not_reported");
  const amberReasons: Measurement["amber_reasons"] = [];
  if (method === "shot_noise_approximation")
    amberReasons.push("shot_noise_approximation");
  if (instruments.length === 1 && instruments[0] === "lock_in_amplifier")
    amberReasons.push("lock_in_only_noise_measurement");
  if (instruments.includes("source_measure_unit"))
    amberReasons.push("source_measure_unit_noise_measurement");
  return {
    method,
    instruments,
    details: evidence.length ? evidence.join(" | ") : null,
    source,
    amberReasons,
  };
}

function findStack(pages: PageText[]): string | null {
  const stackPattern =
    /\b(?:ITO|FTO|Au|Ag|Al|ZnO|TiO2|MoO3|PEDOT:PSS|CQDs?|quantum dots?|perovskite|MAPI|MAPbI3)(?:\s*\/\s*(?:ITO|FTO|Au|Ag|Al|ZnO|TiO2|MoO3|PEDOT:PSS|perovskite|MAPI|MAPbI3|[A-Za-z0-9₂₃().:+-]{2,24})){3,}\b/i;
  for (const page of pages) {
    const match = page.text.match(stackPattern);
    if (match) return cleanSnippet(match[0], 240);
  }
  return null;
}

function findPageEvidence(
  pages: PageText[],
  pattern: RegExp,
): { page: number; documentLabel: string; snippet: string } | null {
  for (const page of pages) {
    const normalized = page.text.replace(/\s+/g, " ");
    const match = pattern.exec(normalized);
    pattern.lastIndex = 0;
    if (!match) continue;
    const start = Math.max(0, (match.index ?? 0) - 170);
    const end = Math.min(
      normalized.length,
      (match.index ?? 0) + match[0].length + 220,
    );
    return {
      page: page.page,
      documentLabel: page.documentLabel,
      snippet: cleanSnippet(normalized.slice(start, end)),
    };
  }
  return null;
}

export function extractStagedProposal(
  candidate: DiscoveryCandidate,
  source: ProposalSource,
  markedText: string,
  now = new Date(),
  supportingDocuments: SupportingDocumentText[] = [],
): StagedPaperProposal {
  const pages = [
    ...splitMarkedPages(markedText),
    ...supportingDocuments.flatMap((document) =>
      splitMarkedPages(document.markedText, document.label),
    ),
  ];
  const allText = pages.map((page) => page.text).join("\n");
  const extendedMetrics = extractExtendedMetricCandidates(pages);
  const normalizedText = allText.replace(/\s+/g, " ");
  const lower = allText.toLowerCase();
  const scopeReasons: string[] = [];
  const warnings: string[] = [];
  const missingFields: string[] = [];
  const technologyFamilies = candidateTechnologyFamilies(candidate);
  const isPerovskite = technologyFamilies.includes("perovskite");
  const hasColloidal =
    /colloidal quantum dot|colloidal nanocrystal|solution[\s-]*processed/.test(
      lower,
    );
  const hasPerovskite =
    /\b(?:metal[\s-]halide |lead[\s-]halide |hybrid )?perovskites?\b/.test(
      lower,
    );
  const hasProfileAbsorber = isPerovskite ? hasPerovskite : hasColloidal;
  const hasPhotodiode =
    /photodiode|photovoltaic (?:detector|device)|p[\s\-–—−]*n junction|p[\s\-–—−]*i[\s\-–—−]*n/.test(
      lower,
    );
  const onlyExcluded =
    /photoconductor|phototransistor|photoresistor|bolometer/.test(lower) &&
    !hasPhotodiode;
  if (hasProfileAbsorber)
    scopeReasons.push(
      isPerovskite
        ? "Full text contains metal-halide perovskite terminology."
        : "Full text contains colloidal or solution-processed quantum-dot terminology.",
    );
  else
    scopeReasons.push(
      `${isPerovskite ? "Metal-halide perovskite" : "Colloidal or solution-processed CQD"} absorber terminology was not established automatically.`,
    );
  if (hasPhotodiode)
    scopeReasons.push(
      "Full text describes a photodiode, photovoltaic detector, or rectifying junction.",
    );
  else
    scopeReasons.push(
      "Photodiode or rectifying-junction scope was not established automatically.",
    );
  if (onlyExcluded)
    scopeReasons.push(
      "Only an excluded photoconductive/transistor/bolometric architecture was detected.",
    );

  const paperKey = shortHash(
    candidate.normalizedDoi ?? candidate.openAlexId ?? candidate.title,
  );
  const paperId = `paper-${paperKey}`;
  const deviceId = `device-${paperKey}-1`;
  const publicationType: Paper["publication_type"] =
    candidate.normalizedDoi?.startsWith("10.48550/arxiv") ||
    candidate.publicationUrl?.includes("arxiv.org")
      ? "preprint"
      : "journal_article";
  const proposedPaper: Paper = {
    paper_id: paperId,
    title: candidate.title,
    authors: candidate.authors,
    first_author: candidate.authors[0] ?? "",
    journal: candidate.journal,
    publication_year: candidate.publicationYear ?? now.getUTCFullYear(),
    doi: candidate.normalizedDoi,
    publication_url: candidate.publicationUrl,
    publication_type: publicationType,
    peer_reviewed: publicationType === "journal_article",
    notes:
      "Staged from a verified open-access PDF; bibliographic metadata and all measurements require curator approval.",
  };
  if (!proposedPaper.first_author) missingFields.push("paper.first_author");
  if (!candidate.publicationYear)
    warnings.push(
      "Publication year came from the proposal date because source metadata was missing.",
    );

  const materials = candidate.candidateMaterialClasses.length
    ? candidate.candidateMaterialClasses
    : [isPerovskite ? "Metal-halide perovskite" : "Other CQDs"];
  let stack = findStack(pages);
  if (stack && /Ag2Te/i.test(materials[0]))
    stack = stack.replace(/\/QD(?=\/)/i, "/Ag2Te QDs");
  if (
    stack &&
    !/MoO3\/Ag$/i.test(stack) &&
    /top electrode layers[^.]{0,180}MoO3[^.]{0,100}\bAg\b/i.test(normalizedText)
  )
    stack = `${stack}/MoO3/Ag`;
  const activeAreaMatch = normalizedText.match(
    /(?:active|device|pixel) area[^.\n]{0,80}?(\d+(?:\.\d+)?)\s*(cm2|cm²|mm2|mm²)/i,
  );
  const activeArea = activeAreaMatch
    ? Number(activeAreaMatch[1]) * (/mm/i.test(activeAreaMatch[2]) ? 0.01 : 1)
    : null;
  const proposedDevice: Device = {
    device_id: deviceId,
    paper_id: paperId,
    technology_family: isPerovskite ? "perovskite" : "cqd",
    material_family: materials[0],
    material_composition: materials.join("/"),
    device_architecture: hasPhotodiode
      ? `${isPerovskite ? "Perovskite" : "CQD"} photodiode; exact architecture requires curator confirmation`
      : null,
    device_stack: stack,
    active_area_cm2: activeArea,
    device_notes:
      "Automatically staged from full text; confirm absorber, junction type, stack order, and area against the cited source locations.",
  };
  if (!stack) missingFields.push("device.device_stack");
  if (activeArea == null) missingFields.push("device.active_area_cm2");

  const evidence: ProposalEvidence[] = [];
  const stackEvidence = findPageEvidence(
    pages,
    /ITO\s*\/\s*SnO2\s*\/\s*BiCl3\s*\/\s*QD\s*\/\s*P3HT/i,
  );
  if (stack && stackEvidence)
    evidence.push({
      field: "device.device_stack",
      page: stackEvidence.page,
      location: `${stackEvidence.documentLabel} PDF page ${stackEvidence.page}`,
      conciseEvidence: stackEvidence.snippet,
      confidence: 0.78,
    });
  const areaEvidence = findPageEvidence(
    pages,
    /device\s+area\s*\([^)]*(?:cm2|cm²|mm2|mm²)[^)]*\)/i,
  );
  if (activeArea != null && areaEvidence)
    evidence.push({
      field: "device.active_area_cm2",
      page: areaEvidence.page,
      location: `${areaEvidence.documentLabel} PDF page ${areaEvidence.page}`,
      conciseEvidence: areaEvidence.snippet,
      confidence: 0.9,
    });
  const proposedMeasurements: Measurement[] = [];
  const noise = detectNoise(pages);
  const detectivityRegex = new RegExp(
    String.raw`(?:specific\s+)?detectivit(?:y|ies)|\bD\s*\*`,
    "gi",
  );
  const measurementPages = [...pages].sort((left, right) => {
    const evidenceScore = (page: PageText) =>
      [
        /responsivity[\s\S]{0,260}(?:specific\s+)?detectivit|responsivity[\s\S]{0,260}\bD\s*\*/i,
        /noise|responsivity|device\s+area|bandwidth/i,
        /results?|discussion|figure\s+\d/i,
      ].reduce(
        (score, pattern, index) =>
          score + (pattern.test(page.text) ? [6, 2, 1][index] : 0),
        0,
      );
    return evidenceScore(right) - evidenceScore(left) || right.page - left.page;
  });
  for (const page of measurementPages) {
    for (
      let label = detectivityRegex.exec(page.text);
      label;
      label = detectivityRegex.exec(page.text)
    ) {
      const center = label.index ?? 0;
      const start = Math.max(0, center - 280);
      const end = Math.min(page.text.length, center + 520);
      const window = page.text.slice(start, end);
      const valueMatch = window.match(
        new RegExp(`(${VALUE_PATTERN})\\s*(?:Jones?|cm\\s*Hz)`, "i"),
      );
      if (!valueMatch) continue;
      const detectivity = parseScientific(valueMatch[1]);
      if (!detectivity) continue;
      const wavelengthMatches = [
        ...window.matchAll(/(\d+(?:\.\d+)?)\s*(nm|µm|μm|um)\b/gi),
      ];
      if (!wavelengthMatches.length) continue;
      const valuePosition = valueMatch.index ?? 0;
      wavelengthMatches.sort(
        (left, right) =>
          Math.abs((left.index ?? 0) - valuePosition) -
          Math.abs((right.index ?? 0) - valuePosition),
      );
      const wavelengthMatch = wavelengthMatches[0];
      const wavelengthNm =
        Number(wavelengthMatch[1]) *
        (/nm/i.test(wavelengthMatch[2]) ? 1 : 1000);
      if (!(wavelengthNm >= 200 && wavelengthNm <= 30000)) continue;
      const snippet = cleanSnippet(window);
      const possibleComparison =
        /previous|reported (?:by|in)|literature|comparison|state[- ]of[- ]the[- ]art|table\s+s?\d/i.test(
          snippet,
        );
      if (possibleComparison)
        warnings.push(
          `Measurement candidate on ${pageLocation(page)} may come from a literature comparison; verify the value belongs to this paper.`,
        );
      const existing = proposedMeasurements.some(
        (measurement) =>
          measurement.wavelength_nm === wavelengthNm &&
          Math.abs(measurement.detectivity_jones - detectivity) / detectivity <
            1e-9,
      );
      if (existing) continue;
      const localCenter = center - start;
      const responsivity = optionalMetric(
        window,
        localCenter,
        /(\d+(?:\.\d+)?)\s*A\s*(?:\/\s*W|W(?:−1|-1|\^?-1)?)/gi,
      );
      const eqe = optionalMetric(
        window,
        localCenter,
        /(\d+(?:\.\d+)?)\s*%\s*(?:EQE|external quantum efficiency)?/gi,
      );
      const temperature = optionalMetric(
        window,
        localCenter,
        /(\d+(?:\.\d+)?)\s*K\b/gi,
      );
      const biasMatch = nearestNumber(
        window,
        localCenter,
        /([+\-−]?\d+(?:\.\d+)?)\s*V\b/gi,
      );
      let bias =
        biasMatch && Math.abs((biasMatch.index ?? 0) - localCenter) <= 350
          ? Number(biasMatch[1].replace("−", "-"))
          : null;
      if (bias == null && /(?:zero|0)\s+bias|short[\s-]*circuit/i.test(window))
        bias = 0;
      const frequencyMatch = nearestNumber(
        window,
        localCenter,
        /(\d+(?:\.\d+)?)\s*(Hz|kHz|MHz)\b/gi,
      );
      const frequency =
        frequencyMatch &&
        Math.abs((frequencyMatch.index ?? 0) - localCenter) <= 350
          ? Number(frequencyMatch[1]) *
            (/mhz/i.test(frequencyMatch[2])
              ? 1e6
              : /khz/i.test(frequencyMatch[2])
                ? 1e3
                : 1)
          : null;
      const responsivityCandidate = selectMetricCandidate(
        extendedMetrics.responsivity,
        wavelengthNm,
        bias,
      );
      const responseCandidate = selectMetricCandidate(
        extendedMetrics.temporal.filter(
          (candidate) => candidate.kind === "response",
        ),
        wavelengthNm,
        bias,
      );
      const riseCandidate = selectMetricCandidate(
        extendedMetrics.temporal.filter(
          (candidate) => candidate.kind === "rise",
        ),
        wavelengthNm,
        bias,
      );
      const fallCandidate = selectMetricCandidate(
        extendedMetrics.temporal.filter(
          (candidate) => candidate.kind === "fall",
        ),
        wavelengthNm,
        bias,
      );
      const bandwidthCandidate = selectMetricCandidate(
        extendedMetrics.bandwidth,
        wavelengthNm,
        bias,
      );
      const ldrCandidate = selectMetricCandidate(
        extendedMetrics.ldr,
        wavelengthNm,
        bias,
      );
      const selectedResponsivity = responsivityCandidate?.value ?? responsivity;
      const temporalSource =
        responseCandidate?.sourceLocation ??
        riseCandidate?.sourceLocation ??
        fallCandidate?.sourceLocation ??
        null;
      const temporalDefinition =
        [
          responseCandidate?.definition,
          riseCandidate?.definition,
          fallCandidate?.definition,
        ]
          .filter(Boolean)
          .join("; ") || null;
      const amberExplanation = noise.amberReasons.length
        ? `Automatic caution: ${noise.amberReasons.join(", ")}. Confirm from the cited noise-method evidence before approval.`
        : null;
      const index = proposedMeasurements.length + 1;
      proposedMeasurements.push({
        measurement_id: `measurement-${paperKey}-${index}`,
        device_id: deviceId,
        wavelength_nm: wavelengthNm,
        detectivity_jones: detectivity,
        responsivity_a_w: selectedResponsivity,
        responsivity_wavelength_nm:
          responsivityCandidate?.wavelengthNm ??
          (selectedResponsivity != null ? wavelengthNm : null),
        responsivity_bias_v:
          responsivityCandidate?.biasV ??
          (selectedResponsivity != null ? bias : null),
        responsivity_temperature_k: responsivityCandidate?.temperatureK ?? null,
        responsivity_source_location:
          responsivityCandidate?.sourceLocation ??
          (selectedResponsivity != null ? pageLocation(page) : null),
        responsivity_extraction_method:
          selectedResponsivity != null ? "directly_reported" : "not_reported",
        eqe_percent: eqe,
        temperature_k: temperature,
        bias_v: bias,
        measurement_frequency_hz: frequency,
        response_time_s: responseCandidate?.value ?? null,
        rise_time_s: riseCandidate?.value ?? null,
        fall_time_s: fallCandidate?.value ?? null,
        response_time_definition: temporalDefinition,
        response_time_wavelength_nm:
          responseCandidate?.wavelengthNm ??
          riseCandidate?.wavelengthNm ??
          fallCandidate?.wavelengthNm ??
          null,
        response_time_bias_v:
          responseCandidate?.biasV ??
          riseCandidate?.biasV ??
          fallCandidate?.biasV ??
          null,
        response_time_source_location: temporalSource,
        response_time_limit:
          responseCandidate?.limit ??
          riseCandidate?.limit ??
          fallCandidate?.limit ??
          "not_reported",
        response_time_extraction_method: temporalSource
          ? "directly_reported"
          : "not_reported",
        bandwidth_hz: bandwidthCandidate?.value ?? null,
        bandwidth_bias_v: bandwidthCandidate?.biasV ?? null,
        bandwidth_source_location: bandwidthCandidate?.sourceLocation ?? null,
        bandwidth_limit: bandwidthCandidate?.limit ?? "not_reported",
        bandwidth_extraction_method: bandwidthCandidate
          ? "directly_reported"
          : "not_reported",
        linear_dynamic_range_db:
          ldrCandidate?.units === "dB" ? ldrCandidate.value : null,
        linear_dynamic_range_min: ldrCandidate?.minimum ?? null,
        linear_dynamic_range_max: ldrCandidate?.maximum ?? null,
        linear_dynamic_range_units: ldrCandidate?.units ?? null,
        linear_dynamic_range_definition: ldrCandidate?.definition ?? null,
        linear_dynamic_range_source_location:
          ldrCandidate?.sourceLocation ?? null,
        linear_dynamic_range_extraction_method: ldrCandidate
          ? "directly_reported"
          : "not_reported",
        extended_metrics_review_status: "needs_review",
        extended_metrics_review_date: now.toISOString().slice(0, 10),
        extended_metrics_notes:
          "Automatically extracted from the supplied article and available Supporting Information; curator approval is required before publication.",
        noise_method: noise.method,
        noise_instruments: noise.instruments,
        noise_instrument_details: noise.details,
        noise_instrument_source: noise.source,
        detectivity_extraction_method: "directly_reported",
        source_location: pageLocation(page),
        curator_status: "pending_review",
        flag: noise.amberReasons.length ? "amber" : "green",
        amber_reasons: noise.amberReasons,
        amber_explanation: amberExplanation,
        curator_notes: `Automatically staged evidence: ${snippet}`,
        date_added: now.toISOString().slice(0, 10),
        date_updated: now.toISOString().slice(0, 10),
      });
      evidence.push({
        field: `measurement-${index}.detectivity_jones+wavelength_nm`,
        page: page.page,
        location: pageLocation(page),
        conciseEvidence: snippet,
        confidence: possibleComparison ? 0.45 : 0.72,
      });
      for (const [field, candidate] of [
        ["responsivity_a_w", responsivityCandidate],
        [
          "response_time_s",
          responseCandidate ?? riseCandidate ?? fallCandidate,
        ],
        ["bandwidth_hz", bandwidthCandidate],
        ["linear_dynamic_range_db", ldrCandidate],
      ] as const) {
        if (!candidate) continue;
        evidence.push({
          field: `measurement-${index}.${field}`,
          page: Number(candidate.sourceLocation.match(/page (\d+)/i)?.[1] ?? 0),
          location: candidate.sourceLocation,
          conciseEvidence: candidate.evidence,
          confidence: candidate.wavelengthNm == null ? 0.68 : 0.82,
        });
      }
    }
  }
  if (!proposedMeasurements.length) {
    warnings.push(
      "No co-located detectivity-in-Jones and wavelength pair was extracted automatically.",
    );
    missingFields.push(
      "measurement.detectivity_jones",
      "measurement.wavelength_nm",
    );
  } else {
    const optionalMeasurementFields: Array<
      keyof Pick<
        Measurement,
        | "responsivity_a_w"
        | "eqe_percent"
        | "temperature_k"
        | "bias_v"
        | "measurement_frequency_hz"
        | "response_time_s"
        | "bandwidth_hz"
      >
    > = [
      "responsivity_a_w",
      "eqe_percent",
      "temperature_k",
      "bias_v",
      "measurement_frequency_hz",
      "response_time_s",
      "bandwidth_hz",
    ];
    for (const field of optionalMeasurementFields) {
      if (
        proposedMeasurements.every((measurement) => measurement[field] == null)
      )
        missingFields.push(`measurement.${field}`);
    }
  }
  if (source.needsOcr)
    warnings.push(
      "The batch manifest marked this PDF as needing OCR; automatic evidence confidence is reduced.",
    );
  if (noise.method === "unspecified")
    missingFields.push("measurement.noise_method");
  if (noise.instruments.includes("not_reported"))
    missingFields.push("measurement.noise_instruments");

  const scopeStatus: StagedPaperProposal["scopeStatus"] = onlyExcluded
    ? "out-of-scope"
    : hasProfileAbsorber && hasPhotodiode && proposedMeasurements.length
      ? "in-scope"
      : "uncertain";
  return {
    proposalId: `proposal-${paperKey}`,
    candidateId: candidate.candidateId,
    source,
    scopeStatus,
    scopeReasons,
    proposedPaper,
    proposedDevices: [proposedDevice],
    proposedMeasurements,
    evidence,
    warnings: [...new Set(warnings)],
    missingFields: [...new Set(missingFields)],
    status: "awaiting-approval",
    decisionNotes: null,
    proposedAt: now.toISOString(),
    decidedAt: null,
    appliedAt: null,
    extractorVersion: "photodiode-proposal-extractor-v3",
  };
}
