export interface DatasetRelease {
  version: string;
  date: string;
  title: string;
  summary: string;
  changes: readonly string[];
}

export const DATASET_VERSION = "1.11.0";
export const DATASET_RELEASE_DATE = "2026-08-18";

export const DATASET_RELEASES: readonly DatasetRelease[] = [
  {
    version: DATASET_VERSION,
    date: DATASET_RELEASE_DATE,
    title: "CQD interface and HgTe synthesis expansion",
    summary:
      "Adds five curator-approved PbS and HgTe CQD photodiode papers with device-resolved interface engineering, measured-noise provenance, and shot-noise cautions.",
    changes: [
      "Added 10 devices and 12 measurements spanning top-illuminated PbS microstructures, Poly-TPD/UVO and ionic-density interface engineering, DPP-activated HgTe synthesis, and a CdHgTe CQD electron-transport layer.",
      "Recorded measured-noise D* for the microstructured PbS, Poly-TPD/UVO PbS, DPP-HgTe, and CdHgTe-ETL devices with their reported acquisition chains and operating frequencies.",
      "Marked four microstructure measurements amber because a semiconductor parameter analyzer/noise module was the sole reported noise-acquisition instrument.",
      "Marked four ionic-density measurements amber because D* was calculated from a dark-current shot-noise approximation; preserved the separately measured noise spectrum as contextual evidence rather than the D* basis.",
      "Captured responsivity, EQE, temporal response, explicit -3 dB bandwidth, and LDR where device and operating-point evidence supported the assignment, while retaining unavailable supplements as source-unavailable reviews.",
      "Preserved the ionic-density paper's conflict between its no-CPE prose and Table 1, retaining the internally consistent tabulated 1.4e12-Jones value with a curator note.",
    ],
  },
  {
    version: "1.10.0",
    date: DATASET_RELEASE_DATE,
    title: "PbS homojunction champion addition",
    summary:
      "Adds the curator-selected highest-detectivity PbS CQD homojunction device with explicit shot-noise and operating-mode cautions.",
    changes: [
      "Added the 3.6 nm PbS-TBAI/PbS-EDT p-n homojunction photodiode and its approximately 1.2e11-Jones result at context-linked 450 nm and +1 V.",
      "Retained only the weakest-irradiance peak point from the highest-D* size variant by curator direction, excluding the 3.1 and 4.2 nm devices and the remaining intensity-dependent points.",
      "Marked the measurement amber because D* uses a dark-current shot-noise approximation rather than a measured total-noise spectrum.",
      "Preserved that the +1 V measurement operates in the paper's high-field photoconductive response regime despite the rectifying homojunction architecture.",
      "Omitted the internally inconsistent EQE axis and unmatched temporal values; the complete article and Supporting Information report no explicit -3 dB bandwidth or LDR.",
    ],
  },
  {
    version: "1.9.0",
    date: DATASET_RELEASE_DATE,
    title: "Measured-noise SWIR photodiode expansion",
    summary:
      "Adds three curator-approved HgTe, PbS, and Sn–Pb photodiode papers and refines green eligibility for mixed noise-acquisition chains.",
    changes: [
      "Added hybrid-passivated HgTe CQD, HIES-modified PbS CQD/organic, and Sn(SCN)2-passivated Sn–Pb perovskite photodiodes with four measured-noise D* records.",
      "Stored the HIES device's engineering-comparable 65 dB LDR while preserving the authors' warning that the materials-field formula yields an overestimated 130 dB value.",
      "Recorded the Sn–Pb device's complete dynamic-signal-analyzer, preamplifier, lock-in, and parameter-analyzer noise chain together with its measured 1/f spectrum.",
      "Refined the automatic caution policy so parameter-analyzer-only noise acquisition remains amber, while mixed workflows that also report a spectrum or dynamic-signal analyzer remain eligible for green curator review.",
      "Published all four new measurements as green following explicit curator approval.",
    ],
  },
  {
    version: "1.8.0",
    date: DATASET_RELEASE_DATE,
    title: "Six-paper detector expansion",
    summary:
      "Adds six curator-approved CQD and metal-halide perovskite detector papers with device-resolved performance, noise-method evidence, and review cautions.",
    changes: [
      "Added 12 devices and 14 measurements spanning flexible strained perovskites, interface-modified photodiodes, Fe@Cx transport layers, mechanochemical CsPbBr3 nanocrystals, AgBiS2/InGaAs, and a CsPbBr3-sensitized SnSe2/MoTe2 heterojunction.",
      "Retained only the two measured-noise D* records from the Wang CsPbIBr2/CDCA study, excluding its shot-noise estimates by curator direction.",
      "Recorded measured-noise instrumentation for the strain-driven Kim study and the Wang CsPbBr3/SnSe2/MoTe2 heterojunction.",
      "Applied amber cautions to four Fe@Cx and one AgBiS2/InGaAs shot-noise estimates, plus two CsPbBr3 records derived from source-measure-unit current traces.",
      "Published seven green and seven amber measurements with source locations, operating conditions, extended metrics, and curator notes.",
    ],
  },
  {
    version: "1.7.0",
    date: "2026-08-17",
    title: "Johnson-noise photoconductor caution",
    summary:
      "Adds a curator-approved HgTe CQD photoconductor record and a mandatory amber classification for Johnson-noise-only detectivity estimates.",
    changes: [
      "Added the Sanvordenker et al. HgTe branched-nanorod photoconductor at the curator-directed 1100 nm representative wavelength.",
      "Added a Johnson-noise-approximation noise method and matching automatically required amber reason.",
      "Preserved that the source used broadband infrared illumination above 1.1 µm and did not measure a total-noise spectrum.",
      "Recorded the curator assessment that the reported D* is likely overestimated by orders of magnitude.",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-08-14",
    title: "Avalanche and lead-free CQD additions",
    summary:
      "Adds two curator-reviewed CQD photodiode papers with device-resolved ligand chemistry, operating conditions, speed metrics, and explicit noise cautions.",
    changes: [
      "Added four ligand-defined PbS avalanche-photodiode devices and eight 940 nm measurements from Kim et al.",
      "Applied a curator-directed amber caution to the Kim records because the D* noise basis is not reported and high-bias noise may materially affect interpretation.",
      "Added AgI-control and dual-halometallate AgBiS2 photodiodes with six directly reported measurements from Sharma et al.",
      "Preserved Sharma's shot-noise approximation, wavelength-specific responsivity, 10-90% rise and 90-10% fall times, and explicit -3 dB bandwidths.",
      "Expanded the controlled amber vocabulary with a manual noise-method-not-reported reason that requires a curator explanation and is never inferred from a blank field.",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-08-12",
    title: "Detector-class expansion",
    summary:
      "Adds device-level photodiode, photoconductor, and phototransistor classification throughout ingestion, validation, filtering, visualization, and export.",
    changes: [
      "Added a required detector_class field to every device and migrated the existing photodiode-only corpus without changing its scientific values.",
      "Expanded full-text proposal extraction to classify supported detector mechanisms from page-located architecture evidence.",
      "Leaves generic or conflicting photodetector terminology uncertain until a curator resolves the device class.",
      "Added detector-class filtering to shared graph, table, URL, search, detail, and CSV workflows.",
      "Added a cross-class comparison caution while preserving the combined view and existing green/amber rules.",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-07-20",
    title: "Extended detector metrics",
    summary:
      "Adds a source-audited view of responsivity, temporal response, explicit −3 dB bandwidth, and detector linear dynamic range, together with an interactive interface for exploring those metrics.",
    changes: [
      "Reprocessed 25 available main articles and Supporting Information files for extended detector metrics.",
      "Added condition-specific provenance, extraction methods, measurement bounds, and review status for responsivity, response time, rise/fall time, bandwidth, and LDR.",
      "Removed 21 false 1 Hz bandwidth entries that represented detectivity noise-equivalent bandwidth rather than detector −3 dB bandwidth.",
      "Marked 11 papers as source unavailable instead of treating unchecked metrics as not reported.",
      "Extended the paper importer so future uploads extract and validate the same metric set.",
      "Added configurable performance-map and compare-metrics modes with curated tradeoff presets, shareable URL state, and maximum-D* or all-measurements scopes.",
      "Added Overview, Optical, Speed, and Methods table views plus availability, review-status, and normalized numeric metric filters.",
      "Preserved metric-specific operating conditions, source-unavailable provenance, temporal and bandwidth limits, and LDR lower bounds throughout plot and table displays.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-07-20",
    title: "Literature and performance-map expansion",
    summary:
      "Expands the curated literature corpus and improves the performance map's scientific labeling and visual comparison cues.",
    changes: [
      "Added six curated photodiode papers, including Ag–HgTe and multiresonant HgTe-grid devices.",
      "Refined marker opacity, outlines, sizing, hover focus, and measurement-status shapes on the performance map.",
      "Preserved conventional capitalization for material formulas such as InSb, HgTe, and HgCdSe.",
      "Regenerated the public atlas while retaining stable paper, device, and measurement identifiers.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-07-19",
    title: "Noise-acquisition caution policy",
    summary:
      "Distinguishes noise acquisition from optical characterization and adds amber cautions for lock-in-only and SMU-based noise measurements.",
    changes: [
      "Counted lock-in amplifiers only when explicitly used to acquire noise, not when used only for responsivity or EQE.",
      "Added automatic amber reasons for lock-in-only and source-measure-unit noise acquisition.",
      "Reclassified three lock-in-only measurements and one SMU-assisted noise measurement as amber.",
      "Kept mixed FFT-plus-lock-in noise workflows outside the lock-in-only caution rule.",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-07-20",
    title: "Noise-instrument audit",
    summary:
      "Adds evidence-backed acquisition-instrument classifications for every curated detectivity measurement.",
    changes: [
      "Reprocessed all 23 source papers for noise-measurement instrumentation.",
      "Distinguished spectrum analyzers, lock-in amplifiers, FFT methods, and dedicated noise analyzers.",
      "Preserved mixed acquisition chains used across different frequency ranges.",
      "Marked instruments as not reported or not applicable without changing amber status.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-07-20",
    title: "First curated literature release",
    summary:
      "Establishes the atlas as a versioned, reproducible collection of curator-reviewed CQD photodiode measurements.",
    changes: [
      "Published the first curated multi-material literature dataset.",
      "Standardized Paper → Device → Measurement provenance across every record.",
      "Applied the documented green and amber review policy.",
      "Added source locations, operating conditions, and extraction methods when reported.",
    ],
  },
] as const;
