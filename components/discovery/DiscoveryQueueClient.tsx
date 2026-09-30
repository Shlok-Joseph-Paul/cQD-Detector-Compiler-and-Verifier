"use client";

import { useEffect, useMemo, useState } from "react";
import {
  filterQueueCandidates,
  yearRangeError,
} from "@/lib/discovery/queue-filters";
import { formatDetectorClass } from "@/lib/atlas/format";
import type {
  DiscoveryCandidate,
  ScreeningStatus,
} from "@/lib/discovery/types";
import type {
  ProposalStatus,
  StagedPaperProposal,
} from "@/lib/discovery/proposal-types";

interface LocalDecision {
  screeningStatus: ScreeningStatus;
  exclusionReason: string;
  screeningNotes: string;
}

interface LocalProposalDecision {
  status: ProposalStatus;
  decisionNotes: string;
}

const STORAGE_KEY = "cqd-atlas-discovery-decisions-v1";
const PROPOSAL_STORAGE_KEY = "cqd-atlas-proposal-decisions-v1";
const statusLabels: Record<ScreeningStatus, string> = {
  unreviewed: "To review",
  include: "Included",
  exclude: "Excluded",
  uncertain: "Needs a closer look",
};
const PAGE_SIZE = 20;

function plainText(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

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
  proposals,
}: {
  proposals: StagedPaperProposal[];
}) {
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    fetch("/api/discovery", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Discovery unavailable");
        return response.json();
      })
      .then((records: DiscoveryCandidate[]) => {
        setCandidates(records);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadError(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [loadAttempt]);
  const [view, setView] = useState<"papers" | "proposals" | "overview">(
    "papers",
  );
  const [afterYear, setAfterYear] = useState("");
  const [beforeYear, setBeforeYear] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ScreeningStatus | "all">("all");
  const [material, setMaterial] = useState("all");
  const [sort, setSort] = useState("score-desc");
  const [page, setPage] = useState(1);
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
  const [proposalDecisions, setProposalDecisions] = useState<
    Record<string, LocalProposalDecision>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = window.localStorage.getItem(PROPOSAL_STORAGE_KEY);
      return stored
        ? (JSON.parse(stored) as Record<string, LocalProposalDecision>)
        : {};
    } catch {
      return {};
    }
  });

  const effectiveProposals = useMemo(
    () =>
      proposals.map((proposal) => ({
        ...proposal,
        ...(proposalDecisions[proposal.proposalId] ?? {}),
      })),
    [proposalDecisions, proposals],
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
  const filtered = useMemo(
    () =>
      filterQueueCandidates(effective, {
        search,
        status,
        material,
        afterYear,
        beforeYear,
        sort,
      }),
    [effective, material, search, sort, status, afterYear, beforeYear],
  );
  const rangeError = yearRangeError(afterYear, beforeYear);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstResult = (currentPage - 1) * PAGE_SIZE;
  const hasFilters = Boolean(
    search || material !== "all" || status !== "all" || afterYear || beforeYear,
  );

  function clearFilters() {
    setSearch("");
    setMaterial("all");
    setStatus("all");
    setAfterYear("");
    setBeforeYear("");
    setPage(1);
  }

  function changePage(next: number) {
    setPage(next);
    document
      .getElementById("discovery-results")
      ?.scrollIntoView({ block: "start" });
    document
      .getElementById("discovery-results")
      ?.focus({ preventScroll: true });
  }
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
    const rows = filtered.map((candidate) => [
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

  function updateProposalDecision(
    proposal: StagedPaperProposal,
    patch: Partial<LocalProposalDecision>,
  ) {
    const current = proposalDecisions[proposal.proposalId] ?? {
      status: proposal.status,
      decisionNotes: proposal.decisionNotes ?? "",
    };
    const next = {
      ...proposalDecisions,
      [proposal.proposalId]: { ...current, ...patch },
    };
    setProposalDecisions(next);
    try {
      window.localStorage.setItem(PROPOSAL_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* optional */
    }
  }

  function exportProposalDecisions() {
    const rows = effectiveProposals.map((proposal) => [
      proposal.proposalId,
      proposal.status,
      proposal.decisionNotes,
    ]);
    const csv = [["proposal_id", "status", "decision_notes"], ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\n")
      .concat("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "cqd-proposal-decisions.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <nav className="discovery-view-nav" aria-label="Discovery views">
        {(
          [
            ["papers", "Papers", loading ? "…" : effective.length],
            ["proposals", "Import proposals", effectiveProposals.length],
            ["overview", "Overview", null],
          ] as const
        ).map(([key, label, count]) => (
          <button
            type="button"
            key={key}
            aria-pressed={view === key}
            onClick={() => setView(key)}
          >
            {label}
            {count !== null && <span>{count}</span>}
          </button>
        ))}
      </nav>
      {view === "proposals" && (
        <section
          className="discovery-workspace proposal-workspace"
          aria-label="Import proposals"
        >
          <header className="discovery-toolbar">
            <div>
              <p className="section-kicker">Extracted data approval</p>
              <h2>Review extracted data</h2>
              <p>{effectiveProposals.length} photodiode proposals</p>
            </div>
            <div className="discovery-toolbar__actions">
              <button
                className="primary-button"
                type="button"
                onClick={exportProposalDecisions}
                disabled={!effectiveProposals.length}
              >
                Export proposal decisions
              </button>
            </div>
          </header>
          <p className="discovery-local-note">
            Review the source evidence before approving a proposal. Decisions
            stay in this browser until exported and imported by a curator.
          </p>
          <div className="proposal-list">
            {effectiveProposals.map((proposal) => {
              const canApprove =
                proposal.scopeStatus === "in-scope" &&
                proposal.proposedMeasurements.length > 0 &&
                proposal.proposedDevices.every(
                  (device) => device.detector_class,
                );
              return (
                <article className="proposal-card" key={proposal.proposalId}>
                  <header className="proposal-card__header">
                    <div>
                      <div className="discovery-card__meta">
                        <span className="discovery-chip">
                          {proposal.scopeStatus}
                        </span>
                        <span>{proposal.status}</span>
                        <span>{proposal.source.pageCount} PDF pages</span>
                      </div>
                      <h3>{plainText(proposal.proposedPaper.title)}</h3>
                      <p>
                        {proposal.proposedPaper.first_author} ·{" "}
                        {proposal.proposedPaper.journal ??
                          "Journal not reported"}{" "}
                        ·{" "}
                        {proposal.proposedPaper.publication_year ??
                          "Year not reported"}
                      </p>
                    </div>
                    <a
                      href={proposal.source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Source PDF
                    </a>
                  </header>

                  <div className="proposal-scope">
                    <strong>Scope assessment</strong>
                    <ul>
                      {proposal.scopeReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="proposal-records">
                    <section>
                      <h4>Paper</h4>
                      <dl>
                        <div>
                          <dt>DOI</dt>
                          <dd>
                            {proposal.proposedPaper.doi ?? "Not reported"}
                          </dd>
                        </div>
                        <div>
                          <dt>Authors</dt>
                          <dd>
                            {proposal.proposedPaper.authors.join(", ") ||
                              "Not reported"}
                          </dd>
                        </div>
                      </dl>
                    </section>
                    <section>
                      <h4>Device</h4>
                      {proposal.proposedDevices.map((device) => (
                        <dl key={device.device_id}>
                          <div>
                            <dt>Detector class</dt>
                            <dd>
                              {device.detector_class
                                ? formatDetectorClass(device.detector_class)
                                : "Needs curator correction"}
                            </dd>
                          </div>
                          <div>
                            <dt>Material</dt>
                            <dd>{device.material_composition}</dd>
                          </div>
                          <div>
                            <dt>Architecture</dt>
                            <dd>{device.device_architecture}</dd>
                          </div>
                          <div>
                            <dt>Stack</dt>
                            <dd>{device.device_stack ?? "Not reported"}</dd>
                          </div>
                          <div>
                            <dt>Ligand exchange</dt>
                            <dd>
                              {device.ligand_exchange_status ?? "Not checked"}
                              {device.ligand_exchange_chemicals
                                ? `: ${device.ligand_exchange_chemicals}`
                                : ""}
                            </dd>
                          </div>
                          <div>
                            <dt>Ligand source</dt>
                            <dd>
                              {device.ligand_exchange_source_location ??
                                "Not reported"}
                            </dd>
                          </div>
                        </dl>
                      ))}
                    </section>
                    <section>
                      <h4>Measurements</h4>
                      {proposal.proposedMeasurements.length ? (
                        <div className="proposal-measurements">
                          {proposal.proposedMeasurements.map((measurement) => (
                            <div key={measurement.measurement_id}>
                              <strong>{measurement.wavelength_nm} nm</strong>
                              <span>
                                D*{" "}
                                {measurement.detectivity_jones?.toExponential(
                                  2,
                                ) ?? "Not reported"}{" "}
                                Jones
                              </span>
                              <span>
                                {measurement.flag} · {measurement.noise_method}
                              </span>
                              <span>
                                {measurement.bias_v == null
                                  ? "bias not reported"
                                  : `${measurement.bias_v} V`}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p>
                          No qualifying detectivity measurement was extracted.
                        </p>
                      )}
                    </section>
                  </div>

                  <details className="proposal-evidence">
                    <summary>Evidence and extraction notes</summary>
                    <ul>
                      {proposal.evidence.map((item) => (
                        <li key={`${item.field}-${item.page}-${item.location}`}>
                          <strong>{item.field}</strong> · page {item.page} ·{" "}
                          {Math.round(item.confidence * 100)}% —{" "}
                          {item.conciseEvidence}
                        </li>
                      ))}
                    </ul>
                    {!!proposal.warnings.length && (
                      <p className="discovery-warning">
                        <strong>Warnings:</strong>{" "}
                        {proposal.warnings.join(" · ")}
                      </p>
                    )}
                    {!!proposal.missingFields.length && (
                      <p>
                        <strong>Not extracted:</strong>{" "}
                        {proposal.missingFields.join(", ")}
                      </p>
                    )}
                  </details>

                  <div className="proposal-review discovery-review">
                    <label>
                      Approval decision
                      <select
                        value={proposal.status}
                        disabled={proposal.status === "applied"}
                        onChange={(event) =>
                          updateProposalDecision(proposal, {
                            status: event.target.value as ProposalStatus,
                          })
                        }
                      >
                        <option value="awaiting-approval">
                          awaiting-approval
                        </option>
                        <option value="approved" disabled={!canApprove}>
                          approved
                        </option>
                        <option
                          value="approved-provisional"
                          disabled={!canApprove}
                        >
                          approved-provisional
                        </option>
                        <option value="needs-correction">
                          needs-correction
                        </option>
                        <option value="rejected">rejected</option>
                        {proposal.status === "applied" && (
                          <option value="applied">applied</option>
                        )}
                      </select>
                    </label>
                    <label className="discovery-review__notes">
                      Decision notes
                      <input
                        value={proposal.decisionNotes ?? ""}
                        disabled={proposal.status === "applied"}
                        onChange={(event) =>
                          updateProposalDecision(proposal, {
                            decisionNotes: event.target.value,
                          })
                        }
                        placeholder="Required public explanation for provisional approval"
                      />
                    </label>
                  </div>
                </article>
              );
            })}
            {!effectiveProposals.length && (
              <div className="discovery-empty">
                <h3>No photodiode proposals to review.</h3>
                <p>
                  Photodiode papers with extracted data will appear here for
                  review.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {view === "overview" && (
        <div aria-label="Discovery overview">
          <section
            className="discovery-stat-grid"
            aria-label="Candidate screening totals"
          >
            <article>
              <span>Photodiode papers</span>
              <strong>{loading ? "…" : effective.length}</strong>
              <small>separate from the published atlas</small>
            </article>
            {statuses.map((value) => (
              <article key={value}>
                <span>{statusLabels[value]}</span>
                <strong>{statusCounts[value]}</strong>
                <small>
                  {value === "unreviewed"
                    ? "awaiting human screening"
                    : "saved screening decisions"}
                </small>
              </article>
            ))}
          </section>

          <div className="discovery-overview">
            <section className="discovery-panel">
              <p className="section-kicker">Material profile</p>
              <h2>Papers by material</h2>
              <div className="discovery-mini-bars">
                {materialCounts.length ? (
                  materialCounts.map(([label, count]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <i>
                        <b
                          style={{ width: `${(count / maxMaterial) * 100}%` }}
                        />
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
              <h2>Papers by year</h2>
              <div className="discovery-year-bars">
                {yearCounts.length ? (
                  yearCounts.map(([label, count]) => (
                    <div key={label}>
                      <strong>{count}</strong>
                      <i
                        style={{ height: `${18 + (count / maxYear) * 70}px` }}
                      />
                      <span>{label}</span>
                    </div>
                  ))
                ) : (
                  <p>No candidate years are available.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {view === "papers" && (
        <div className="discovery-browser">
          <aside className="discovery-filter-panel" aria-label="Filter papers">
            <div className="discovery-filter-heading">
              <h2>Find papers</h2>
              <button
                type="button"
                className="discovery-text-button"
                onClick={clearFilters}
                disabled={!hasFilters}
              >
                Reset
              </button>
            </div>
            <div className="discovery-filters">
              <label>
                Search papers
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Title, author, DOI…"
                />
              </label>
              <label>
                Material
                <select
                  value={material}
                  onChange={(event) => {
                    setMaterial(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All materials</option>
                  {materials.map((value) => (
                    <option value={value} key={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="discovery-year-filter">
                <legend>Publication year</legend>
                <div className="discovery-year-inputs">
                  <label>
                    Published after
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1000"
                      max="9999"
                      step="1"
                      placeholder="e.g. 2018"
                      value={afterYear}
                      aria-invalid={Boolean(rangeError)}
                      aria-describedby="discovery-year-help"
                      onChange={(event) => {
                        setAfterYear(event.target.value);
                        setPage(1);
                      }}
                    />
                  </label>
                  <label>
                    Published before
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1000"
                      max="9999"
                      step="1"
                      placeholder="e.g. 2026"
                      value={beforeYear}
                      aria-invalid={Boolean(rangeError)}
                      aria-describedby="discovery-year-help"
                      onChange={(event) => {
                        setBeforeYear(event.target.value);
                        setPage(1);
                      }}
                    />
                  </label>
                </div>
                <p
                  id="discovery-year-help"
                  className={
                    rangeError
                      ? "discovery-filter-error"
                      : "discovery-filter-help"
                  }
                  role={rangeError ? "alert" : undefined}
                >
                  {rangeError ??
                    "Exclusive limits. Leave blank for any year. Undated papers are hidden when a year limit is set."}
                </p>
              </fieldset>
            </div>
            <div className="discovery-scope-note">
              <strong>A focused reading list</strong>
              <p>
                Photodiode candidates only. Papers already in the atlas and
                general reviews are hidden.
              </p>
            </div>
          </aside>
          <section
            className="discovery-workspace discovery-results"
            id="discovery-results"
            tabIndex={-1}
            aria-label="Photodiode papers"
          >
            <header className="discovery-toolbar">
              <div>
                <h2>Photodiode papers</h2>
                <p role="status" aria-live="polite">
                  {loading
                    ? "Loading papers…"
                    : loadError
                      ? "Papers unavailable"
                      : filtered.length
                        ? `${firstResult + 1}–${Math.min(firstResult + PAGE_SIZE, filtered.length)} of ${filtered.length} papers`
                        : "0 matching papers"}
                  {!loading &&
                    !loadError &&
                    hasFilters &&
                    ` · ${effective.length} in total`}
                </p>
              </div>
              <div className="discovery-toolbar__actions">
                <label className="discovery-sort">
                  Sort by
                  <select
                    value={sort}
                    onChange={(event) => {
                      setSort(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="score-desc">Most relevant</option>
                    <option value="score-asc">Least relevant</option>
                    <option value="year-desc">Newest first</option>
                    <option value="year-asc">Oldest first</option>
                  </select>
                </label>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={exportDecisions}
                  disabled={loading || loadError || !filtered.length}
                >
                  Export results
                </button>
              </div>
            </header>
            <div
              className="discovery-status-filters"
              role="group"
              aria-label="Review status"
            >
              {(["all", ...statuses] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={status === value}
                  onClick={() => {
                    setStatus(value);
                    setPage(1);
                  }}
                >
                  {value === "all" ? "All papers" : statusLabels[value]}
                  <span>
                    {loading
                      ? "…"
                      : value === "all"
                        ? effective.length
                        : statusCounts[value]}
                  </span>
                </button>
              ))}
            </div>
            {hasFilters && (
              <div
                className="discovery-active-filters"
                aria-label="Active filters"
              >
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    aria-label="Remove search filter"
                  >
                    “{search}” <span aria-hidden="true">×</span>
                  </button>
                )}
                {material !== "all" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMaterial("all");
                      setPage(1);
                    }}
                    aria-label="Remove material filter"
                  >
                    {material} <span aria-hidden="true">×</span>
                  </button>
                )}
                {afterYear && (
                  <button
                    type="button"
                    onClick={() => {
                      setAfterYear("");
                      setPage(1);
                    }}
                    aria-label="Remove after year filter"
                  >
                    After {afterYear} <span aria-hidden="true">×</span>
                  </button>
                )}
                {beforeYear && (
                  <button
                    type="button"
                    onClick={() => {
                      setBeforeYear("");
                      setPage(1);
                    }}
                    aria-label="Remove before year filter"
                  >
                    Before {beforeYear} <span aria-hidden="true">×</span>
                  </button>
                )}
                {status !== "all" && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("all");
                      setPage(1);
                    }}
                    aria-label="Remove review status filter"
                  >
                    {statusLabels[status]} <span aria-hidden="true">×</span>
                  </button>
                )}
                <button
                  type="button"
                  className="discovery-text-button"
                  onClick={clearFilters}
                >
                  Clear all
                </button>
              </div>
            )}
            <div className="discovery-cards">
              {filtered
                .slice(firstResult, firstResult + PAGE_SIZE)
                .map((candidate) => (
                  <article
                    className="discovery-card"
                    key={candidate.candidateId}
                  >
                    <div className="discovery-card__score">
                      <strong>{candidate.relevanceScore}</strong>
                      <span>relevance</span>
                    </div>
                    <div className="discovery-card__body">
                      <div className="discovery-card__meta">
                        <span>
                          {candidate.publicationYear ?? "Year not reported"}
                        </span>
                        <span>
                          {plainText(
                            candidate.journal ?? "Source not reported",
                          )}
                        </span>
                        {candidate.candidateMaterialClasses.map((value) => (
                          <span className="discovery-chip" key={value}>
                            {value}
                          </span>
                        ))}
                      </div>
                      <h3>{plainText(candidate.title)}</h3>
                      <span
                        className={`discovery-review-state discovery-review-state--${candidate.screeningStatus}`}
                      >
                        {statusLabels[candidate.screeningStatus]}
                      </span>
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
                            Publication
                          </a>
                        )}
                        {candidate.doi && (
                          <a
                            href={`https://doi.org/${candidate.normalizedDoi}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            DOI
                          </a>
                        )}
                        {candidate.openAccessPdfUrl && (
                          <a
                            href={candidate.openAccessPdfUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open-access PDF
                          </a>
                        )}
                      </div>
                      <details className="discovery-paper-details">
                        <summary>Abstract, evidence & review</summary>
                        <div className="discovery-abstract">
                          <h4>Abstract</h4>
                          <p>
                            {candidate.abstract
                              ? plainText(candidate.abstract)
                              : "No abstract available. Open the publication to review the paper."}
                          </p>
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
                                  {statusLabels[value]}
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
                      </details>
                    </div>
                  </article>
                ))}
              {loading && <p role="status">Loading discovery candidates…</p>}
              {loadError && (
                <div role="alert">
                  <p>Discovery candidates could not be loaded.</p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                  >
                    Try again
                  </button>
                </div>
              )}
              {!loading && !loadError && !filtered.length && (
                <div className="discovery-empty">
                  <h3>
                    {rangeError
                      ? "Check your year range."
                      : "No papers match these filters."}
                  </h3>
                  <p>
                    {rangeError ??
                      "Try a wider year range, a different material, or a shorter search."}
                  </p>
                  {hasFilters && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>
            {!loading && !loadError && filtered.length > 0 && (
              <nav
                className="discovery-pagination"
                aria-label="Paper results pages"
              >
                <span>
                  Page {currentPage} of {pageCount}
                </span>
                <div>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={currentPage === 1}
                    onClick={() => changePage(currentPage - 1)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={currentPage === pageCount}
                    onClick={() => changePage(currentPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </nav>
            )}
            <p className="discovery-local-note">
              Review decisions are saved in this browser. Export results to
              share your screening; atlas publication requires curator review.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
