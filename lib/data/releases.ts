export interface DatasetRelease {
  version: string;
  date: string;
  title: string;
  summary: string;
  changes: readonly string[];
}

export const DATASET_VERSION = "1.23.0";
export const DATASET_RELEASE_DATE = "2026-08-27";

export const DATASET_RELEASES: readonly DatasetRelease[] = [
  {
    version: DATASET_VERSION,
    date: DATASET_RELEASE_DATE,
    title: "CsPbBr3 noise-floor re-audit",
    summary:
      "Re-audits the Wang et al. sensitized heterojunction against the stated analyzer floor and adds its two additional device-resolved results for review.",
    changes: [
      "Retained the published Device I 2.0e12-Jones claim but marked it amber and pending review because its 3.08e-16 A Hz^-1/2 noise value is about 10500 times below the LFN-1000 manufacturer's listed system floor in power spectral density.",
      "Recorded the second mismatch between the Figure 4d lower frequency of 0.01 Hz and the analyzer's nominal 0.1 Hz lower limit; no custom frontend, background subtraction, or cross-correlation method is disclosed.",
      "Added the directly reported 65.2 µm2 photoactive overlap as 6.52e-7 cm2 and confirmed that the source's area, responsivity, and noise value reproduce its stated D* arithmetic.",
      "Added the graph-labeled Device II and Device III 405 nm zero-bias results as pending-review measurements while preserving their unresolved device-specific noise basis and unavailable Supporting Information.",
      "Recorded the internal Device II responsivity/EQE inconsistency and continued to exclude the non-perovskite bare controls and the 635 nm result without a matching D* value.",
    ],
  },
  {
    version: "1.22.0",
    date: "2026-08-26",
    title: "AgBiS2 charge-transfer and MXene expansion",
    summary:
      "Adds device-resolved modeled- and measured-noise AgBiS2 results and completes the existing ZnO/MXene photodiode record under the frequency-evidence policy.",
    changes: [
      "Added the control and hybrid charge-transfer-layer AgBiS2 photodiodes from Kong et al. with four distinct 1000 nm measured- and shot-noise D* records.",
      "Marked Kong et al.'s two shot-noise estimates amber and published its two measured-noise values as unverified because the responsivity frequency and the particular noise-spectrum frequency used for D* are not established.",
      "Reprocessed the Pi et al. ZnO/MXene AgBiS2 device with its reported active area, ligand-exchange procedure, responsivity, EQE, temporal response, and LDR evidence.",
      "Added Pi et al.'s source-supported 375, 660, and graphically extracted 850 nm points, and reclassified all four Pi measurements as unverified because their responsivity/EQE versus noise-frequency pairing is not established.",
      "Resolved Pi et al.'s internally inconsistent 375 nm summary value in favor of the mutually supporting detailed results, Figure 4d, and Supporting Information Table S1 value of 1.6e12 Jones.",
      "Recorded the Kong hybrid device's 808 nm rise/fall response and graphically extracted linear input range without treating it as a reported dB LDR or explicit -3 dB bandwidth.",
    ],
  },
  {
    version: "1.21.0",
    date: "2026-08-23",
    title: "Layered perovskite and planar-cation PbS expansion",
    summary:
      "Adds two measured-noise photodiodes with frequency-evidence-aware status and device-specific extended metrics.",
    changes: [
      "Added the optimized layered-perovskite photodiode from Li et al. and the EMI+-passivated PbS CQD photodiode from Liu et al.",
      "Published both measurements as unverified because their responsivity or EQE acquisition frequency is not reported, so compatibility with the 1 kHz and 500 Hz noise values cannot be established.",
      "Recorded spectrum-analyzer noise acquisition for Li et al.; its lock-in amplifier acquired EQE only and is not classified as a noise instrument.",
      "Preserved Liu et al.'s results-text lock-in description together with the Experimental Section's dynamic-signal-analyzer and current-preamplifier chain, avoiding a lock-in-only amber classification.",
      "Captured reported responsivity, temporal response, explicit -3 dB bandwidth, LDR, device architecture, and EMI+/halide/EDT ligand-processing evidence with exact source locations.",
      "Excluded comparison devices without independently supported numerical D* points and did not reinterpret a highest-tested 1 MHz modulation rate as detector bandwidth.",
    ],
  },
  {
    version: "1.20.0",
    date: "2026-08-26",
    title: "PbS, InAs, and HgTe detector expansion",
    summary:
      "Adds three CQD detector papers with four conservatively curated measured-noise measurements and device-specific extended metrics.",
    changes: [
      "Added three papers, three devices, and four measurements spanning a multi-interface-engineered PbS photodiode, an SnBr2-passivated InAs photodiode, and a room-temperature HgTe photoconductor.",
      "Recorded the Gong and Xia noise workflows as source-measure-unit acquisition and published those measurements as amber under the automatic parameter-analyzer caution.",
      "Published the two Jung measurements as green because EQE, measured noise, and D* are explicitly described at 300 Hz; the unavailable Supporting Information leaves the acquisition instrument unreported without independently triggering amber.",
      "Captured directly reported responsivity, EQE, temporal response, the Gong 1100 nm bandwidth lower bound, and reported LDR values; calculated only the Jung -0.5 V responsivity from its reported EQE and wavelength.",
      "Withheld Xia's conflicting fall time, unstated response-test bias, non-D* wavelength results, and all values whose device or operating-point assignment was not established.",
      "Preserved inaccessible Supporting Information as source unavailable and excluded SnCl2, zero-bias, and comparison-table values without a matching reported D* measurement.",
    ],
  },
  {
    version: "1.19.0",
    date: "2026-08-26",
    title: "Measured-noise perovskite detector expansion",
    summary:
      "Adds three perovskite detector papers with five high-confidence measured-noise measurements while withholding internally conflicting values.",
    changes: [
      "Added three papers, five devices, and five measurements spanning an individual MAPbBr3 nanoplate photoconductor, three SAM-engineered CsFAMA photodiodes, and a 3D/2D/3D pBp perovskite photodiode.",
      "Published all five measurements as unverified because the sources report measured noise but do not establish the responsivity or EQE acquisition frequency needed to confirm compatibility with the D* noise value.",
      "Recorded FFT-based dark-current noise for Mei et al., oscilloscope-FFT noise acquisition for all three Angela et al. devices, and directly measured 100 Hz noise with an unreported acquisition instrument for Ma et al.",
      "Captured directly reported responsivity, EQE, rise and fall times, the source-calculated Mei bandwidth, measured Ma cutoff frequency, and source-supported LDR values with operating-condition evidence.",
      "Excluded Angela et al. cutoff frequencies because they exceed the main article's stated measurement sweep, excluded Ma et al.'s internally inconsistent LDR, and withheld Shan et al. because the source conflicts over the wavelength of its headline D* value.",
      "Did not classify Keithley instruments used only for I-V characterization as noise acquisition and did not mark measured-noise records amber merely because shot noise was reported to dominate.",
    ],
  },
  {
    version: "1.18.0",
    date: "2026-08-26",
    title: "Perovskite device and DDAB passivation expansion",
    summary:
      "Adds two perovskite detector papers with six directly reported measurements while excluding conflicting and weakly assigned values.",
    changes: [
      "Added two papers, six devices, and six measurements spanning triple-cation MSM control and plasmonic detectors plus three FAPbBr3 perovskite-QD ligand conditions.",
      "Published the three Sadath et al. measurements as amber because D* uses a dark-current shot-noise approximation rather than measured total noise.",
      "Published the three Hung et al. 530 nm measurements as unverified because the source does not establish the responsivity/EQE and noise frequencies used for D*.",
      "Captured directly reported responsivity, EQE, rise and fall times, explicit -3 dB cutoff frequencies, LDR, device area, and solution-phase DDAB ligand treatment with source-specific evidence.",
      "Excluded the conflicting 7.93e12 versus 7.98e12 Jones DDAB*2 result, all 350 nm rows without sufficient signal-condition evidence, and the internally inconsistent Sadath control-1 fall time.",
      "Recognized the COTIC-4Cl paper as already present from v1.17.0 and did not create duplicate paper, device, or measurement records.",
    ],
  },
  {
    version: "1.17.0",
    date: "2026-08-23",
    title: "High-confidence ligand and detector expansion",
    summary:
      "Adds four detector papers with eight directly reported measurements, conservative uncertainty handling, and current noise-frequency evidence labels.",
    changes: [
      "Added four papers, five devices, and eight measurements spanning 2-PCA-passivated PbS, COTIC-4Cl-modified and control perovskite photodiodes, synthesis-native-ligand HgTe, and multiple-injection-grown PbS.",
      "Retained only directly reported or tabulated D* values; excluded graph-estimated PbS controls, graph-only HgTe temperature and bias points, unavailable 2-MPY results, and device-specific bandwidth or LDR assignments that were not sufficiently precise.",
      "Published six dark-current shot-noise D* measurements as amber and the all-FMT HgTe measurement as amber because a lock-in amplifier was the sole classified noise-acquisition instrument.",
      "Published the measured-noise 2-PCA PbS result as unverified because the source reports 500 Hz noise but does not establish the responsivity or EQE acquisition frequency.",
      "Captured directly reported responsivity, EQE, rise and fall times, perovskite TPC response, explicit -3 dB cutoff frequencies, and LDR with metric-specific source locations while preserving unavailable Supporting Information.",
    ],
  },
  {
    version: "1.16.0",
    date: "2026-08-23",
    title: "InSb and Ag2Te measured-noise expansion",
    summary:
      "Adds four CQD detector papers with device-resolved measured-noise provenance and frequency-unverified evidence status.",
    changes: [
      "Added four papers, five devices, and seven measurements spanning ME-passivated InSb photodiodes, an HCl-treated InSb MWIR photoconductor, a Cl/I-Ag2Te ink photodiode, and Bi-doped and undoped Ag2Te photodiodes.",
      "Recorded measured-noise values and acquisition chains, including the SR570/SR785 spectrum-analyzer workflow and the LFN-1000 dedicated noise system; source-measure units used only for J-V characterization were not classified as noise acquisition.",
      "Captured reported responsivity, EQE, temporal response, explicit -3 dB bandwidth, and LDR while preserving unavailable Supporting Information and operating-condition ambiguities.",
      "Published all seven measurements as unverified rather than amber because the sources do not establish the responsivity/EQE versus noise-frequency pairing and do not report an explicit mismatch or modeled-noise caution.",
      "Added the Liu et al. InSb device under the photoconductor detector class so it remains distinct from junction-photodiode comparisons.",
    ],
  },
  {
    version: "1.15.0",
    date: "2026-08-22",
    title: "Frequency-evidence review status",
    summary:
      "Adds a grey unverified category for measured-noise D* records whose responsivity/EQE and noise frequency match cannot be established.",
    changes: [
      "Introduced green, unverified, and amber evidence statuses with precedence amber → unverified → green.",
      "Rechecked incomplete frequency evidence across the current corpus and backfilled eight source-supported frequency matches.",
      "Confirmed Sun et al. as an amber frequency mismatch: 25 Hz responsivity/EQE versus the 500 kHz measured-noise value used for D*.",
      "Reclassified the 159 published measurements as 77 amber, 57 unverified, and 25 green; among 88 papers with published measurements, precedence yields 38 amber, 32 unverified, and 18 green papers.",
      "Added unverified badges, filters, plot markers, table and paper styling, coverage counts, export support, validation rules, and importer normalization.",
      "Kept calculated shot- and Johnson-noise records outside the frequency-match test while retaining their existing amber cautions.",
      "Redesigned the Atlas graph controls with a compact detector-type selector, clearer view and scope groups, responsive comparison controls, a collapsible material filter, streamlined summaries and tooltips, and balanced evidence markers.",
      "Simplified the methodology page with a concise at-a-glance summary, compact evidence-status explanations, expandable technical rules, and restored recommended measurement-guidance papers in the sidebar.",
    ],
  },
  {
    version: "1.14.0",
    date: "2026-08-19",
    title: "Signal-noise frequency caution and InAs passivation",
    summary:
      "Adds three halide-passivated InAs CQD photodiodes and makes an explicit responsivity/EQE versus noise-frequency mismatch an amber condition.",
    changes: [
      "Added the Cl-, Br-, and I-passivated InAs CQD photodiodes from Lee et al. with their 980 nm measured-noise detectivity, EQE, calculated responsivity, and 90-10% fall times.",
      "Recorded the 25 Hz optical chopping frequency for EQE and responsivity separately from the 10 kHz noise frequency used for D*.",
      "Added an automatic amber reason when responsivity or EQE is acquired at a different frequency from the noise value used for D*; missing frequency evidence alone remains neutral.",
      "Applied a curator-directed preamplifier-floor caution because the disconnected-device background spectrum falls below the SR570 preamplifier background noise.",
    ],
  },
  {
    version: "1.13.0",
    date: "2026-08-22",
    title: "Provisional review workflow",
    summary:
      "Activates a public pending-review status for evidence-backed measurements that require a named human curation decision without redefining green or amber methodology flags.",
    changes: [
      "Added explicit provisional approval to the discovery decision workflow with a required public review explanation.",
      "Displayed needs-human-review badges and explanations on provisional measurement and paper records.",
      "Excluded provisional measurements from performance plots, paper maxima, rankings, and aggregate material summaries while retaining them in the searchable measurement index and exports.",
      "Preserved every previously published measurement as reviewed; no historical paper reparsing or CSV migration was required.",
    ],
  },
  {
    version: "1.12.0",
    date: "2026-08-22",
    title: "CQD phototransistor caution release",
    summary:
      "Adds three curator-approved PbSe, Ag2Te, and InAs CQD phototransistor papers with four headline measurements and explicit shot-noise cautions.",
    changes: [
      "Added two PbSe CQD/IGZO devices spanning TBAI-exchanged 1064 nm detection and a larger MPA-exchanged 1550 nm device.",
      "Added the Ag2Te CQD/ZnO 940 nm champion with its reported responsivity and 10-90% rise and 90-10% fall times.",
      "Added the gradated-bandgap InAs CQD/ZnON 905 nm champion with its reported responsivity, EQE, and device-matched multi-second temporal response.",
      "Marked all four measurements amber because D* was calculated from dark-current shot-noise approximations rather than measured total-noise spectra.",
      "Held control devices, intensity sweeps, approximate bounds, aged-device values, and literature-comparison rows outside the approved headline set.",
      "Preserved unavailable Supporting Information and conflicting summary values explicitly in source and curator notes.",
    ],
  },
  {
    version: "1.11.0",
    date: "2026-08-18",
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
    date: "2026-08-22",
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
    date: "2026-08-22",
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
    date: "2026-08-22",
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
