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
# 1. Run all versioned keyword queries
pnpm discovery discover

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
pnpm discovery apply-approved --proposal=proposal-id --dry-run
```

The `--query` option accepts multiple exact queries separated by `|`. Repeated
runs update matching candidates rather than recreating them. Remote JSON is
cached under `data/discovery/cache/`; cached payloads are intentionally ignored
by Git, while the registry and audit log are versioned.

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

`parse-open-access` accepts only an unauthenticated HTTP(S) PDF URL recorded by
the discovery provider. It rejects login pages and non-PDF responses, limits
downloads to 50 MB, hashes the PDF, batch-extracts page-marked text, and writes
only a compact proposal to `data/discovery/proposals.json`. PDFs and full text
stay in a temporary external cache, not in Git or the public site.

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
