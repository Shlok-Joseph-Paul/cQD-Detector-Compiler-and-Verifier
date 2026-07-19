import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { MaterialLabel } from "@/components/atlas";
import { SiteShell } from "@/components/SiteShell";
import { formatScientific } from "@/lib/atlas/format";
import { materialColor, summarizeMaterials } from "@/lib/atlas/materials";
import { normalizeJoinedMeasurement } from "@/lib/atlas/types";
import { atlasData } from "@/lib/data";

export const metadata: Metadata = {
  title: "Materials",
  description:
    "Browse CQD material families represented in the curated photodiode measurement atlas.",
};

export default function MaterialsPage() {
  const records = atlasData.records.map(normalizeJoinedMeasurement);
  const summaries = summarizeMaterials(records);

  return (
    <SiteShell>
      <section className="page-shell materials-hero">
        <p className="eyebrow">Material index</p>
        <div className="materials-hero__grid">
          <h1>Included CQD families</h1>
          <p>
            Counts and ranges are calculated directly from measurement records.
            Add a new material family in the CSV files and it appears here
            without changing the interface.
          </p>
        </div>
      </section>

      <section
        className="page-shell material-grid"
        aria-label="Material families"
      >
        {summaries.length ? (
          summaries.map((summary) => (
            <Link
              className="material-card"
              href={`/materials/${encodeURIComponent(summary.material)}`}
              key={summary.material}
              style={
                {
                  "--material-color": materialColor(summary.material),
                } as CSSProperties
              }
            >
              <div className="material-card__header">
                <h2>
                  <MaterialLabel value={summary.material} />
                </h2>
                <span aria-hidden="true">↗</span>
              </div>
              <dl className="material-card__metrics">
                <div>
                  <dt>Papers</dt>
                  <dd>{summary.paperCount}</dd>
                </div>
                <div>
                  <dt>Measurements</dt>
                  <dd>{summary.measurementCount}</dd>
                </div>
                <div className="material-card__wide">
                  <dt>Wavelength range</dt>
                  <dd>
                    {summary.wavelengthMinNm.toLocaleString()}–
                    {summary.wavelengthMaxNm.toLocaleString()} nm
                  </dd>
                </div>
                <div className="material-card__wide">
                  <dt>Highest curated D*</dt>
                  <dd>
                    {formatScientific(summary.highestDetectivityJones)} Jones
                  </dd>
                </div>
              </dl>
              <div
                className="noise-split"
                aria-label="Noise method percentages"
              >
                <div>
                  <span>Measured noise</span>
                  <strong>{summary.measuredNoisePercent.toFixed(0)}%</strong>
                </div>
                <div>
                  <span>Shot-noise estimate</span>
                  <strong>{summary.shotNoisePercent.toFixed(0)}%</strong>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="empty-state">
            <h2>No materials yet</h2>
            <p>
              Add a validated paper, device, and measurement to the editable CSV
              files to populate this index.
            </p>
          </div>
        )}
      </section>
    </SiteShell>
  );
}
