# Photodiode Atlas data dictionary

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

| Column                            | Type                | Required    | Meaning                                                                                                                                                   |
| --------------------------------- | ------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `device_id`                       | identifier          | yes         | Stable device identifier, referenced by measurements.                                                                                                     |
| `paper_id`                        | identifier          | yes         | Existing parent `paper_id`.                                                                                                                               |
| `technology_family`               | enum                | yes         | `cqd` or `perovskite`.                                                                                                                                    |
| `material_family`                 | text                | yes         | Index label for the absorber. Use the reported perovskite formula rather than a broad class; examples include `PbS`, `HgTe`, `CH3NH3PbI3`, and `CsPbBr3`. |
| `material_composition`            | text                | no          | Composition as reported by the source.                                                                                                                    |
| `device_architecture`             | text                | no          | Photodiode architecture.                                                                                                                                  |
| `device_stack`                    | text                | no          | Layer stack in source order.                                                                                                                              |
| `active_area_cm2`                 | positive number     | no          | Active area in square centimetres.                                                                                                                        |
| `ligand_exchange_status`          | enum                | yes         | Review outcome: `reported`, `not_used`, `not_reported`, `not_applicable`, `ambiguous`, `source_unavailable`, or `not_checked`.                            |
| `ligand_exchange_type`            | enum                | conditional | `solid_state`, `solution_phase`, `ink_phase`, `mixed`, or `other`; required when an exchange is reported.                                                 |
| `ligand_exchange_chemicals`       | pipe-separated text | conditional | Exchange ligand(s), salt(s), acid(s), or other reported treatment chemicals.                                                                              |
| `native_ligands`                  | pipe-separated text | no          | Starting/native ligand(s), when the source identifies them.                                                                                               |
| `ligand_exchange_target`          | text                | no          | Device layer, CQD ink, or film receiving the treatment.                                                                                                   |
| `ligand_exchange_conditions`      | text                | no          | Concise reported recipe details such as solvent, concentration, temperature, time, or treatment sequence.                                                 |
| `ligand_exchange_source_location` | text                | conditional | Exact main-article or Supporting Information page, figure, table, or section; required for `reported`.                                                    |
| `device_notes`                    | text                | no          | Device-level curator notes.                                                                                                                               |

### Ligand exchange

Ligand exchange is stored at the device level because one paper may compare
different ligand systems, and a multilayer photodiode may treat its absorber
and transport layers differently. `solid_state` covers film or layer-by-layer
exchange; `solution_phase` covers exchange completed in solution before film
deposition; `ink_phase` covers an explicitly prepared exchanged CQD ink;
`mixed` preserves devices using more than one of these routes.

Use `not_used` when the source explicitly says the device avoids or obviates
ligand exchange. Use `not_reported` only after the main article and every available Supporting
Information file have been checked. Use `source_unavailable` when that source
set could not be inspected, `ambiguous` when ligand language cannot be assigned
confidently to the atlas device or process type, and `not_applicable` for a
device outside CQD ligand exchange. The automated parser stages evidence and a
status for curator review; it never treats a missing search hit as proof when
OCR is required.

## `measurements.csv`

| Column                                   | Type                | Required    | Meaning                                                                                            |
| ---------------------------------------- | ------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `measurement_id`                         | identifier          | yes         | Stable, unique identifier for one plotted measurement.                                             |
| `device_id`                              | identifier          | yes         | Existing parent `device_id`.                                                                       |
| `wavelength_nm`                          | positive number     | yes         | Wavelength associated with the detectivity value, in nm.                                           |
| `detectivity_jones`                      | positive number     | yes         | Reported specific detectivity in Jones. Scientific notation such as `2.4e11` is accepted.          |
| `responsivity_a_w`                       | nonnegative number  | no          | Responsivity in A/W.                                                                               |
| `responsivity_wavelength_nm`             | positive number     | no          | Wavelength of the responsivity value; may differ from the D* wavelength.                           |
| `responsivity_bias_v`                    | number              | no          | Bias used for the responsivity value.                                                              |
| `responsivity_temperature_k`             | positive number     | no          | Temperature used for the responsivity value.                                                       |
| `responsivity_source_location`           | text                | no          | Exact main-article or Supporting Information evidence location.                                    |
| `responsivity_extraction_method`         | enum                | conditional | Extended-metric extraction classification.                                                         |
| `eqe_percent`                            | nonnegative number  | no          | External quantum efficiency in percent.                                                            |
| `temperature_k`                          | positive number     | no          | Operating temperature in kelvin.                                                                   |
| `bias_v`                                 | number              | no          | Applied bias in volts; zero is a reported zero-bias measurement, while blank means missing.        |
| `measurement_frequency_hz`               | positive number     | no          | Frequency at which noise/detectivity was evaluated.                                                |
| `response_time_s`                        | positive number     | no          | Response time in seconds.                                                                          |
| `rise_time_s`                            | positive number     | no          | Explicitly reported rise time in seconds.                                                          |
| `fall_time_s`                            | positive number     | no          | Explicitly reported fall time in seconds.                                                          |
| `response_time_definition`               | text                | no          | Reported threshold convention or temporal definition.                                              |
| `response_time_wavelength_nm`            | positive number     | no          | Illumination wavelength for the temporal response.                                                 |
| `response_time_bias_v`                   | number              | no          | Bias used for the temporal response.                                                               |
| `response_time_source_location`          | text                | no          | Exact source location for response, rise, and fall times.                                          |
| `response_time_limit`                    | enum                | no          | Whether the value is measured, limited, or a bound.                                                |
| `response_time_extraction_method`        | enum                | conditional | Extended-metric extraction classification.                                                         |
| `bandwidth_hz`                           | positive number     | no          | Explicit -3 dB bandwidth in hertz.                                                                 |
| `bandwidth_bias_v`                       | number              | no          | Bias used for the explicit -3 dB bandwidth.                                                        |
| `bandwidth_source_location`              | text                | no          | Exact source location for the explicit -3 dB bandwidth.                                            |
| `bandwidth_limit`                        | enum                | conditional | `measured`, `instrument_limited`, `upper_bound`, `lower_bound`, or `not_reported`.                 |
| `bandwidth_extraction_method`            | enum                | conditional | Extended-metric extraction classification.                                                         |
| `linear_dynamic_range_db`                | nonnegative number  | no          | Explicitly reported detector linear dynamic range in dB.                                           |
| `linear_dynamic_range_min`               | number              | no          | Lower bound of a reported linear optical-input range.                                              |
| `linear_dynamic_range_max`               | number              | no          | Upper bound of a reported linear optical-input range.                                              |
| `linear_dynamic_range_units`             | text                | conditional | Units for LDR range bounds; required when either bound is present.                                 |
| `linear_dynamic_range_definition`        | text                | no          | Source definition or logarithmic convention.                                                       |
| `linear_dynamic_range_source_location`   | text                | no          | Exact source location for LDR evidence.                                                            |
| `linear_dynamic_range_extraction_method` | enum                | conditional | Extended-metric extraction classification.                                                         |
| `extended_metrics_review_status`         | enum                | no          | `not_checked`, `checked`, `source_unavailable`, or `needs_review`.                                 |
| `extended_metrics_review_date`           | ISO date            | conditional | Required after a source check; blank while `not_checked`.                                          |
| `extended_metrics_notes`                 | text                | no          | Matching, limitation, and ambiguity notes for the extended-metric pass.                            |
| `noise_method`                           | enum                | yes         | Controlled noise classification listed below.                                                      |
| `noise_instruments`                      | pipe-separated enum | yes         | Instrument class or classes used to acquire noise; controlled vocabulary below.                    |
| `noise_instrument_details`               | text                | no          | Reported model and acquisition-chain details; never inferred from an unrelated measurement.        |
| `noise_instrument_source`                | text                | no          | Page, figure, section, or supporting-information location for the instrument evidence.             |
| `detectivity_extraction_method`          | enum                | yes         | `directly_reported`, `calculated_from_reported_values`, `graphically_extracted`, or `unspecified`. |
| `source_location`                        | text                | no          | Page, figure, table, or supporting-information location.                                           |
| `curator_status`                         | enum                | yes         | `reviewed` or `pending_review`.                                                                    |
| `flag`                                   | enum                | yes         | Public status: only `green` or `amber`.                                                            |
| `amber_reasons`                          | pipe-separated enum | conditional | One or more reason keys for every amber record; blank for green.                                   |
| `amber_explanation`                      | text                | conditional | Human-readable context required for amber; blank for green.                                        |
| `curator_notes`                          | text                | no          | Measurement-specific notes.                                                                        |
| `date_added`                             | ISO date            | yes         | `YYYY-MM-DD`.                                                                                      |
| `date_updated`                           | ISO date            | yes         | `YYYY-MM-DD`, not earlier than `date_added`.                                                       |

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

### Extended performance metrics

Responsivity, temporal response, explicit -3 dB bandwidth, and linear dynamic
range retain their own operating conditions and source locations because they
may not have been measured at the D* operating point. A value is attached to a
measurement only when it describes the same device; mismatched wavelength or
bias remains explicit in the metric-specific fields.

Extended-metric extraction methods are `directly_reported`,
`graphically_extracted`, `calculated_from_reported_values`, `not_reported`, and
`ambiguous`. A completed source check must classify every metric group, even
when its numeric fields remain blank. `source_unavailable` means the source was
not available for inspection and must never be presented as `not_reported`.

Response-time limits are `measured`, `instrument_limited`, `source_limited`,
`upper_bound`, `lower_bound`, and `not_reported`. Rise time, fall time, response
time, and -3 dB bandwidth are not silently converted into one another. The
highest tested modulation frequency is not a -3 dB bandwidth unless the source
explicitly identifies it as such. Missing extended metrics do not affect the
green/amber flag.

### Noise instruments

`noise_instruments` describes how the noise signal used for D* was acquired,
not the instrument used to measure EQE, bandwidth, or transient response. Use
multiple pipe-separated values when a paper combines methods across frequency
ranges.

- `spectrum_analyzer`: spectrum, signal, dynamic-signal, or FFT spectrum
  analyzer.
- `lock_in_amplifier`: lock-in amplifier operating in a noise-measurement mode.
- `oscilloscope_fft`: noise time traces recorded by an oscilloscope and
  transformed by FFT.
- `transient_current_fft`: current transients transformed by FFT when the
  acquisition hardware is not identified.
- `dedicated_noise_analyzer`: dedicated low-frequency or semiconductor-noise
  analyzer.
- `source_measure_unit`: an SMU or parameter analyzer used to acquire the noise
  signal, including as part of a chain with a dedicated noise analyzer. Do not
  use this classification when the unit only supplies bias, records J–V data,
  or measures responsivity/EQE.
- `other`: a reported acquisition method outside the controlled classes;
  explain it in `noise_instrument_details`.
- `not_reported`: noise is reported or implied, but the supplied source does
  not identify its acquisition instrument.
- `not_applicable`: D* uses a modeled noise approximation rather than measured
  total noise.

`not_reported` and `not_applicable` cannot be combined with another instrument.
Every shot-noise-approximation record must use `not_applicable`. A missing or
unreported instrument does not change the green/amber flag. A lock-in counts
only when it acquired noise; lock-ins used only for EQE, responsivity, or other
optical characterization are excluded from `noise_instruments`.

### Amber reason keys

| Key                                     | When to use                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `shot_noise_approximation`              | Shot-noise approximation was used.                                                         |
| `lock_in_only_noise_measurement`        | A lock-in amplifier was the sole noise-acquisition class.                                  |
| `source_measure_unit_noise_measurement` | An SMU or parameter analyzer acquired the noise signal.                                    |
| `above_blip_limit`                      | Reported D* appears substantially above a plausible BLIP limit and warrants manual review. |

The validator automatically requires `shot_noise_approximation` when that noise
method is selected, `lock_in_only_noise_measurement` when `lock_in_amplifier` is
the only noise instrument, and `source_measure_unit_noise_measurement` whenever
`source_measure_unit` acquired noise. A mixed FFT-plus-lock-in workflow does not
trigger the lock-in-only reason. `above_blip_limit` is a curator-applied
judgment; the atlas does not attempt an automatic BLIP calculation. Missing
area, temperature, bias, frequency, source location, graphical extraction,
calculated values, preprint status, or incomplete conditions do not
independently trigger amber. A green record contains no amber reason or
explanation. Green is a curation status—not an endorsement or independent
reproduction of the result.

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
