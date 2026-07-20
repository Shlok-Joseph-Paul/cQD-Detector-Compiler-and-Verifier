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

# 6. Import reviewed statuses, reasons, notes, PDF state, and import state
pnpm discovery import-screening --input=data/discovery/screening.csv

# 7. Print status and material counts
pnpm discovery summary

# 8. Exercise any mutating command without changing the registry, cache, or log
pnpm discovery discover --dry-run
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

## Audit log and failures

Every non-dry run appends one JSON object to `data/discovery/runs.jsonl` with a
UUID run ID, timestamp, configuration version, APIs, queries or seeds, date
filters, retrieval/addition/deduplication counts, and errors. Existing entries
must not be edited or reordered.

Temporary 429 and server failures use bounded backoff. If only some queries
fail, successful results remain usable and the incomplete queries are recorded
in the run log. Automated tests use mocked responses and never call live APIs.
