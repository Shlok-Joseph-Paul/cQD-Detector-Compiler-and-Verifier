# Future automated ingestion

Status: architecture note only. No discovery scheduler, crawler, full-text
downloader, automated extractor, or publisher integration is implemented in the
first release.

The CQD Photodiode Atlas currently treats the repository CSV files as its only
publishable source of truth. A future service may help curators _discover_ and
_prepare_ candidate records, but it must not publish scientific values without
an explicit human approval step.

## Design principles

1. **Discovery is not inclusion.** A search match is a private candidate until a
   curator confirms that it describes an in-scope experimental CQD photodiode.
2. **Extraction produces proposals, not facts.** Every proposed value must carry
   source evidence and may be edited or rejected during review.
3. **Approval is a hard boundary.** Automated workers cannot change the public
   atlas, assign a green flag, or bypass the same validation used for manual CSV
   entries.
4. **Use lawful, documented access.** Metadata comes from supported scholarly
   APIs. Full text is processed only when it is openly and legally accessible
   without personal or institutional credentials.
5. **Preserve provenance.** The provider record, retrieval time, source URL,
   source location, extractor version, curator decision, and subsequent edits
   remain auditable.
6. **Minimize retained content.** Store only the metadata, evidence locations,
   and short excerpts required for review. Retain full text only when its license
   and the operational need permit it.

## Proposed daily pipeline

```text
scheduled trigger
      │
      ▼
scholarly metadata APIs ──► normalize and deduplicate candidates
      │
      ▼
private scope triage ──► reject / defer / seek lawful open full text
      │
      ▼
evidence-linked paper, device, and measurement proposals
      │
      ▼
schema + relationship validation
      │
      ▼
private human-review queue
      │
      ├──► reject or request more evidence
      │
      └──► curator edits and explicitly approves
                    │
                    ▼
             reviewed data pull request
                    │
                    ▼
          CI validation and public release
```

### 1. Search scholarly metadata services

A scheduled job runs once per day with an overlap window so delayed indexing
does not create gaps. Provider adapters query documented metadata APIs using a
high-recall group of terms around colloidal quantum dots, photodiodes,
detectivity, noise, and relevant material families.

The job should:

- identify itself according to each provider's API policy;
- respect authentication requirements for the _API itself_, rate limits,
  pagination rules, retry headers, and terms of use;
- use provider-supported incremental dates or cursors where available;
- record the query, time window, provider, adapter version, and result count;
- retry temporary failures with bounded exponential backoff; and
- alert on repeated failures rather than increasing request volume.

This is API-based metadata discovery, not HTML search-result scraping. Candidate
sources might include DOI registries, open scholarly indexes, preprint services,
or discipline repositories, subject to their current terms and data licenses.
Provider selection and credentials should be deployment configuration, never
committed repository secrets.

### 2. Normalize and deduplicate

Normalize DOI case and URL forms, Unicode text, author lists, and publication
dates. Deduplicate first on canonical DOI and provider identifiers, then use a
conservative title/year/author comparison for records without a DOI. Ambiguous
matches remain separate and are surfaced to a curator; the system should not
silently merge them.

The candidate inbox retains both the normalized fields and the original
provider metadata needed to audit a merge or correction. An already reviewed
paper may still be re-queued when a new version, correction, or supplementary
file appears.

### 3. Triage scientific scope

A rule-based or model-assisted classifier may prioritize likely CQD photodiode
papers. It can use title, abstract, keywords, and venue metadata, but its result
is only a routing score. It must not decide public inclusion.

The queue should make exclusions easy to record, including photoconductors,
phototransistors, bolometers, epitaxial quantum dots, non-CQD perovskite films,
theory-only reports, and focal-plane-array papers without an extractable
photodiode measurement. Recorded exclusion reasons prevent the same paper from
being repeatedly proposed without hiding later corrected versions.

### 4. Resolve legally accessible full text

For each promising candidate, an open-access resolver checks supported license
and repository metadata. It may return a publisher open-access article, public
repository manuscript, or preprint. The source must be reachable without an
institutional login, personal browser session, paywall circumvention, or shared
credential.

The service must not:

- scrape a publisher site whose terms or access controls disallow it;
- use library proxy credentials, cookies, or institutional authentication;
- automate access to a PDF merely because a curator can open it manually;
- bypass robots, rate limits, technical protection, or download limits; or
- expose licensed full text through the public atlas.

If lawful full text cannot be found, the candidate remains `metadata_only` for
manual follow-up. That outcome is normal and must not be treated as an error.

### 5. Propose evidence-linked measurements

Extraction operates only on an accepted accessible source. It proposes linked
paper, device, and measurement fields while preserving nulls for unreported
information. Each non-null field should carry:

- the source URL and source version;
- page, section, figure, table, or supporting-information location;
- a short review excerpt when legally appropriate;
- a confidence signal used only to prioritize review; and
- the extraction software/model version.

The extractor must distinguish values reported for the paper's own devices from
literature-comparison values. It should preserve units before normalization,
mark graphically extracted values, capture operating conditions, and create
separate proposals for distinct wavelengths, biases, temperatures, devices, or
noise methods. It must not invent a missing condition, turn a null into zero, or
automatically assign green status.

### 6. Validate in staging

Proposals are converted into a staging representation compatible with the
curated Paper–Device–Measurement schema. The same domain checks used by the CSV
workflow run before review, including positive wavelength and detectivity,
plausible year, valid foreign keys, unique identifiers, controlled noise
methods, and explainable flag logic.

Validation failures return to the proposal with row/field-equivalent error
locations. Passing validation means only that the proposal is structurally
coherent; it does not make the science correct or publishable.

### 7. Human review and approval

The private review interface should show the source beside the proposed fields,
highlight low-confidence or conflicting evidence, and make nulls and units
explicit. A curator must:

1. confirm scientific scope and publication type;
2. identify the original source rather than a comparison citation;
3. reconcile the paper, device, and measurement relationships;
4. check every numerical value, unit conversion, and operating condition;
5. select the controlled noise method and extraction method;
6. enter all applicable machine-readable amber reasons and explanatory notes;
7. verify that any green record satisfies every green criterion; and
8. explicitly approve, reject, or return the proposal for more evidence.

Approval records the curator, time, source version, proposal version, and field
changes. Review permissions should be separate from service credentials.
Corrections with high impact can optionally require a second reviewer.

### 8. Publish through the existing data workflow

Approved proposals become a focused change to the curated data files or, after
a future database migration, an equivalent reviewed transaction. Publication
still runs the repository's data validation and application tests. A pull
request makes the exact record changes reviewable before deployment.

There is deliberately no `publish()` method in the ingestion adapter boundary.
Only the curation workflow can cross from a private proposal into the public
atlas.

## Adapter boundary

Provider-specific code should implement the ports exported from
`lib/ingestion/index.ts`:

| Port                         | Responsibility                                                                            | Must not do                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `ScholarlyDiscoveryAdapter`  | Query one supported metadata provider and return paginated candidates                     | Scrape publisher HTML or assert inclusion                          |
| `OpenAccessResolverAdapter`  | Resolve a candidate to lawful, unauthenticated full text or a documented no-access result | Circumvent a paywall or use institutional credentials              |
| `MeasurementProposalAdapter` | Produce evidence-linked candidate measurements                                            | Create public records, fill missing values, or assign green status |
| `HumanReviewQueueAdapter`    | Place proposals in a private queue                                                        | Auto-approve or publish                                            |

The types use provider-neutral candidates and proposals so a metadata service,
extractor, queue, or persistence layer can be replaced independently. The
frontend remains coupled only to validated atlas records, not to any discovery
provider.

## Operational controls

A production implementation should add:

- a per-provider request budget, concurrency limit, timeout, and circuit breaker;
- secret management outside the repository and least-privilege service roles;
- encrypted private-queue storage and access logs;
- checksum/version tracking for source changes;
- idempotency keys for daily runs and queue insertion;
- metrics for candidates, duplicates, access outcomes, proposals, approvals,
  rejections, latency, and error rates;
- alerts for provider-policy changes, parsing regressions, and review backlog;
- a retention schedule for full text, excerpts, rejected proposals, and audit
  records; and
- a kill switch that stops all provider calls without affecting the public
  static site.

Before enabling a provider, maintainers should document its API policy, license,
rate limits, contact/identification requirement, permitted retention, and
attribution obligations. Compliance should be reviewed when a provider changes
its terms or access mechanism.

## Migration path

1. Keep the CSV files and generated atlas JSON as the public source of truth.
2. Add a private candidate store and review queue behind the adapter interfaces.
3. Run discovery in observation mode and measure false positives without
   extracting or publishing.
4. Enable open-access resolution and evidence-linked proposals for a small
   provider set.
5. Let curators export approved proposals into a normal data pull request.
6. Only after the review process is stable, consider a database-backed curated
   store that implements the same frontend-facing record contract.

This sequence adds automation around curator work while preserving the atlas's
central rule: no measurement becomes public without traceable evidence and
human scientific review.
