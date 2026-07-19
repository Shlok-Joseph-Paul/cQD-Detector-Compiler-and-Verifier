# CQD Photodiode Atlas

A curated, searchable map of reported colloidal quantum-dot (CQD) photodiode
performance across materials, wavelengths, device architectures, and
measurement methods.

The atlas plots **one point per reported measurement**, with wavelength on the
x-axis and specific detectivity, D<sup>*</sup>, on a logarithmic y-axis. The same
records appear in a searchable, sortable table and on measurement-detail and
paper-, measurement-, and material-summary pages. Filters stay synchronized
across the map and table, and the filtered records can be downloaded as a
versioned CSV.

> **Demonstration-data warning:** the initial repository may contain a small
> synthetic dataset solely to exercise the interface. Every such row is labeled
> **“Demonstration data—not a literature record.”** Synthetic titles, values,
> and identifiers are not scientific citations and must not be treated as
> published results. Green and amber flags on these rows are interface fixtures
> that exercise the documented rule engine; they do not assign scientific
> status to synthetic measurements.

## Scientific scope

The atlas includes experimental, solution-processed CQD photodiodes with a
reported specific detectivity in Jones and an identifiable measurement
wavelength. Peer-reviewed papers and clearly labeled preprints are supported.

The atlas excludes:

- photoconductors, photoresistors, phototransistors, and bolometers;
- focal-plane-array reports without an extractable photodiode measurement;
- epitaxial quantum-dot detectors;
- non-CQD perovskite thin films;
- theoretical devices without an experimental photodiode; and
- literature-comparison values attributed to another paper. A value belongs to
  a record for its original source.

Photoconductive and transistor detectors are kept out because their gain and
noise behavior can make detectivity values fundamentally different from
junction-photodiode measurements. See the in-site
[Methodology](./app/methodology/page.tsx) page for the complete inclusion,
noise, missing-data, and flag policies.

## Data model and interpretation

The normalized model separates three linked entities:

```text
Paper 1 ──► many Devices 1 ──► many Measurements
```

- **Paper** holds the original bibliographic source.
- **Device** holds CQD material, composition, architecture, stack, and active
  area.
- **Measurement** holds one D<sup>*</sup> value, wavelength, operating
  conditions, noise method, acquisition instrument chain, provenance, and
  curation status.

A paper may therefore produce several points on the atlas. The central unit is
the measurement—not a paper, a champion value selected by the atlas, or an
average across devices.

Only green and amber public flags are used. Amber does **not** mean a result is
incorrect. It is reserved for a shot-noise approximation or a reported D* that
a curator judges to be substantially above a plausible BLIP limit. The latter
check is applied only when the comparison is straightforward; the atlas does
not calculate BLIP limits automatically. Missing conditions remain visible as
“Not reported” but do not change the flag. Every amber record must contain at
least one machine-readable reason and a human-readable explanation.

The atlas reproduces published claims as documented. It does not independently
repeat experiments, endorse reported values, calculate theoretical limits, or
perform automated physics-consistency checks.

## Technology

- Next.js App Router with strict TypeScript
- vinext/Vite output for Cloudflare-compatible Sites hosting
- React and Recharts for the interactive performance map
- Repository-owned CSV data compiled into deterministic normalized JSON
- Static public reads; no account, email, or database is required for v1

The frontend reads validated normalized records rather than parsing source CSV
inside components. This keeps filtering and presentation independent from the
storage layer and allows a future reviewed database to implement the same data
contract.

## Local setup

Prerequisites: Node.js `>=22.13.0` and pnpm.

```bash
git clone https://github.com/Shlok-Joseph-Paul/cQD-Detector-Compiler-and-Verifier.git
cd cQD-Detector-Compiler-and-Verifier
pnpm install
pnpm run validate-data
pnpm run dev
```

Open the local URL printed by the development server. No environment variables
or credentials are needed for the static atlas.

## Commands

| Command                  | Purpose                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `pnpm run dev`           | Start the local development site                                                       |
| `pnpm run validate-data` | Validate the three CSV files and regenerate `data/generated/atlas.json`                |
| `pnpm run check-data`    | Validate the CSV files and verify that generated JSON is current without writing files |
| `pnpm test`              | Run automated schema, flags, filtering, sorting, formatting, and export tests          |
| `pnpm run lint`          | Run the code-quality checks                                                            |
| `pnpm run typecheck`     | Run strict TypeScript checks without emitting files                                    |
| `pnpm run build`         | Validate data and create the production build                                          |
| `pnpm run start`         | Start the production build locally                                                     |

The production build is expected to fail if curated data is invalid or the
generated atlas artifact is stale.

## Curated data workflow

Editable source files:

- `data/papers.csv`
- `data/devices.csv`
- `data/measurements.csv`

Supporting files:

- `data/templates/` — blank headers/templates for each entity
- `data/DATA_DICTIONARY.md` — column definitions, allowed values, units, null
  handling, and multi-value encoding
- `data/generated/atlas.json` — normalized application data; generated, not
  edited by hand

The CSVs are the reviewable source of truth. Use UTF-8 text, the exact
controlled vocabulary in the data dictionary, stable identifiers, and empty
cells for information that the publication does not report. Authors and amber
reason keys are separated with `|`, not commas. Do not enter `0`, `unknown`, or
a guessed value as a substitute for missing information.

### Add the first real paper

1. **Remove the demonstration set.** Delete all `demo-*` measurements, devices,
   and papers from their respective CSV files. Keep the headers and regenerate
   the atlas to confirm there are no orphaned rows.
2. **Confirm scope and provenance.** Work from the original paper, not a value
   repeated in a review or comparison table. Confirm that it is an experimental
   CQD photodiode and that D<sup>*</sup> and wavelength are identifiable.
3. **Add one paper row.** In `data/papers.csv`, assign a unique `paper_id` and
   enter the title, full author list, first author, journal, publication year,
   DOI/link, publication type, peer-review status, and notes. Do not include a
   `https://doi.org/` prefix unless the data dictionary requests it.
4. **Add each distinct device.** In `data/devices.csv`, assign a unique
   `device_id`, reference the paper's `paper_id`, and record material family,
   composition, architecture, layer stack, area, and notes. Use separate device
   rows when stacks or architectures differ materially.
5. **Add each measurement.** In `data/measurements.csv`, assign a unique
   `measurement_id` and reference its `device_id`. Create separate rows for
   distinct reported wavelengths, biases, temperatures, frequencies, devices,
   or noise methods.
6. **Capture method and provenance.** Record the controlled `noise_method`,
   noise-instrument classification and evidence, detectivity extraction method,
   source page/figure/table/supporting-information location, operating
   conditions, and curator notes. Preserve the source units in notes when a
   conversion is needed.
7. **Apply flags.** A shot-noise approximation is always amber. A clearly
   anomalous value above a plausible BLIP limit may be marked amber after
   curator review. Other missing or incomplete fields do not affect the flag.
8. **Validate and inspect.** Run `pnpm run validate-data`, review the generated
   diff in `data/generated/atlas.json`, then run `pnpm test` and
   `pnpm run build`.

### Validation behavior

Validation reports the source entity, CSV row, field, and explanation. Among
other checks, it rejects:

- duplicate paper, device, or measurement identifiers;
- missing Paper → Device or Device → Measurement relationships;
- non-positive detectivity or wavelength;
- implausible publication years;
- values outside a controlled vocabulary;
- green shot-noise records;
- shot-noise records not marked amber; and
- amber records without at least one reason and an explanation.

Do not hand-edit generated JSON to work around an error. Correct the source CSV
and run validation again.

## Site behavior

The main atlas supports search and filters for material, wavelength, year,
temperature category, bias condition, noise method, flag, and publication type.
Filter state is represented in the URL where practical so a view can be shared.
The plot and table consume the same filtered record set. CSV export includes
that current set rather than silently exporting the full dataset. The plot can
also be reduced to the single highest-D* measurement from each filtered paper,
while leaving the full table available below.

The table reports the noise-acquisition instrument class for each measurement.
Expanding a row reveals the reported instrument chain and the exact source
location used during the focused audit. A missing instrument citation remains
visible as **Not reported** and does not independently trigger an amber flag.

Dedicated paper pages group every curated device and measurement back under its
original publication. The Coverage page reports material representation,
publication years, noise methods, and metadata completeness directly from the
current dataset. Dataset releases use a human-facing semantic version separate
from the schema version; every CSV export includes `dataset_version`, and the
Releases page records the public changelog and citation guidance.

Unavailable optional values are displayed as **Not reported**, never as zero.
Shot-noise-derived values receive a prominent badge. Each amber result exposes
its exact caution reasons, and every measurement page links back to its paper
and source location when available.

## Repository structure

```text
app/                  Pages and route-level presentation
components/           Reusable atlas, filter, table, plot, and status UI
data/                 Curated CSV sources, templates, dictionary, generated JSON
docs/                 Architecture and future-work notes
lib/data/             Schemas, validation, normalization, filtering, formatting
lib/ingestion/        Future provider-neutral adapter interfaces only
scripts/              Data-validation and generation entry points
tests/                Data and interface behavior tests
```

## Contributing a paper or correction

Public suggestions use GitHub issues rather than a simulated form, email
delivery, or user account. Open a
[new contribution issue](https://github.com/Shlok-Joseph-Paul/cQD-Detector-Compiler-and-Verifier/issues/new)
with the DOI/publication link, affected record ID when applicable, proposed
value and units, and exact source location. Do not upload paywalled PDFs or
share institutional credentials. A curator verifies the evidence and data
validation before merging a change.

## Deployment

1. Run `pnpm run check-data`, `pnpm test`, `pnpm run lint`, and
   `pnpm run build`.
2. Confirm that no secrets, copyrighted full text, or unintended synthetic data
   are present in the change.
3. Commit the curated CSVs and regenerated `data/generated/atlas.json` together.
4. Publish the validated build with the repository's Sites hosting integration.

Sites publishing is managed through the Codex Sites integration rather than a
repository CLI command. In Codex, open this repository and request **“Publish
this project with Sites.”** The integration packages the validated `dist/`
output, records the exact pushed commit as a version, and deploys it with private
access by default. Keep the `project_id` in `.openai/hosting.json`; do not add
temporary repository credentials or deployment tokens to Git configuration.

`.openai/hosting.json` declares the Sites resource shape. The current release
does not require D1, R2, or runtime secrets. Preserve the vinext/Vite build
structure when deploying; a future database or private review queue should be
added behind the existing public data contract rather than coupled directly to
the visualization components.

## Current limitations

- Data entry and scientific review are manual.
- Any bundled records are synthetic demonstrations until maintainers replace
  them with verified literature records.
- Coverage is not yet comprehensive and should not be used for bibliometric
  conclusions.
- Comparability remains limited by differences in area, wavelength, bandwidth,
  frequency, bias, temperature, noise measurement, and reporting conventions.
- Graphically extracted values inherit digitization uncertainty.
- The atlas does not fetch paywalled content, use publisher or institutional
  authentication, or store copyrighted papers.
- There is no autonomous scraping, AI extraction, scheduled discovery,
  theoretical-limit calculation, or automated physical-consistency verdict.
- Green means the record meets the atlas's documentation criteria; it does not
  independently validate the underlying experiment.

## Planned automated discovery

The repository defines provider-neutral interfaces in `lib/ingestion/` for a
future metadata-discovery, lawful open-access resolution, proposal-extraction,
and private review-queue service. These are interfaces only; there is no crawler
or scheduled job in v1.

The proposed daily process is:

1. query supported scholarly metadata APIs;
2. normalize, deduplicate, and triage candidate papers;
3. locate only legally accessible, unauthenticated full text;
4. generate evidence-linked paper/device/measurement proposals;
5. place proposals in a private human-review queue; and
6. publish only explicitly approved records through the existing validation and
   pull-request workflow.

See [Future automated ingestion](./docs/FUTURE_AUTOMATED_INGESTION.md) for the
adapter contracts, legal-access constraints, audit requirements, and staged
migration plan.
