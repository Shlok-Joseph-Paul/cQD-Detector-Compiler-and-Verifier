import type { Metadata } from "next";
import Link from "next/link";

import { MaterialLabel } from "@/components/atlas";
import { SiteShell } from "@/components/SiteShell";
import { countBy, reportingCoverage } from "@/lib/atlas/coverage";
import { formatNoiseMethod } from "@/lib/atlas/format";
import { materialColor } from "@/lib/atlas/materials";
import { normalizeJoinedMeasurement } from "@/lib/atlas/types";
import { atlasData } from "@/lib/data";

export const metadata: Metadata = {
  title: "Dataset coverage",
  description:
    "Transparent coverage statistics for papers, materials, reporting completeness, and measurement methods in the CQD Photodiode Atlas.",
};

export default function CoveragePage() {
  const records = atlasData.records.map(normalizeJoinedMeasurement);
  const papers = new Set(records.map((record) => record.paper.paperId));
  const devices = new Set(records.map((record) => record.device.deviceId));
  const materialCoverage = countBy(
    records,
    (record) => record.device.materialFamily,
  );
  const noiseCoverage = countBy(records, (record) =>
    formatNoiseMethod(record.measurement.noiseMethod),
  );
  const yearCoverage = countBy(atlasData.papers, (paper) =>
    String(paper.publication_year),
  ).sort((left, right) => Number(left.label) - Number(right.label));
  const completeness = reportingCoverage(records);
  const amberCount = records.filter(
    (record) => record.measurement.flag === "amber",
  ).length;
  const measuredNoiseCount = records.filter(
    (record) => record.measurement.noiseMethod === "measured_noise",
  ).length;
  const latestYear = Math.max(
    ...records.map((record) => record.paper.publicationYear),
  );
  const earliestYear = Math.min(
    ...records.map((record) => record.paper.publicationYear),
  );

  return (
    <SiteShell>
      <div className="page-shell coverage-page">
        <header className="coverage-hero">
          <div>
            <p className="eyebrow">Coverage &amp; transparency</p>
            <h1>What the atlas contains</h1>
            <p>
              A live profile of the curated collection—where coverage is strong,
              which measurement details are commonly reported, and where the
              literature remains incomplete.
            </p>
          </div>
          <aside className="coverage-hero__note">
            <strong>Coverage is not prevalence.</strong>
            <p>
              Counts describe records curated into this atlas. They should not
              be interpreted as a complete bibliometric survey of the field.
            </p>
          </aside>
        </header>

        <section className="coverage-stat-grid" aria-label="Dataset totals">
          <article>
            <span>Measurements</span>
            <strong>{records.length}</strong>
            <small>curated operating points</small>
          </article>
          <article>
            <span>Papers</span>
            <strong>{papers.size}</strong>
            <small>original source records</small>
          </article>
          <article>
            <span>Devices</span>
            <strong>{devices.size}</strong>
            <small>distinct reported stacks</small>
          </article>
          <article>
            <span>Publication span</span>
            <strong>
              {earliestYear}–{latestYear}
            </strong>
            <small>years represented</small>
          </article>
        </section>

        <div className="coverage-grid">
          <section
            className="coverage-panel coverage-panel--wide"
            aria-labelledby="material-coverage-heading"
          >
            <header>
              <div>
                <p className="section-kicker">Material representation</p>
                <h2 id="material-coverage-heading">
                  Measurements by material class
                </h2>
              </div>
              <span>{materialCoverage.length} classes</span>
            </header>
            <div className="coverage-bars">
              {materialCoverage.map((slice) => (
                <div className="coverage-bar" key={slice.label}>
                  <div className="coverage-bar__label">
                    <span>
                      <i style={{ background: materialColor(slice.label) }} />
                      <MaterialLabel value={slice.label} />
                    </span>
                    <strong>{slice.count}</strong>
                  </div>
                  <div className="coverage-bar__track">
                    <i
                      style={{
                        width: `${slice.percent}%`,
                        background: materialColor(slice.label),
                      }}
                    />
                  </div>
                  <small>{slice.percent}% of measurements</small>
                </div>
              ))}
            </div>
          </section>

          <section
            className="coverage-panel"
            aria-labelledby="reporting-heading"
          >
            <header>
              <div>
                <p className="section-kicker">Metadata completeness</p>
                <h2 id="reporting-heading">Conditions reported</h2>
              </div>
            </header>
            <div className="coverage-bars coverage-bars--compact">
              {completeness.map((field) => (
                <div className="coverage-bar" key={field.label}>
                  <div className="coverage-bar__label">
                    <span>{field.label}</span>
                    <strong>{field.percent}%</strong>
                  </div>
                  <div className="coverage-bar__track">
                    <i style={{ width: `${field.percent}%` }} />
                  </div>
                  <small>
                    {field.reported} of {field.total} measurements
                  </small>
                </div>
              ))}
            </div>
            <p className="coverage-panel__footnote">
              Reporting completeness means a parameter was stated by the source;
              it does not imply that an unreported capability was absent from
              the detector.
            </p>
          </section>

          <section
            className="coverage-panel"
            aria-labelledby="noise-coverage-heading"
          >
            <header>
              <div>
                <p className="section-kicker">Comparability</p>
                <h2 id="noise-coverage-heading">Noise methodology</h2>
              </div>
            </header>
            <div className="coverage-list">
              {noiseCoverage.map((slice) => (
                <div key={slice.label}>
                  <span>{slice.label}</span>
                  <strong>{slice.count}</strong>
                  <small>{slice.percent}%</small>
                </div>
              ))}
            </div>
            <p className="coverage-panel__footnote">
              {measuredNoiseCount} measurements use experimentally measured
              noise.
              {amberCount
                ? ` ${amberCount} records carry an amber caution.`
                : ""}
            </p>
          </section>

          <section
            className="coverage-panel coverage-panel--wide"
            aria-labelledby="year-heading"
          >
            <header>
              <div>
                <p className="section-kicker">Publication timeline</p>
                <h2 id="year-heading">Curated papers by year</h2>
              </div>
            </header>
            <div className="coverage-timeline">
              {yearCoverage.map((slice) => (
                <div key={slice.label}>
                  <strong>{slice.count}</strong>
                  <i
                    style={{ height: `${Math.max(14, slice.percent * 3)}px` }}
                  />
                  <span>{slice.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="coverage-cta">
          <div>
            <p className="section-kicker">Interpret responsibly</p>
            <h2>Every count needs context.</h2>
          </div>
          <p>
            The methodology explains inclusion boundaries, missing values, noise
            classifications, and amber flags.
          </p>
          <Link className="secondary-button" href="/methodology">
            Read methodology
          </Link>
        </section>
      </div>
    </SiteShell>
  );
}
