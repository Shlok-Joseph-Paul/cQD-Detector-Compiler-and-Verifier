import type { Metadata } from "next";

import { MaterialsOverview } from "@/components/atlas";
import { SiteShell } from "@/components/SiteShell";
import { summarizeMaterials } from "@/lib/atlas/materials";
import { normalizeJoinedMeasurement } from "@/lib/atlas/types";
import { atlasData } from "@/lib/data";

export const metadata: Metadata = {
  title: "Materials",
  description:
    "Browse CQD and perovskite material families represented in the curated photodetector measurement atlas.",
};

export default function MaterialsPage() {
  const records = atlasData.records.map(normalizeJoinedMeasurement);
  const summaries = summarizeMaterials(records);

  return (
    <SiteShell>
      <section className="page-shell materials-hero">
        <p className="eyebrow">Material index</p>
        <div className="materials-hero__grid">
          <h1>Included absorber families</h1>
          <p>
            Counts and ranges are calculated directly from measurement records.
            Add a new material family in the CSV files and it appears here
            without changing the interface.
          </p>
        </div>
      </section>

      {summaries.length ? <MaterialsOverview summaries={summaries} /> : null}

      {!summaries.length ? (
        <section className="page-shell material-grid">
          <div className="empty-state">
            <h2>No materials yet</h2>
            <p>
              Add a validated paper, device, and measurement to the editable CSV
              files to populate this index.
            </p>
          </div>
        </section>
      ) : null}
    </SiteShell>
  );
}
