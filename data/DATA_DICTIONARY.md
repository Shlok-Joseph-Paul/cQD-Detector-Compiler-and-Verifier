# CQD Photodiode Atlas data dictionary

The atlas is edited in three CSV files. A paper can own multiple devices, and a
device can own multiple measurements. The graph's unit of observation is a
measurement.

```text
papers.csv (paper_id) <- devices.csv (paper_id)
devices.csv (device_id) <- measurements.csv (device_id)
```

Blank cells become JSON `null`; they are never converted to zero. Use `|` (not a
comma) between authors and between amber-reason keys. Standard CSV quoting is
supported, including commas, doubled quotes, and newlines inside quoted cells.
Identifiers may contain letters, numbers, `.`, `_`, `:`, and `-`, but no spaces.

The files in `data/templates/` contain the exact required headers. Copy their
headers when starting a replacement dataset. The checked-in rows are synthetic
interface examples, each labeled **“Demonstration data—not a literature
record”**. Delete all `demo-*` rows before adding the first literature record.

## `papers.csv`

| Column             | Type                | Required | Meaning                                                             |
| ------------------ | ------------------- | -------- | ------------------------------------------------------------------- |
| `paper_id`         | identifier          | yes      | Stable atlas identifier, referenced by devices.                     |
| `title`            | text                | yes      | Publication title.                                                  |
| `authors`          | pipe-separated text | yes      | Full ordered author list, for example `A. Author \| B. Author`.     |
| `first_author`     | text                | yes      | First-author display name.                                          |
| `journal`          | text                | no       | Journal or repository name.                                         |
| `publication_year` | integer             | yes      | Plausible publication year (1900 through next calendar year).       |
| `doi`              | text                | no       | DOI only; do not invent one when absent.                            |
| `publication_url`  | URL                 | no       | Absolute `http` or `https` publication link.                        |
| `publication_type` | enum                | yes      | `journal_article`, `preprint`, or `demonstration`.                  |
| `peer_reviewed`    | boolean             | yes      | `true` for `journal_article`; `false` for preprints/demonstrations. |
| `notes`            | text                | no       | Paper-level curator notes.                                          |

## `devices.csv`

| Column                 | Type            | Required | Meaning                                                     |
| ---------------------- | --------------- | -------- | ----------------------------------------------------------- |
| `device_id`            | identifier      | yes      | Stable device identifier, referenced by measurements.       |
| `paper_id`             | identifier      | yes      | Existing parent `paper_id`.                                 |
| `material_family`      | text            | yes      | Extensible category such as `PbS`, `HgTe`, or `Other CQDs`. |
| `material_composition` | text            | no       | Composition as reported by the source.                      |
| `device_architecture`  | text            | no       | Photodiode architecture.                                    |
| `device_stack`         | text            | no       | Layer stack in source order.                                |
| `active_area_cm2`      | positive number | no       | Active area in square centimetres.                          |
| `device_notes`         | text            | no       | Device-level curator notes.                                 |

## `measurements.csv`

| Column                          | Type                | Required    | Meaning                                                                                            |
| ------------------------------- | ------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `measurement_id`                | identifier          | yes         | Stable, unique identifier for one plotted measurement.                                             |
| `device_id`                     | identifier          | yes         | Existing parent `device_id`.                                                                       |
| `wavelength_nm`                 | positive number     | yes         | Wavelength associated with the detectivity value, in nm.                                           |
| `detectivity_jones`             | positive number     | yes         | Reported specific detectivity in Jones. Scientific notation such as `2.4e11` is accepted.          |
| `responsivity_a_w`              | nonnegative number  | no          | Responsivity in A/W.                                                                               |
| `eqe_percent`                   | nonnegative number  | no          | External quantum efficiency in percent.                                                            |
| `temperature_k`                 | positive number     | no          | Operating temperature in kelvin.                                                                   |
| `bias_v`                        | number              | no          | Applied bias in volts; zero is a reported zero-bias measurement, while blank means missing.        |
| `measurement_frequency_hz`      | positive number     | no          | Frequency at which noise/detectivity was evaluated.                                                |
| `response_time_s`               | positive number     | no          | Response time in seconds.                                                                          |
| `bandwidth_hz`                  | positive number     | no          | Bandwidth in hertz.                                                                                |
| `noise_method`                  | enum                | yes         | Controlled noise classification listed below.                                                      |
| `detectivity_extraction_method` | enum                | yes         | `directly_reported`, `calculated_from_reported_values`, `graphically_extracted`, or `unspecified`. |
| `source_location`               | text                | no          | Page, figure, table, or supporting-information location.                                           |
| `curator_status`                | enum                | yes         | `reviewed` or `pending_review`.                                                                    |
| `flag`                          | enum                | yes         | Public status: only `green` or `amber`.                                                            |
| `amber_reasons`                 | pipe-separated enum | conditional | One or more reason keys for every amber record; blank for green.                                   |
| `amber_explanation`             | text                | conditional | Human-readable context required for amber; blank for green.                                        |
| `curator_notes`                 | text                | no          | Measurement-specific notes.                                                                        |
| `date_added`                    | ISO date            | yes         | `YYYY-MM-DD`.                                                                                      |
| `date_updated`                  | ISO date            | yes         | `YYYY-MM-DD`, not earlier than `date_added`.                                                       |

### Noise methods

- `measured_noise`: detectivity uses an experimentally measured noise value or
  spectrum.
- `shot_noise_approximation`: shot-noise approximation; always amber and must
  include `shot_noise_approximation` in `amber_reasons`.
- `calculated_shot_and_thermal_noise`: calculated shot and thermal terms;
  preserved as methodology metadata but not automatically amber.
- `nep_from_minimum_detectable_power`: NEP obtained from a minimum detectable
  optical power measurement.
- `unspecified`: method cannot be established.

### Amber reason keys

| Key                        | When to use                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `shot_noise_approximation` | Shot-noise approximation was used.                                                         |
| `above_blip_limit`         | Reported D* appears substantially above a plausible BLIP limit and warrants manual review. |

The validator automatically requires `shot_noise_approximation` when that noise
method is selected. `above_blip_limit` is a curator-applied judgment; the atlas
does not attempt an automatic BLIP calculation. Missing area, temperature,
bias, frequency, source location, graphical extraction, calculated values,
preprint status, or incomplete conditions do not independently trigger amber.
A green record contains no amber reason or explanation. Green is a curation
status—not an endorsement or independent reproduction of the result.

## Validation and generation

From the repository root:

```bash
node --experimental-strip-types scripts/validate-data.ts
node --experimental-strip-types scripts/validate-data.ts --check
```

The first command validates and deterministically regenerates
`data/generated/atlas.json`. `--check` performs no writes and fails when the
generated JSON does not exactly match the CSV sources. Errors name the CSV,
source row, and field.
