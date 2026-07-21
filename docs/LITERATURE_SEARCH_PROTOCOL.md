# Photodiode Atlas literature-search protocol

## Purpose and boundary

The Paper Discovery Queue identifies publications that may merit human
screening. A candidate is not an atlas record. Discovery, relevance ranking,
PDF availability, and a local `include` decision cannot add a paper to the
published atlas. Publication still requires source-level verification,
normalized Paper → Device → Measurement records, and the existing data
validator.

## Databases and search strategy

The automated search uses:

- **OpenAlex** for keyword search, references, works citing an atlas seed,
  related works, author-linked works, dates, abstracts, and declared
  open-access locations;
- **Crossref** to validate DOI and bibliographic metadata; and
- the current `data/papers.csv` entries as citation-graph seeds and an
  exclusion list.

The versioned CQD and perovskite profiles, material terms, and exact keyword
queries live in `data/discovery/config.json`. That file is the search-strategy
source of truth; queries can be edited without changing application code. A
run log records the profile, configuration version, exact queries, seed IDs,
optional date filters, counts, and incomplete requests.

OpenAlex keyword search can match indexed full text as well as titles and
abstracts. Discovery therefore favors recall, while automatic review-batch
eligibility uses only local title and reconstructed-abstract evidence for the
selected absorber profile, detector, and detectivity signals. Citation
expansion remains important for papers with missing abstracts or unusual
terminology.

For a formal search, record the search date and use `--to=YYYY-MM-DD` as the
cutoff date. Use an overlap window on later incremental runs to accommodate
indexing delays. The registry is idempotently updated, so overlap does not
recreate candidates.

## Screening criteria

Prioritize experimental CQD or metal-halide perovskite photodiodes with an
identifiable measurement wavelength and reported specific detectivity. The
scope does not require a particular spectral region. Candidate ranking has
higher recall than the atlas's inclusion rule, so photodetector, imager,
focal-plane-array, and photoconductor terminology can still surface papers for
human screening.

Exclude from the published atlas when the original work is limited to:

- photoconductors, photoresistors, phototransistors, or bolometers;
- focal-plane arrays without an extractable photodiode measurement;
- epitaxial or self-assembled quantum-dot detectors in the CQD profile;
- emitters, LEDs, lasers, or luminescence;
- solar cells without detector characterization;
- synthesis or theory without an experimental photodiode;
- reviews, perspectives, corrections, or retractions rather than the primary
  research article; or
- performance values cited from another publication.

An `include` screening decision means “send to the importer,” not “publish.”
The importer must still confirm D*, wavelength, noise method, source location,
and device scope from the original paper.

## Deduplication

Deduplication proceeds in this fixed order:

1. exact normalized DOI;
2. exact OpenAlex work ID;
3. normalized title plus publication year; and
4. conservative trigram title similarity, with the threshold stored in the
   search configuration.

DOIs are normalized by removing `https://doi.org/`, `http://dx.doi.org/`, and
`doi:` prefixes, removing whitespace, and folding case. Exact matches are
merged incrementally while retaining discovery methods, queries, and seed
connections. Fuzzy matches are never silently merged: both records remain and
receive a possible-duplicate warning for human review.

## Citation chaining

Every included atlas DOI is resolved to OpenAlex. The expansion command can
collect its references, citing works, related works, and works by up to three
listed authors. Each candidate records both the graph method and seed paper ID.
Author expansion is intentionally limited because prolific authors can greatly
reduce precision.

## Search and review workflow

1. Run keyword discovery, optionally with a formal date cutoff.
2. Expand the atlas citation graph.
3. Refresh DOI metadata through Crossref.
4. Deduplicate and inspect possible fuzzy matches.
5. Run `prepare-review` to stage a conservative batch automatically, and/or
   screen candidates in the local Discovery Queue page or exported CSV.
6. Export browser-local screening decisions and import the CSV into the
   registry.
7. Commit candidate decisions and the append-only run log for an auditable
   search snapshot.
8. Acquire only a resolved, unauthenticated open-access PDF and stage an
   evidence-linked proposal. Automatic preparation does not imply inclusion.
9. Review the proposal, export and import an explicit approval decision, then
   separately apply only the approved proposal through the validated CSV
   workflow.

The CSV is the interchange surface for review. Browser decisions use local
storage and are not committed or published until explicitly exported and
imported.

## PDF policy

The discovery pipeline considers PDF URLs recorded by OpenAlex, curator
overrides, refreshed OpenAlex locations, and DOI-based Unpaywall locations. The
proposal command may download a resolved URL only when it is plain HTTP(S),
unauthenticated, and actually returns a PDF. It does not use institutional
sessions, cookies, credentials, browser state, or paywall circumvention. The
PDF and page-marked extraction remain in an external cache; the repository
stores its checksum, source URL, acquisition metadata, short evidence snippets,
and proposed records. `available` still means only that an open-access URL was
reported. `acquired` means the response was verified as a PDF, not that its
scientific claims were accepted.

## Google Scholar

The pipeline does not scrape Google Scholar. A curator may export Scholar
results manually in CSV, BibTeX, or RIS form. A future importer can normalize
that export into the candidate registry while recording `Google Scholar manual
export` as the discovery source, the manual search date, and the exact query.
Until such an importer is added, use the screening CSV columns as the mapping
template and do not copy results directly into the published atlas.

## Coverage limitations

OpenAlex and Crossref can have missing abstracts, incomplete author or reference
graphs, delayed indexing, merged records, imperfect document types, and stale
open-access links. Crossref validates registry metadata but does not establish
scientific scope or full-text availability. Keyword searches may miss papers
that use unusual material, detector, or spectral terminology. Citation
chaining favors the existing atlas and can reproduce its material and venue
biases. These limitations should accompany any report of search completeness.

## Future selection-flow reporting

The registry and append-only run log retain counts for retrieval, exact
deduplication, possible duplicates, screening outcomes, PDF status, and import
status. These fields can support a future paper-selection flow diagram without
reconstructing decisions from the published atlas. A formal diagram must still
state its search date, cutoff, configuration version, databases, and treatment
of incomplete requests.
