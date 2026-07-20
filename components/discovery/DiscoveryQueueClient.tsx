"use client";

import { useMemo, useState } from "react";
import type {
  DiscoveryCandidate,
  ScreeningStatus,
} from "@/lib/discovery/types";

interface LocalDecision {
  screeningStatus: ScreeningStatus;
  exclusionReason: string;
  screeningNotes: string;
}

const STORAGE_KEY = "cqd-atlas-discovery-decisions-v1";
const statuses: ScreeningStatus[] = [
  "unreviewed",
  "include",
  "exclude",
  "uncertain",
];

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function countBy(values: string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
}

export function DiscoveryQueueClient({
  candidates,
}: {
  candidates: DiscoveryCandidate[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ScreeningStatus | "all">("all");
  const [material, setMaterial] = useState("all");
  const [sort, setSort] = useState("score-desc");
  const [decisions, setDecisions] = useState<Record<string, LocalDecision>>(
    () => {
      if (typeof window === "undefined") return {};
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        return stored
          ? (JSON.parse(stored) as Record<string, LocalDecision>)
          : {};
      } catch {
        // Browser-local screening remains optional if storage is unavailable.
        return {};
      }
    },
  );

  const effective = useMemo(
    () =>
      candidates.map((candidate) => ({
        ...candidate,
        ...(decisions[candidate.candidateId] ?? {}),
      })),
    [candidates, decisions],
  );
  const materials = useMemo(
    () =>
      [
        ...new Set(
          candidates.flatMap((candidate) => candidate.candidateMaterialClasses),
        ),
      ].sort(),
    [candidates],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return effective
      .filter(
        (candidate) => status === "all" || candidate.screeningStatus === status,
      )
      .filter(
        (candidate) =>
          material === "all" ||
          candidate.candidateMaterialClasses.includes(material),
      )
      .filter(
        (candidate) =>
          !query ||
          [
            candidate.title,
            candidate.doi,
            candidate.journal,
            candidate.authors.join(" "),
            candidate.abstract,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query),
      )
      .sort((left, right) => {
        if (sort === "score-asc")
          return left.relevanceScore - right.relevanceScore;
        if (sort === "year-desc")
          return (right.publicationYear ?? 0) - (left.publicationYear ?? 0);
        if (sort === "year-asc")
          return (left.publicationYear ?? 0) - (right.publicationYear ?? 0);
        return right.relevanceScore - left.relevanceScore;
      });
  }, [effective, material, search, sort, status]);
  const statusCounts = Object.fromEntries(
    statuses.map((value) => [
      value,
      effective.filter((candidate) => candidate.screeningStatus === value)
        .length,
    ]),
  );
  const materialCounts = countBy(
    effective.flatMap((candidate) => candidate.candidateMaterialClasses),
  );
  const yearCounts = countBy(
    effective.map((candidate) =>
      String(candidate.publicationYear ?? "Unknown"),
    ),
  ).sort((a, b) => a[0].localeCompare(b[0]));
  const maxMaterial = Math.max(1, ...materialCounts.map((entry) => entry[1]));
  const maxYear = Math.max(1, ...yearCounts.map((entry) => entry[1]));

  function updateDecision(
    candidate: DiscoveryCandidate,
    patch: Partial<LocalDecision>,
  ) {
    const current = decisions[candidate.candidateId] ?? {
      screeningStatus: candidate.screeningStatus,
      exclusionReason: candidate.exclusionReason ?? "",
      screeningNotes: candidate.screeningNotes ?? "",
    };
    const next = {
      ...decisions,
      [candidate.candidateId]: { ...current, ...patch },
    };
    setDecisions(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* optional */
    }
  }

  function exportDecisions() {
    const header = [
      "candidate_id",
      "doi",
      "title",
      "publication_year",
      "journal",
      "materials",
      "device_type",
      "spectral_regions",
      "relevance_score",
      "relevance_reasons",
      "duplicate_warnings",
      "screening_status",
      "exclusion_reason",
      "screening_notes",
      "pdf_status",
      "import_status",
    ];
    const rows = effective.map((candidate) => [
      candidate.candidateId,
      candidate.doi,
      candidate.title,
      candidate.publicationYear,
      candidate.journal,
      candidate.candidateMaterialClasses.join("|"),
      candidate.candidateDeviceType,
      candidate.candidateSpectralRegions.join("|"),
      candidate.relevanceScore,
      candidate.relevanceReasons.join("|"),
      candidate.duplicateRelationships
        .map((item) => `${item.type}:${item.candidateId}`)
        .join("|"),
      candidate.screeningStatus,
      candidate.exclusionReason,
      candidate.screeningNotes,
      candidate.pdfStatus,
      candidate.importStatus,
    ]);
    const blob = new Blob(
      [
        [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") +
          "\n",
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "cqd-discovery-screening.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <section
        className="discovery-stat-grid"
        aria-label="Candidate screening totals"
      >
        <article>
          <span>Total candidates</span>
          <strong>{effective.length}</strong>
          <small>separate from the published atlas</small>
        </article>
        {statuses.map((value) => (
          <article key={value}>
            <span>{value}</span>
            <strong>{statusCounts[value]}</strong>
            <small>
              {value === "unreviewed"
                ? "awaiting human screening"
                : "local or committed decisions"}
            </small>
          </article>
        ))}
      </section>

      <div className="discovery-overview">
        <section className="discovery-panel">
          <p className="section-kicker">Material profile</p>
          <h2>Candidates by material</h2>
          <div className="discovery-mini-bars">
            {materialCounts.length ? (
              materialCounts.map(([label, count]) => (
                <div key={label}>
                  <span>{label}</span>
                  <i>
                    <b style={{ width: `${(count / maxMaterial) * 100}%` }} />
                  </i>
                  <strong>{count}</strong>
                </div>
              ))
            ) : (
              <p>No candidates have been discovered yet.</p>
            )}
          </div>
        </section>
        <section className="discovery-panel">
          <p className="section-kicker">Publication timeline</p>
          <h2>Candidates by year</h2>
          <div className="discovery-year-bars">
            {yearCounts.length ? (
              yearCounts.map(([label, count]) => (
                <div key={label}>
                  <strong>{count}</strong>
                  <i style={{ height: `${18 + (count / maxYear) * 70}px` }} />
                  <span>{label}</span>
                </div>
              ))
            ) : (
              <p>No candidate years are available.</p>
            )}
          </div>
        </section>
      </div>

      <section className="discovery-workspace">
        <header className="discovery-toolbar">
          <div>
            <p className="section-kicker">Human screening</p>
            <h2>Candidate registry</h2>
            <p>{filtered.length} shown</p>
          </div>
          <div className="discovery-toolbar__actions">
            <button
              className="primary-button"
              type="button"
              onClick={exportDecisions}
            >
              Export screening CSV
            </button>
          </div>
        </header>
        <p className="discovery-local-note">
          <strong>Local review only.</strong> Decisions made here stay in this
          browser until you export the CSV and commit an imported registry
          update. They never publish a paper to the atlas.
        </p>
        <div className="discovery-filters">
          <label>
            Search
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Title, DOI, author, abstract…"
            />
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as typeof status)
              }
            >
              <option value="all">All statuses</option>
              {statuses.map((value) => (
                <option value={value} key={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Material
            <select
              value={material}
              onChange={(event) => setMaterial(event.target.value)}
            >
              <option value="all">All materials</option>
              {materials.map((value) => (
                <option value={value} key={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="score-desc">Score, high to low</option>
              <option value="score-asc">Score, low to high</option>
              <option value="year-desc">Newest first</option>
              <option value="year-asc">Oldest first</option>
            </select>
          </label>
        </div>
        <div className="discovery-cards">
          {filtered.map((candidate) => (
            <article className="discovery-card" key={candidate.candidateId}>
              <div className="discovery-card__score">
                <strong>{candidate.relevanceScore}</strong>
                <span>relevance</span>
              </div>
              <div className="discovery-card__body">
                <div className="discovery-card__meta">
                  <span>
                    {candidate.publicationYear ?? "Year not reported"}
                  </span>
                  <span>{candidate.journal ?? "Source not reported"}</span>
                  {candidate.candidateMaterialClasses.map((value) => (
                    <span className="discovery-chip" key={value}>
                      {value}
                    </span>
                  ))}
                </div>
                <h3>{candidate.title}</h3>
                <p className="discovery-authors">
                  {candidate.authors.length
                    ? candidate.authors.join(", ")
                    : "Authors not reported"}
                </p>
                <div className="discovery-links">
                  {candidate.publicationUrl && (
                    <a
                      href={candidate.publicationUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Publication ↗
                    </a>
                  )}
                  {candidate.doi && (
                    <a
                      href={`https://doi.org/${candidate.normalizedDoi}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      DOI ↗
                    </a>
                  )}
                  {candidate.openAccessPdfUrl && (
                    <a
                      href={candidate.openAccessPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open-access PDF ↗
                    </a>
                  )}
                </div>
                <div className="discovery-reasons">
                  <strong>Why it ranked here</strong>
                  <ul>
                    {candidate.relevanceReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
                {candidate.duplicateRelationships.length > 0 && (
                  <p className="discovery-warning">
                    <strong>Possible duplicate:</strong>{" "}
                    {candidate.duplicateRelationships
                      .map(
                        (item) =>
                          `${item.candidateId} (${item.type}${item.similarity ? `, ${Math.round(item.similarity * 100)}%` : ""})`,
                      )
                      .join(", ")}
                  </p>
                )}
                <dl className="discovery-details">
                  <div>
                    <dt>Discovery</dt>
                    <dd>
                      {candidate.discoveryMethods.join(", ")} ·{" "}
                      {candidate.discoverySources.join(", ")}
                    </dd>
                  </div>
                  <div>
                    <dt>Query / seed</dt>
                    <dd>
                      {[
                        ...candidate.discoveryQueries,
                        ...candidate.seedPaperIds,
                      ].join(" · ") || "Not recorded"}
                    </dd>
                  </div>
                  <div>
                    <dt>PDF</dt>
                    <dd>{candidate.pdfStatus}</dd>
                  </div>
                  <div>
                    <dt>Import</dt>
                    <dd>{candidate.importStatus}</dd>
                  </div>
                </dl>
                <div className="discovery-review">
                  <label>
                    Decision
                    <select
                      value={candidate.screeningStatus}
                      onChange={(event) =>
                        updateDecision(candidate, {
                          screeningStatus: event.target
                            .value as ScreeningStatus,
                        })
                      }
                    >
                      {statuses.map((value) => (
                        <option value={value} key={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Exclusion reason
                    <input
                      value={candidate.exclusionReason ?? ""}
                      onChange={(event) =>
                        updateDecision(candidate, {
                          exclusionReason: event.target.value,
                        })
                      }
                      placeholder="Required when excluded"
                    />
                  </label>
                  <label className="discovery-review__notes">
                    Screening notes
                    <input
                      value={candidate.screeningNotes ?? ""}
                      onChange={(event) =>
                        updateDecision(candidate, {
                          screeningNotes: event.target.value,
                        })
                      }
                      placeholder="Evidence, questions, or next action"
                    />
                  </label>
                </div>
              </div>
            </article>
          ))}
          {!filtered.length && (
            <div className="discovery-empty">
              <h3>No candidates match these filters.</h3>
              <p>
                Clear a filter or run a discovery command to populate the
                registry.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
