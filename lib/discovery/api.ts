import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  CrossrefMetadata,
  DiscoveryConfig,
  OpenAlexWork,
} from "./types.ts";

export interface CachedFetchOptions {
  cacheDirectory: string;
  dryRun?: boolean;
  minimumIntervalMs?: number;
  maxRetries?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
}

let lastRequestAt = 0;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchJsonCached<T>(
  url: string,
  options: CachedFetchOptions,
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const key = createHash("sha256").update(url).digest("hex");
  const file = path.join(options.cacheDirectory, `${key}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const interval = options.minimumIntervalMs ?? 100;
  const remaining = lastRequestAt + interval - Date.now();
  if (remaining > 0) await delay(remaining);
  const maxRetries = options.maxRetries ?? 3;
  let response: Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    lastRequestAt = Date.now();
    response = await fetchImpl(url, {
      headers: {
        "User-Agent": options.userAgent ?? "CQD-Photodiode-Atlas/1.0",
      },
    });
    if (response.ok) break;
    if (response.status !== 429 && response.status < 500) {
      throw new Error(`Request failed (${response.status}) for ${url}`);
    }
    if (attempt < maxRetries) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await delay(
        Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt,
      );
    }
  }
  if (!response?.ok) throw new Error(`Request failed after retries for ${url}`);
  const json = (await response.json()) as T;
  if (!options.dryRun) {
    await mkdir(options.cacheDirectory, { recursive: true });
    await writeFile(file, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  }
  return json;
}

export interface OpenAlexPage {
  results?: OpenAlexWork[];
  meta?: { next_cursor?: string | null };
}

export class OpenAlexClient {
  private readonly config: DiscoveryConfig;
  private readonly cacheDirectory: string;
  private readonly dryRun: boolean;
  private readonly fetchImpl?: typeof fetch;

  constructor(
    config: DiscoveryConfig,
    cacheDirectory: string,
    dryRun = false,
    fetchImpl?: typeof fetch,
  ) {
    this.config = config;
    this.cacheDirectory = cacheDirectory;
    this.dryRun = dryRun;
    this.fetchImpl = fetchImpl;
  }

  private async get(url: URL): Promise<OpenAlexPage> {
    return fetchJsonCached<OpenAlexPage>(url.toString(), {
      cacheDirectory: this.cacheDirectory,
      dryRun: this.dryRun,
      minimumIntervalMs: this.config.openAlex.minimumRequestIntervalMs,
      userAgent: `CQD-Photodiode-Atlas/1.0 (mailto:${this.config.openAlex.mailto})`,
      fetchImpl: this.fetchImpl,
    });
  }

  async search(
    query: string,
    from?: string,
    to?: string,
  ): Promise<OpenAlexWork[]> {
    const works: OpenAlexWork[] = [];
    let cursor = "*";
    for (
      let page = 0;
      page < this.config.openAlex.maxPagesPerQuery;
      page += 1
    ) {
      const url = new URL("/works", this.config.openAlex.baseUrl);
      url.searchParams.set("search", query);
      url.searchParams.set("per-page", String(this.config.openAlex.perPage));
      url.searchParams.set("cursor", cursor);
      if (this.config.openAlex.mailto)
        url.searchParams.set("mailto", this.config.openAlex.mailto);
      const filters: string[] = [];
      if (from) filters.push(`from_publication_date:${from}`);
      if (to) filters.push(`to_publication_date:${to}`);
      if (filters.length) url.searchParams.set("filter", filters.join(","));
      const payload = await this.get(url);
      if (!Array.isArray(payload.results))
        throw new Error(`Malformed OpenAlex results for query: ${query}`);
      works.push(...payload.results);
      const next = payload.meta?.next_cursor;
      if (!next || payload.results.length === 0) break;
      cursor = next;
    }
    return works;
  }

  async worksByFilter(filter: string): Promise<OpenAlexWork[]> {
    const url = new URL("/works", this.config.openAlex.baseUrl);
    url.searchParams.set("filter", filter);
    url.searchParams.set("per-page", String(this.config.openAlex.perPage));
    if (this.config.openAlex.mailto)
      url.searchParams.set("mailto", this.config.openAlex.mailto);
    const payload = await this.get(url);
    if (!Array.isArray(payload.results))
      throw new Error(`Malformed OpenAlex results for filter: ${filter}`);
    return payload.results;
  }

  async workById(id: string): Promise<OpenAlexWork> {
    const shortId = id.replace(/^https?:\/\/openalex\.org\//i, "");
    const url = new URL(
      `/works/${encodeURIComponent(shortId)}`,
      this.config.openAlex.baseUrl,
    );
    if (this.config.openAlex.mailto)
      url.searchParams.set("mailto", this.config.openAlex.mailto);
    const payload = await fetchJsonCached<OpenAlexWork>(url.toString(), {
      cacheDirectory: this.cacheDirectory,
      dryRun: this.dryRun,
      minimumIntervalMs: this.config.openAlex.minimumRequestIntervalMs,
      userAgent: `CQD-Photodiode-Atlas/1.0${this.config.openAlex.mailto ? ` (mailto:${this.config.openAlex.mailto})` : ""}`,
      fetchImpl: this.fetchImpl,
    });
    if (!payload || typeof payload !== "object" || !payload.id) {
      throw new Error(`Malformed OpenAlex work: ${id}`);
    }
    return payload;
  }
}

export class CrossrefClient {
  private readonly config: DiscoveryConfig;
  private readonly cacheDirectory: string;
  private readonly dryRun: boolean;
  private readonly fetchImpl?: typeof fetch;

  constructor(
    config: DiscoveryConfig,
    cacheDirectory: string,
    dryRun = false,
    fetchImpl?: typeof fetch,
  ) {
    this.config = config;
    this.cacheDirectory = cacheDirectory;
    this.dryRun = dryRun;
    this.fetchImpl = fetchImpl;
  }

  async work(doi: string, now = new Date()): Promise<CrossrefMetadata> {
    const url = new URL(
      `/works/${encodeURIComponent(doi)}`,
      this.config.crossref.baseUrl,
    );
    if (this.config.crossref.mailto)
      url.searchParams.set("mailto", this.config.crossref.mailto);
    const payload = await fetchJsonCached<{
      message?: Record<string, unknown>;
    }>(url.toString(), {
      cacheDirectory: this.cacheDirectory,
      dryRun: this.dryRun,
      minimumIntervalMs: this.config.crossref.minimumRequestIntervalMs,
      userAgent: `CQD-Photodiode-Atlas/1.0 (mailto:${this.config.crossref.mailto})`,
      fetchImpl: this.fetchImpl,
    });
    const message = payload.message;
    if (!message || typeof message !== "object")
      throw new Error(`Malformed Crossref response for ${doi}`);
    const title = Array.isArray(message.title)
      ? String(message.title[0] ?? "") || null
      : null;
    const container = Array.isArray(message["container-title"])
      ? String(message["container-title"][0] ?? "") || null
      : null;
    const authors = Array.isArray(message.author)
      ? message.author
          .map((author) => {
            const value = author as { given?: string; family?: string };
            return [value.given, value.family].filter(Boolean).join(" ");
          })
          .filter(Boolean)
      : [];
    const issued = message.issued as { [key: string]: unknown } | undefined;
    const dateParts = issued?.["date-parts"];
    const year =
      Array.isArray(dateParts) && Array.isArray(dateParts[0])
        ? Number(dateParts[0][0])
        : null;
    return {
      title,
      authors,
      publicationYear: Number.isInteger(year) ? year : null,
      journal: container,
      type: typeof message.type === "string" ? message.type : null,
      url: typeof message.URL === "string" ? message.URL : null,
      retrievedAt: now.toISOString(),
    };
  }
}
