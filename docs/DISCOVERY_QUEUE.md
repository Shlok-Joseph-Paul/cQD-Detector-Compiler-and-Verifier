# Paper Discovery Queue operator guide

The discovery registry is stored in `data/discovery/candidates.json`. It is
separate from `data/papers.csv`, `data/devices.csv`, and
`data/measurements.csv`, and no discovery command writes to those published
atlas sources.

Before a shared or formal API run, set the OpenAlex and Crossref `mailto`
fields in `data/discovery/config.json` to the maintainer contact address. This
is public request identification, not a secret. Do not add API keys to the
configuration or repository.

## Commands

```bash
# 1. Run all versioned keyword queries for one absorber profile
pnpm discovery discover --profile=cqd
pnpm discovery discover --profile=perovskite

# Run selected queries or apply a formal publication-date window
pnpm discovery discover --query='InSb colloidal quantum dot photodiode' --from=2020-01-01 --to=2026-07-19

# 2. Expand references, citing works, related works, and authors from atlas seeds
pnpm discovery expand
pnpm discovery expand --methods=reference,cited-by,related-work

# 3. Validate DOI metadata through Crossref
pnpm discovery refresh

# 4. Merge exact duplicates and flag conservative fuzzy matches
pnpm discovery dedupe

# 5. Export the review interchange file
pnpm discovery export-screening --output=data/discovery/screening.csv

# Export a concise, ranked list of new-paper links for reading
pnpm discovery export-shortlist

# 6. Import reviewed statuses, reasons, notes, PDF state, and import state
pnpm discovery import-screening --input=data/discovery/screening.csv

# 7. Acquire and parse a screened open-access candidate into staging
pnpm discovery parse-open-access --candidate=candidate-id

# Or parse every candidate already marked include
pnpm discovery parse-open-access --included

# Prepare the five best unprocessed candidates without requiring include first
pnpm discovery prepare-review --profile=cqd --limit=5
pnpm discovery prepare-review --profile=perovskite --limit=5

# Refresh keyword and citation-graph candidates before preparing the batch
pnpm discovery prepare-review --profile=perovskite --limit=5 --discover --expand

# Constrain an incremental refresh with an overlap window
pnpm discovery prepare-review --profile=perovskite --limit=5 --discover --from=2026-07-01 --to=2026-07-21

# 8. Export/import explicit proposal decisions
pnpm discovery export-proposal-decisions --output=data/discovery/proposal-decisions.csv
pnpm discovery import-proposal-decisions --input=data/discovery/proposal-decisions.csv

# 9. Inspect proposal counts and apply only explicitly approved proposal IDs
pnpm discovery proposal-summary
pnpm discovery apply-approved --proposal=proposal-id

# 10. Print candidate status and material counts
pnpm discovery summary

# 11. Exercise a mutating command without changing tracked data
pnpm discovery discover --dry-run
pnpm discovery parse-open-access --candidate=candidate-id --dry-run
pnpm discovery prepare-review --limit=5 --dry-run
pnpm discovery apply-approved --proposal=proposal-id --dry-run
```

The `--query` option accepts multiple exact queries separated by `|`. Repeated
runs update matching candidates rather than recreating them. Remote JSON is
cached under `data/discovery/cache/`; cached payloads are intentionally ignored
by Git, while the registry and audit log are versioned.

## Automated review-batch preparation

`prepare-review` consumes the existing registry by default. `--discover` runs
the configured OpenAlex keyword queries first, while `--expand` refreshes the
atlas-seed reference, citation, related-work, and author paths before
deduplication. Use an explicit overlapping `--from`/`--to` window for recurring
keyword runs.

Automatic eligibility is permission to create a private proposal, not an
inclusion or publication decision. An unreviewed candidate must:

- be absent from the published atlas and proposal registry;
- have a retryable import state rather than `parsed`, `approved`, or
  `published`;
- not be excluded, uncertain, or a possible fuzzy duplicate;
- meet the configured relevance threshold; and
- contain the selected profile's absorber, detector, and detectivity evidence
  in its title and reconstructed abstract.

An explicit curator `include` decision bypasses the automatic score and
title/abstract confidence gates, but never bypasses atlas duplication, existing
proposal, or terminal-state checks. The command never changes a candidate's
screening decision.

Eligible candidates are ordered deterministically. Curator-included records
come first, followed by candidates with already recorded PDFs, atlas-fit class,
relevance, publication year, title, and stable candidate ID. `--limit` is the
number of candidates attempted; resolution or extraction failures can therefore
produce fewer proposals.

PDF resolution tries, in order, a curator-provided override, the recorded
candidate location, refreshed OpenAlex locations, and DOI-based Unpaywall
locations. Every response must still pass the same unauthenticated HTTP(S), PDF
signature, redirect, and 50 MB acquisition checks. A missing location is marked
`requested`; exhausted locations are marked `inaccessible`; successful
extraction becomes `parsed`. These states remain retryable or reviewable and do
not alter the atlas CSVs.

The JSON result reports every selected, deferred, skipped, unresolved, and
failed candidate with a reason. A failure for one paper does not abort other
usable proposals. Existing proposals are always skipped so a rerun cannot erase
an approval, rejection, or correction decision. Identical acquired PDF hashes
are linked as duplicates and are not proposed twice.

`--dry-run` may use remote APIs and temporary external PDF/extraction caches to
show realistic outcomes, but it does not write the candidate registry, proposal
registry, run log, repository cache, or published atlas files.

Recurring execution should call this same command from an external scheduler
with an overlapping date window. The scheduled job may discover, resolve, and
stage proposals, then notify a curator with the review summary. It must not call
`apply-approved`; publication remains a separate explicit curator action. The
repository itself does not install an operating-system or hosted scheduler.

## Candidate statuses

- Screening: `unreviewed`, `include`, `exclude`, `uncertain`
- PDF: `not-checked`, `available`, `acquired`, `inaccessible`, `requested`
- Import: `not-started`, `queued`, `parsed`, `approved`, `published`

The Discovery Queue web page supports text search, material and status filters,
sorting, bibliographic links, duplicate warnings, local decisions, and CSV
export. Local decisions remain in browser storage. Import the exported CSV to
make them part of the versioned registry.

For a copy-paste task that runs a broader, multi-source search and produces a
curator-ready recommendation set, use
`docs/EXTENSIVE_SEARCH_PROMPT.md`.

## Open-access proposal and approval workflow

`parse-open-access` and `prepare-review` accept only unauthenticated HTTP(S) PDF
locations resolved from configured scholarly/open-access providers. They reject
login pages and non-PDF responses, limit downloads to 50 MB, hash each PDF,
batch-extract page-marked text, and write only compact proposals to
`data/discovery/proposals.json`. PDFs and full text stay in a temporary external
cache, not in Git or the public site.

Extraction is conservative: a measurement requires co-located D* in Jones and
a wavelength. Each proposal shows its Paper → Device → Measurement structure,
source page, concise evidence, confidence, missing fields, warnings, and noise
method. Literature-comparison language is warned, shot-noise assumptions are
amber, and missing values remain null.

There are two hard gates:

1. A curator reviews the proposal in `/discovery`, selects `approved`,
   `rejected`, or `needs-correction`, exports the proposal-decision CSV, and
   imports it with the CLI. Only an in-scope proposal with a measurement can be
   approved.
2. `apply-approved` must be called with the approved proposal ID. It rejects
   duplicate atlas DOIs, validates the complete prospective dataset before any
   tracked file is written, appends reviewed CSV rows, regenerates the atlas,
   and marks the proposal applied.

After applying, run the full release checks before committing or deploying:

```bash
pnpm run validate-data
pnpm run format:check
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
```

## Audit log and failures

Every non-dry run appends one JSON object to `data/discovery/runs.jsonl` with a
UUID run ID, timestamp, configuration version, APIs, queries or seeds, date
filters, retrieval/addition/deduplication counts, and errors. Existing entries
must not be edited or reordered.

Temporary 429 and server failures use bounded backoff. If only some queries
fail, successful results remain usable and the incomplete queries are recorded
in the run log. Automated tests use mocked responses and never call live APIs.
