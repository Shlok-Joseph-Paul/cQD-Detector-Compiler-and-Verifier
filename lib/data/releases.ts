export interface DatasetRelease {
  version: string;
  date: string;
  title: string;
  summary: string;
  changes: readonly string[];
}

export const DATASET_VERSION = "1.2.0";
export const DATASET_RELEASE_DATE = "2026-07-19";

export const DATASET_RELEASES: readonly DatasetRelease[] = [
  {
    version: DATASET_VERSION,
    date: DATASET_RELEASE_DATE,
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
