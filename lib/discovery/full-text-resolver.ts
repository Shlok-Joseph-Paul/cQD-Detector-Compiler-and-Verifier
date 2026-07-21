import path from "node:path";
import { fetchJsonCached, OpenAlexClient } from "./api.ts";
import type {
  DiscoveryCandidate,
  DiscoveryConfig,
  OpenAlexWork,
} from "./types.ts";

export interface OpenAccessPdfLocation {
  url: string;
  source: string;
}

export interface OpenAccessResolution {
  locations: OpenAccessPdfLocation[];
  warnings: string[];
}

export interface OpenAccessResolutionOptions {
  config: DiscoveryConfig;
  cacheDirectory: string;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
}

interface UnpaywallLocation {
  host_type?: string | null;
  url?: string | null;
  url_for_pdf?: string | null;
  version?: string | null;
}

interface UnpaywallResponse {
  best_oa_location?: UnpaywallLocation | null;
  oa_locations?: UnpaywallLocation[] | null;
}

function manualLocation(
  candidate: DiscoveryCandidate,
): OpenAccessPdfLocation | null {
  const url = candidate.manualOverrides.openAccessPdfUrl;
  if (typeof url !== "string" || !url.trim()) return null;
  const source = candidate.manualOverrides.openAccessPdfSource;
  return {
    url: url.trim(),
    source:
      typeof source === "string" && source.trim()
        ? source.trim()
        : "Curator-provided open-access location",
  };
}

function openAlexLocations(work: OpenAlexWork): OpenAccessPdfLocation[] {
  const candidates: Array<OpenAccessPdfLocation | null> = [
    work.best_oa_location?.pdf_url
      ? {
          url: work.best_oa_location.pdf_url,
          source:
            work.best_oa_location.source?.display_name ??
            "OpenAlex best open-access location",
        }
      : null,
    work.primary_location?.pdf_url
      ? {
          url: work.primary_location.pdf_url,
          source:
            work.primary_location.source?.display_name ??
            "OpenAlex primary location",
        }
      : null,
  ];
  return candidates.filter(
    (candidate): candidate is OpenAccessPdfLocation => candidate !== null,
  );
}

function unpaywallLocations(
  payload: UnpaywallResponse,
): OpenAccessPdfLocation[] {
  const ordered = [
    payload.best_oa_location,
    ...(payload.oa_locations ?? []),
  ].filter((location): location is UnpaywallLocation => Boolean(location));
  return ordered.flatMap((location) => {
    const url =
      location.url_for_pdf ??
      (location.url && /\.pdf(?:$|[?#])/i.test(location.url)
        ? location.url
        : null);
    if (!url) return [];
    const details = [location.host_type, location.version]
      .filter(Boolean)
      .join(", ");
    return [
      {
        url,
        source: details ? `Unpaywall (${details})` : "Unpaywall",
      },
    ];
  });
}

function uniqueLocations(
  locations: readonly OpenAccessPdfLocation[],
): OpenAccessPdfLocation[] {
  const seen = new Set<string>();
  return locations.filter((location) => {
    const normalized = location.url.trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/**
 * Finds lawful, unauthenticated PDF candidates. Every returned URL must still
 * pass acquireOpenAccessPdf(), which verifies the response and safety limits.
 */
export async function resolveOpenAccessPdfLocations(
  candidate: DiscoveryCandidate,
  options: OpenAccessResolutionOptions,
): Promise<OpenAccessResolution> {
  const locations: OpenAccessPdfLocation[] = [];
  const warnings: string[] = [];
  const manual = manualLocation(candidate);
  if (manual) locations.push(manual);
  if (candidate.openAccessPdfUrl) {
    locations.push({
      url: candidate.openAccessPdfUrl,
      source: candidate.openAccessPdfSource ?? "Recorded open-access location",
    });
  }

  if (candidate.openAlexId) {
    try {
      const client = new OpenAlexClient(
        options.config,
        path.join(options.cacheDirectory, "openalex"),
        options.dryRun ?? false,
        options.fetchImpl,
      );
      locations.push(
        ...openAlexLocations(await client.workById(candidate.openAlexId)),
      );
    } catch (error) {
      warnings.push(`OpenAlex refresh failed: ${(error as Error).message}`);
    }
  }

  if (candidate.normalizedDoi && options.config.unpaywall) {
    const unpaywall = options.config.unpaywall;
    try {
      const url = new URL(
        `${unpaywall.baseUrl.replace(/\/$/, "")}/${encodeURIComponent(candidate.normalizedDoi)}`,
      );
      url.searchParams.set("email", unpaywall.email);
      const payload = await fetchJsonCached<UnpaywallResponse>(url.toString(), {
        cacheDirectory: path.join(options.cacheDirectory, "unpaywall"),
        dryRun: options.dryRun,
        minimumIntervalMs: unpaywall.minimumRequestIntervalMs,
        userAgent: `CQD-Photodiode-Atlas/1.0 (mailto:${unpaywall.email})`,
        fetchImpl: options.fetchImpl,
        maxCacheAgeMs: 24 * 60 * 60 * 1000,
      });
      locations.push(...unpaywallLocations(payload));
    } catch (error) {
      warnings.push(`Unpaywall resolution failed: ${(error as Error).message}`);
    }
  }

  return { locations: uniqueLocations(locations), warnings };
}
