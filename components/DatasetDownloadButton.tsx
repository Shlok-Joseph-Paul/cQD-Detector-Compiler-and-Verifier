"use client";

import { atlasRecordsToCsv } from "@/lib/atlas/csv";
import { normalizeJoinedMeasurement } from "@/lib/atlas/types";
import { atlasData, DATASET_VERSION } from "@/lib/data";

export function DatasetDownloadButton() {
  const download = () => {
    const records = atlasData.records.map(normalizeJoinedMeasurement);
    const blob = new Blob([atlasRecordsToCsv(records)], {
      type: "text/csv;charset=utf-8",
    });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `cqd-photodiode-atlas-v${DATASET_VERSION}.csv`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  return (
    <button className="primary-button" type="button" onClick={download}>
      Download v{DATASET_VERSION} CSV
    </button>
  );
}
