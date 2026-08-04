import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  extractStagedProposal,
  normalizeDoi,
  normalizeTitle,
  readProposalRegistry,
  runBatchExtraction,
} from "../discovery/index.ts";
import type {
  BatchManifestPaper,
  ProposalSource,
  StagedPaperProposal,
} from "../discovery/proposal-types.ts";
import type { DiscoveryCandidate } from "../discovery/types.ts";
import { writeTextAtomically } from "../discovery/storage.ts";
import type {
  InboxFileSignature,
  InboxJob,
  InboxLedger,
  InboxReviewPackage,
  InboxRunSummary,
  LocalPaperMetadata,
} from "./types.ts";

const execFileAsync = promisify(execFile);
const DEFAULT_SETTLE_MS = 60_000;
const DEFAULT_CONCURRENCY = 2;
const STATE_DIRECTORY = ".cqd-paper-inbox";
const LEDGER_FILE = "state.json";
const LOCK_FILE = "runner.lock";

export interface InboxPaths {
  root: string;
  incoming: string;
  ready: string;
  attention: string;
  completed: string;
  state: string;
  cache: string;
  ledger: string;
  lock: string;
}

export interface InboxRunOptions {
  repositoryRoot: string;
  inboxRoot: string;
  settleMs?: number;
  concurrency?: number;
  pythonExecutable?: string;
  now?: () => Date;
}

export interface InboxRunnerDependencies {
  processPaper?: typeof processPaper;
}

interface PaperSource {
  sourceKey: string;
  displayName: string;
  mainPdf: string | null;
  supportingPdfs: string[];
  metadataFile: string | null;
  signatures: InboxFileSignature[];
  groupingError: string | null;
}

interface ProcessPaperOptions {
  repositoryRoot: string;
  paths: InboxPaths;
  job: InboxJob;
  pythonExecutable: string;
  now: () => Date;
}

interface ProcessPaperResult {
  proposal: StagedPaperProposal;
  mainPdfSha256: string;
  needsOcr: boolean;
  reviewPackage: InboxReviewPackage;
}

function errorCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : null;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

async function sha256(file: string): Promise<string> {
  const contents = await readFile(file);
  return createHash("sha256").update(contents).digest("hex");
}

function iso(now: () => Date): string {
  return now().toISOString();
}

function humanizeName(value: string): string {
  return value
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSupportingName(file: string): boolean {
  const stem = path.basename(file, path.extname(file));
  return /(?:^|[\s_.-])(?:si|supp|supporting|supplement)(?:$|[\s_.-])/i.test(
    stem,
  );
}

function signatureKey(signatures: InboxFileSignature[]): string {
  return JSON.stringify(
    signatures.map((item) => [
      item.relativePath,
      item.size,
      Math.floor(item.modifiedAtMs),
    ]),
  );
}

function relativePortable(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

async function fileSignature(
  root: string,
  file: string,
): Promise<InboxFileSignature> {
  const details = await stat(file);
  return {
    relativePath: relativePortable(root, file),
    size: details.size,
    modifiedAtMs: details.mtimeMs,
  };
}

async function discoverDirectory(
  paths: InboxPaths,
  directory: string,
): Promise<PaperSource | null> {
  const entries = await readdir(directory, { withFileTypes: true });
  const pdfs = entries
    .filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"),
    )
    .map((entry) => path.join(directory, entry.name))
    .sort();
  if (!pdfs.length) return null;
  const metadataPath = path.join(directory, "metadata.json");
  const hasMetadata = await stat(metadataPath)
    .then((details) => details.isFile())
    .catch(() => false);
  const explicitMain = pdfs.find(
    (file) => path.basename(file).toLowerCase() === "main.pdf",
  );
  const nonSupporting = pdfs.filter((file) => !isSupportingName(file));
  const mainPdf =
    explicitMain ??
    (nonSupporting.length === 1
      ? nonSupporting[0]
      : pdfs.length === 1
        ? pdfs[0]
        : null);
  const supportingPdfs = mainPdf ? pdfs.filter((file) => file !== mainPdf) : [];
  const trackedFiles = [...pdfs, ...(hasMetadata ? [metadataPath] : [])].sort();
  const signatures = await Promise.all(
    trackedFiles.map((file) => fileSignature(paths.root, file)),
  );
  return {
    sourceKey: relativePortable(paths.incoming, directory),
    displayName: humanizeName(path.basename(directory)),
    mainPdf,
    supportingPdfs,
    metadataFile: hasMetadata ? metadataPath : null,
    signatures,
    groupingError: mainPdf
      ? null
      : "Multiple possible main PDFs were found. Rename the article PDF to main.pdf or identify supplements with SI/supporting/supplement in their filenames.",
  };
}

async function discoverSources(paths: InboxPaths): Promise<PaperSource[]> {
  const entries = await readdir(paths.incoming, { withFileTypes: true });
  const sources: PaperSource[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(paths.incoming, entry.name);
    if (entry.isDirectory()) {
      const source = await discoverDirectory(paths, fullPath);
      if (source) sources.push(source);
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".pdf")) continue;
    sources.push({
      sourceKey: entry.name,
      displayName: humanizeName(entry.name),
      mainPdf: fullPath,
      supportingPdfs: [],
      metadataFile: null,
      signatures: [await fileSignature(paths.root, fullPath)],
      groupingError: null,
    });
  }
  return sources;
}

export function inboxPaths(inboxRoot: string): InboxPaths {
  const root = path.resolve(inboxRoot);
  const state = path.join(root, STATE_DIRECTORY);
  return {
    root,
    incoming: path.join(root, "Incoming"),
    ready: path.join(root, "Ready for Review"),
    attention: path.join(root, "Needs Attention"),
    completed: path.join(root, "Completed"),
    state,
    cache: path.join(state, "cache"),
    ledger: path.join(state, LEDGER_FILE),
    lock: path.join(state, LOCK_FILE),
  };
}

export async function initializeInbox(inboxRoot: string): Promise<InboxPaths> {
  const paths = inboxPaths(inboxRoot);
  await Promise.all(
    [
      paths.incoming,
      paths.ready,
      paths.attention,
      paths.completed,
      paths.cache,
    ].map((directory) => mkdir(directory, { recursive: true })),
  );
  try {
    await stat(paths.ledger);
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
    await writeTextAtomically(
      paths.ledger,
      `${JSON.stringify({ schemaVersion: 1, jobs: [] }, null, 2)}\n`,
    );
  }
  return paths;
}

export async function readInboxLedger(paths: InboxPaths): Promise<InboxLedger> {
  const value = JSON.parse(await readFile(paths.ledger, "utf8")) as InboxLedger;
  if (value.schemaVersion !== 1 || !Array.isArray(value.jobs))
    throw new Error(`Unsupported inbox ledger at ${paths.ledger}`);
  return value;
}

async function writeInboxLedger(
  paths: InboxPaths,
  ledger: InboxLedger,
): Promise<void> {
  const ordered = {
    ...ledger,
    jobs: [...ledger.jobs].sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) ||
        left.jobId.localeCompare(right.jobId),
    ),
  };
  await writeTextAtomically(
    paths.ledger,
    `${JSON.stringify(ordered, null, 2)}\n`,
  );
}

async function withInboxLock<T>(
  paths: InboxPaths,
  action: () => Promise<T>,
): Promise<T> {
  try {
    const handle = await open(paths.lock, "wx");
    try {
      await handle.writeFile(
        `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`,
        "utf8",
      );
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (errorCode(error) !== "EEXIST") throw error;
    let ownerPid: number | null = null;
    try {
      const owner = JSON.parse(await readFile(paths.lock, "utf8")) as {
        pid?: unknown;
      };
      if (typeof owner.pid === "number") ownerPid = owner.pid;
    } catch {
      // A malformed lock is handled as stale below.
    }
    if (ownerPid) {
      try {
        process.kill(ownerPid, 0);
        throw new Error(
          `The paper inbox is already being processed by PID ${ownerPid}`,
        );
      } catch (error) {
        if (errorCode(error) !== "ESRCH") throw error;
      }
    }
    await unlink(paths.lock);
    return withInboxLock(paths, action);
  }

  try {
    return await action();
  } finally {
    await unlink(paths.lock).catch((error) => {
      if (errorCode(error) !== "ENOENT") throw error;
    });
  }
}

async function writeAttentionNote(
  paths: InboxPaths,
  job: InboxJob,
): Promise<string> {
  const file = path.join(paths.attention, `${job.jobId}.md`);
  const text = `# ${job.displayName}\n\nStatus: needs attention\n\nSource: ${job.sourceKey}\n\n${job.error ?? "The paper could not be processed."}\n`;
  await writeTextAtomically(file, text);
  return file;
}

function materialClasses(text: string): string[] {
  const patterns: Array<[string, RegExp]> = [
    ["PbS", /\bPbS\b/i],
    ["PbSe", /\bPbSe\b/i],
    ["HgTe", /\bHgTe\b/i],
    ["Ag2Te", /\bAg2Te\b/i],
    ["InAs", /\bInAs\b/i],
    ["MAPbI3", /\b(?:MAPbI3|CH3NH3PbI3)\b/i],
    ["CsPbBr3", /\bCsPbBr3\b/i],
  ];
  const matches = patterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
  return matches.length ? matches : ["Other CQDs"];
}

function extractDoi(text: string): string | null {
  const match = text.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i);
  return normalizeDoi(match?.[0]?.replace(/[.,;:)]+$/, "") ?? null);
}

function extractYear(text: string): number | null {
  const current = new Date().getUTCFullYear() + 1;
  const match = text
    .slice(0, 12_000)
    .match(
      /\b(?:copyright|©|published(?:\s+online)?|publication)\D{0,30}((?:19|20)\d{2})\b/i,
    );
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1900 && year <= current ? year : null;
}

async function readLocalMetadata(
  file: string | null,
): Promise<LocalPaperMetadata> {
  if (!file) return {};
  const value = JSON.parse(await readFile(file, "utf8")) as LocalPaperMetadata;
  if (value.authors !== undefined && !Array.isArray(value.authors))
    throw new Error("metadata.json authors must be an array of names");
  if (
    value.technologyFamily !== undefined &&
    value.technologyFamily !== "cqd" &&
    value.technologyFamily !== "perovskite"
  )
    throw new Error("metadata.json technologyFamily must be cqd or perovskite");
  return value;
}

function localCandidate(
  job: InboxJob,
  digest: string,
  text: string,
  metadata: LocalPaperMetadata,
  now: () => Date,
): DiscoveryCandidate {
  const doi = normalizeDoi(metadata.doi) ?? extractDoi(text);
  const technologyFamily =
    metadata.technologyFamily ??
    (/\b(?:metal[\s-]halide |lead[\s-]halide )?perovskite\b/i.test(text) &&
    !/\bcolloidal quantum dot\b/i.test(text)
      ? "perovskite"
      : "cqd");
  const title = metadata.title?.trim() || job.displayName;
  const publicationUrl =
    metadata.publicationUrl?.trim() || (doi ? `https://doi.org/${doi}` : null);
  const timestamp = iso(now);
  return {
    candidateId: `local-${digest.slice(0, 16)}`,
    doi,
    normalizedDoi: doi,
    title,
    normalizedTitle: normalizeTitle(title),
    authors: metadata.authors ?? [],
    publicationYear: metadata.publicationYear ?? extractYear(text),
    journal: metadata.journal ?? null,
    abstract: null,
    openAlexId: null,
    crossrefMetadata: null,
    publicationUrl,
    openAccessPdfUrl: null,
    openAccessPdfSource: "Local watched folder",
    discoverySources: ["local-watched-folder"],
    discoveryQueries: [],
    seedPaperIds: [],
    discoveryMethods: [],
    technologyFamilies: [technologyFamily],
    candidateMaterialClasses: metadata.materialClasses?.length
      ? metadata.materialClasses
      : materialClasses(text),
    candidateDeviceType: null,
    candidateSpectralRegions: [],
    relevanceScore: 0,
    relevanceReasons: [
      "User supplied the paper through the local watched folder.",
    ],
    screeningStatus: "include",
    exclusionReason: null,
    screeningNotes:
      "Local watched-folder proposal; scientific review is required.",
    pdfStatus: "acquired",
    importStatus: "queued",
    dateDiscovered: timestamp.slice(0, 10),
    lastMetadataRefresh: timestamp,
    duplicateRelationships: [],
    manualOverrides: {},
  };
}

function manifestRecord(
  records: BatchManifestPaper[],
  digest: string,
): BatchManifestPaper {
  const record = records.find((item) => item.sha256 === digest);
  if (!record) throw new Error("The extraction manifest omitted an input PDF");
  if (record.error) throw new Error(record.error);
  if (!record.text_path)
    throw new Error("The extraction manifest did not provide extracted text");
  return record;
}

function stableLocalSourceUrl(digest: string): string {
  return `file:///local-watched-folder/${digest}.pdf`;
}

export async function processPaper(
  options: ProcessPaperOptions,
): Promise<ProcessPaperResult> {
  const { job, paths, repositoryRoot, pythonExecutable, now } = options;
  if (!job.mainPdf) throw new Error("The job has no main PDF");
  const mainDigest = await sha256(job.mainPdf);
  const supportDigests = await Promise.all(job.supportingPdfs.map(sha256));
  const extractionDirectory = path.join(paths.cache, job.jobId, "extraction");
  await mkdir(extractionDirectory, { recursive: true });
  const manifest = await runBatchExtraction(
    pythonExecutable,
    path.join(repositoryRoot, "scripts/batch_extract.py"),
    extractionDirectory,
    [job.mainPdf, ...job.supportingPdfs],
  );
  const mainRecord = manifestRecord(manifest.papers, mainDigest);
  const mainText = await readFile(mainRecord.text_path!, "utf8");
  const supportingDocuments = await Promise.all(
    supportDigests.map(async (digest, index) => {
      const record = manifestRecord(manifest.papers, digest);
      return {
        label: `Supporting Information${supportDigests.length > 1 ? ` ${index + 1}` : ""}`,
        markedText: await readFile(record.text_path!, "utf8"),
        record,
        digest,
      };
    }),
  );
  const metadata = await readLocalMetadata(job.metadataFile);
  const candidate = localCandidate(job, mainDigest, mainText, metadata, now);
  const mainDetails = await stat(job.mainPdf);
  const source: ProposalSource = {
    url: candidate.publicationUrl ?? stableLocalSourceUrl(mainDigest),
    openAccessSource: "User-supplied local PDF",
    pdfSha256: mainDigest,
    acquiredAt: iso(now),
    contentType: "application/pdf",
    byteLength: mainDetails.size,
    extractionEngine: mainRecord.extraction_engine ?? "unknown",
    pageCount: mainRecord.page_count ?? 0,
    needsOcr: mainRecord.needs_ocr ?? false,
    supportingDocuments: supportingDocuments.map(({ record, digest }) => ({
      url: stableLocalSourceUrl(digest),
      pdfSha256: digest,
      extractionEngine: record.extraction_engine ?? "unknown",
      pageCount: record.page_count ?? 0,
      needsOcr: record.needs_ocr ?? false,
    })),
  };
  const proposal = extractStagedProposal(
    candidate,
    source,
    mainText,
    now(),
    supportingDocuments.map(({ label, markedText }) => ({
      label,
      markedText,
    })),
  );
  const extraWarnings: string[] = [];
  if (!metadata.title)
    extraWarnings.push(
      "Bibliographic title came from the folder or filename; confirm it during review or add metadata.json.",
    );
  if (!metadata.authors?.length)
    extraWarnings.push(
      "Authors were not supplied in metadata.json and require curator completion.",
    );
  if (!metadata.publicationYear)
    extraWarnings.push(
      "Publication year was not supplied in metadata.json; confirm any automatically inferred value.",
    );
  proposal.warnings = [...new Set([...proposal.warnings, ...extraWarnings])];
  const reviewPackage: InboxReviewPackage = {
    schemaVersion: 1,
    job: {
      jobId: job.jobId,
      sourceKey: job.sourceKey,
      displayName: job.displayName,
      mainPdf: job.mainPdf,
      supportingPdfs: job.supportingPdfs,
      processedAt: iso(now),
    },
    proposal,
  };
  return {
    proposal,
    mainPdfSha256: mainDigest,
    needsOcr:
      source.needsOcr ||
      Boolean(source.supportingDocuments?.some((item) => item.needsOcr)),
    reviewPackage,
  };
}

function summaryMarkdown(review: InboxReviewPackage): string {
  const { job, proposal } = review;
  const warningLines = proposal.warnings.length
    ? proposal.warnings.map((warning) => `- ${warning}`).join("\n")
    : "- None";
  const measurements = proposal.proposedMeasurements.length
    ? proposal.proposedMeasurements
        .map(
          (measurement) =>
            `- ${measurement.measurement_id}: ${measurement.wavelength_nm} nm, D* ${measurement.detectivity_jones.toExponential(3)} Jones, ${measurement.noise_method}, ${measurement.source_location ?? "source location missing"}`,
        )
        .join("\n")
    : "- No measurement candidates were extracted.";
  return `# ${proposal.proposedPaper.title}\n\nStatus: ready for human review\n\nJob: ${job.jobId}\nSource: ${job.sourceKey}\nScope: ${proposal.scopeStatus}\nDevices: ${proposal.proposedDevices.length}\nMeasurements: ${proposal.proposedMeasurements.length}\nNeeds OCR: ${proposal.source.needsOcr ? "yes" : "no"}\n\n## Warnings\n\n${warningLines}\n\n## Measurement candidates\n\n${measurements}\n\nThe proposal is not published and must be checked against the main article and supplied Supporting Information before approval.\n`;
}

async function processQueuedJob(
  options: InboxRunOptions,
  paths: InboxPaths,
  job: InboxJob,
  processImpl: typeof processPaper,
  knownHashes: Map<string, string>,
): Promise<InboxJob> {
  const now = options.now ?? (() => new Date());
  const startedAt = iso(now);
  const processing: InboxJob = {
    ...job,
    status: "processing",
    stage: "hashing-and-extraction",
    attempts: job.attempts + 1,
    error: null,
    updatedAt: startedAt,
  };
  try {
    if (!processing.mainPdf)
      throw new Error("No main PDF was identified for this job");
    const digest = await sha256(processing.mainPdf);
    const duplicateOf = knownHashes.get(digest);
    if (duplicateOf && duplicateOf !== processing.jobId) {
      return {
        ...processing,
        mainPdfSha256: digest,
        duplicateOf,
        status: "duplicate",
        stage: "complete",
        updatedAt: iso(now),
        completedAt: iso(now),
      };
    }
    knownHashes.set(digest, processing.jobId);
    const result = await processImpl({
      repositoryRoot: options.repositoryRoot,
      paths,
      job: processing,
      pythonExecutable:
        options.pythonExecutable ?? process.env.PYTHON ?? "python3",
      now,
    });
    const proposalFile = path.join(
      paths.ready,
      `${processing.jobId}.proposal.json`,
    );
    const summaryFile = path.join(paths.ready, `${processing.jobId}.md`);
    await writeTextAtomically(
      proposalFile,
      `${JSON.stringify(result.reviewPackage, null, 2)}\n`,
    );
    await writeTextAtomically(
      summaryFile,
      summaryMarkdown(result.reviewPackage),
    );
    return {
      ...processing,
      mainPdfSha256: result.mainPdfSha256,
      status: "ready-for-review",
      stage: "complete",
      proposalFile,
      summaryFile,
      needsOcr: result.needsOcr,
      updatedAt: iso(now),
      completedAt: iso(now),
    };
  } catch (error) {
    const failed: InboxJob = {
      ...processing,
      status: "needs-attention",
      stage: "failed",
      error: (error as Error).message,
      updatedAt: iso(now),
      completedAt: iso(now),
    };
    failed.summaryFile = await writeAttentionNote(paths, failed);
    return failed;
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), values.length) },
    async () => {
      while (true) {
        const index = next;
        next += 1;
        if (index >= values.length) return;
        results[index] = await mapper(values[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function runSummary(paths: InboxPaths, jobs: InboxJob[]): InboxRunSummary {
  const count = (status: InboxJob["status"]) =>
    jobs.filter((job) => job.status === status).length;
  return {
    inbox: paths.root,
    discovered: jobs.length,
    processed:
      count("ready-for-review") + count("needs-attention") + count("duplicate"),
    readyForReview: count("ready-for-review"),
    duplicates: count("duplicate"),
    needsAttention: count("needs-attention"),
    settling: count("settling") + count("queued"),
    missing: count("missing"),
  };
}

async function existingProposalHashes(
  repositoryRoot: string,
): Promise<Map<string, string>> {
  try {
    const registry = await readProposalRegistry(
      path.join(repositoryRoot, "data/discovery/proposals.json"),
    );
    return new Map(
      registry.proposals.map((proposal) => [
        proposal.source.pdfSha256,
        proposal.proposalId,
      ]),
    );
  } catch {
    return new Map();
  }
}

export async function runInboxOnce(
  options: InboxRunOptions,
  dependencies: InboxRunnerDependencies = {},
): Promise<InboxRunSummary> {
  const paths = await initializeInbox(options.inboxRoot);
  return withInboxLock(paths, async () => {
    const now = options.now ?? (() => new Date());
    const settleMs = options.settleMs ?? DEFAULT_SETTLE_MS;
    const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
    if (!Number.isFinite(settleMs) || settleMs < 0)
      throw new Error("settleMs must be a nonnegative number");
    if (!Number.isInteger(concurrency) || concurrency < 1)
      throw new Error("concurrency must be a positive integer");
    const ledger = await readInboxLedger(paths);
    const discovered = await discoverSources(paths);
    const bySource = new Map(ledger.jobs.map((job) => [job.sourceKey, job]));
    const present = new Set(discovered.map((source) => source.sourceKey));
    const currentTime = iso(now);

    for (const source of discovered) {
      const key = signatureKey(source.signatures);
      const existing = bySource.get(source.sourceKey);
      const groupingStatus = source.groupingError
        ? ("needs-attention" as const)
        : ("settling" as const);
      if (!existing) {
        const job: InboxJob = {
          jobId: `inbox-${shortHash(source.sourceKey)}`,
          sourceKey: source.sourceKey,
          displayName: source.displayName,
          mainPdf: source.mainPdf,
          supportingPdfs: source.supportingPdfs,
          metadataFile: source.metadataFile,
          signatures: source.signatures,
          signatureKey: key,
          lastChangedAt: currentTime,
          status: groupingStatus,
          stage: source.groupingError ? "grouping" : "settling",
          attempts: 0,
          mainPdfSha256: null,
          duplicateOf: null,
          proposalFile: null,
          summaryFile: null,
          needsOcr: null,
          error: source.groupingError,
          discoveredAt: currentTime,
          updatedAt: currentTime,
          completedAt: null,
        };
        if (source.groupingError)
          job.summaryFile = await writeAttentionNote(paths, job);
        ledger.jobs.push(job);
        bySource.set(source.sourceKey, job);
        continue;
      }
      if (existing.signatureKey !== key) {
        Object.assign(existing, {
          displayName: source.displayName,
          mainPdf: source.mainPdf,
          supportingPdfs: source.supportingPdfs,
          metadataFile: source.metadataFile,
          signatures: source.signatures,
          signatureKey: key,
          lastChangedAt: currentTime,
          status: groupingStatus,
          stage: source.groupingError ? "grouping" : "settling",
          mainPdfSha256: null,
          duplicateOf: null,
          proposalFile: null,
          summaryFile: null,
          needsOcr: null,
          error: source.groupingError,
          updatedAt: currentTime,
          completedAt: null,
        });
        if (source.groupingError)
          existing.summaryFile = await writeAttentionNote(paths, existing);
      } else if (
        existing.status === "settling" &&
        now().getTime() - new Date(existing.lastChangedAt).getTime() >= settleMs
      ) {
        existing.status = "queued";
        existing.stage = "queued";
        existing.updatedAt = currentTime;
      }
    }

    for (const job of ledger.jobs) {
      if (!present.has(job.sourceKey) && job.status !== "missing") {
        job.status = "missing";
        job.stage = "source-missing";
        job.error = "The source PDF or paper folder is no longer in Incoming.";
        job.updatedAt = currentTime;
      }
    }

    await writeInboxLedger(paths, ledger);
    const knownHashes = await existingProposalHashes(options.repositoryRoot);
    for (const job of ledger.jobs) {
      if (job.mainPdfSha256 && !knownHashes.has(job.mainPdfSha256))
        knownHashes.set(job.mainPdfSha256, job.jobId);
    }
    const queued = ledger.jobs.filter((job) => job.status === "queued");
    const processed = await mapWithConcurrency(queued, concurrency, (job) =>
      processQueuedJob(
        options,
        paths,
        job,
        dependencies.processPaper ?? processPaper,
        knownHashes,
      ),
    );
    const processedById = new Map(processed.map((job) => [job.jobId, job]));
    ledger.jobs = ledger.jobs.map((job) => processedById.get(job.jobId) ?? job);
    await writeInboxLedger(paths, ledger);
    return runSummary(paths, ledger.jobs);
  });
}

export async function retryInboxJob(
  inboxRoot: string,
  jobId: string,
): Promise<void> {
  const paths = await initializeInbox(inboxRoot);
  await withInboxLock(paths, async () => {
    const ledger = await readInboxLedger(paths);
    const job = ledger.jobs.find((item) => item.jobId === jobId);
    if (!job) throw new Error(`Inbox job not found: ${jobId}`);
    if (!job.mainPdf) throw new Error(`Inbox job has no main PDF: ${jobId}`);
    job.status = "queued";
    job.stage = "queued";
    job.error = null;
    job.completedAt = null;
    job.updatedAt = new Date().toISOString();
    await writeInboxLedger(paths, ledger);
  });
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function installLaunchAgent(options: {
  repositoryRoot: string;
  inboxRoot: string;
  intervalSeconds?: number;
  settleSeconds?: number;
  concurrency?: number;
  pythonExecutable?: string;
}): Promise<string> {
  if (process.platform !== "darwin")
    throw new Error("The launch agent installer is available only on macOS");
  const paths = await initializeInbox(options.inboxRoot);
  const interval = options.intervalSeconds ?? 60;
  const settle = options.settleSeconds ?? 60;
  const concurrency = options.concurrency ?? 2;
  const label = "com.cqd-photodiode-atlas.paper-inbox";
  const launchAgents = path.join(os.homedir(), "Library", "LaunchAgents");
  await mkdir(launchAgents, { recursive: true });
  const plist = path.join(launchAgents, `${label}.plist`);
  const script = path.join(options.repositoryRoot, "scripts/inbox.ts");
  const log = path.join(paths.state, "runner.log");
  const args = [
    process.execPath,
    "--experimental-strip-types",
    script,
    "once",
    `--inbox=${paths.root}`,
    `--settle-seconds=${settle}`,
    `--concurrency=${concurrency}`,
    ...(options.pythonExecutable
      ? [`--python=${options.pythonExecutable}`]
      : []),
  ];
  const argumentXml = args
    .map((argument) => `      <string>${xmlEscape(argument)}</string>`)
    .join("\n");
  const pathValue =
    process.env.PATH ?? "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";
  const contents = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${label}</string>
    <key>ProgramArguments</key>
    <array>
${argumentXml}
    </array>
    <key>WorkingDirectory</key>
    <string>${xmlEscape(options.repositoryRoot)}</string>
    <key>EnvironmentVariables</key>
    <dict>
      <key>PATH</key>
      <string>${xmlEscape(pathValue)}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>StartInterval</key>
    <integer>${interval}</integer>
    <key>StandardOutPath</key>
    <string>${xmlEscape(log)}</string>
    <key>StandardErrorPath</key>
    <string>${xmlEscape(log)}</string>
  </dict>
</plist>
`;
  await writeFile(plist, contents, "utf8");
  const domain = `gui/${process.getuid?.() ?? 0}`;
  await execFileAsync("launchctl", ["bootout", domain, plist]).catch(() => {});
  await execFileAsync("launchctl", ["bootstrap", domain, plist]);
  return plist;
}

export async function uninstallLaunchAgent(): Promise<string> {
  if (process.platform !== "darwin")
    throw new Error("The launch agent installer is available only on macOS");
  const label = "com.cqd-photodiode-atlas.paper-inbox";
  const plist = path.join(
    os.homedir(),
    "Library",
    "LaunchAgents",
    `${label}.plist`,
  );
  const domain = `gui/${process.getuid?.() ?? 0}`;
  await execFileAsync("launchctl", ["bootout", domain, plist]).catch(() => {});
  await unlink(plist).catch((error) => {
    if (errorCode(error) !== "ENOENT") throw error;
  });
  return plist;
}
