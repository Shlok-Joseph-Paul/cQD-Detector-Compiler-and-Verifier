export interface DatasetRelease {
  version: string;
  date: string;
  title: string;
  summary: string;
  changes: readonly string[];
}

export const DATASET_VERSION = "1.4.0";
export const DATASET_RELEASE_DATE = "2026-07-20";

export const DATASET_RELEASES: readonly DatasetRelease[] = [
  {
    version: DATASET_VERSION,
    date: DATASET_RELEASE_DATE,
    title: "Extended detector metrics",
    summary:
      "Adds a source-audited view of responsivity, temporal response, explicit −3 dB bandwidth, and detector linear dynamic range across the atlas.",
    changes: [
      "Reprocessed 25 available main articles and Supporting Information files for extended detector metrics.",
      "Added condition-specific provenance, extraction methods, measurement bounds, and review status for responsivity, response time, rise/fall time, bandwidth, and LDR.",
      "Removed 21 false 1 Hz bandwidth entries that represented detectivity noise-equivalent bandwidth rather than detector −3 dB bandwidth.",
      "Marked 11 papers as source unavailable instead of treating unchecked metrics as not reported.",
      "Extended the paper importer so future uploads extract and validate the same metric set.",
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
    date: DATASET_RELEASE_DATE,
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
    date: DATASET_RELEASE_DATE,
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
