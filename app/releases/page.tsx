import type { Metadata } from "next";

import { DatasetDownloadButton } from "@/components/DatasetDownloadButton";
import { SiteShell } from "@/components/SiteShell";
import { atlasData, DATASET_RELEASES, DATASET_VERSION } from "@/lib/data";

export const metadata: Metadata = {
  title: "Dataset releases",
  description:
    "Version history, release notes, and citation guidance for the Photodiode Atlas dataset.",
};

const repositoryUrl =
  "https://github.com/Shlok-Joseph-Paul/cQD-Detector-Compiler-and-Verifier";

export default function ReleasesPage() {
  const current = DATASET_RELEASES[0];

  return (
    <SiteShell>
      <div className="page-shell releases-page">
        <header className="releases-hero">
          <div>
            <p className="eyebrow">Reproducible data</p>
            <h1>Dataset releases</h1>
            <p>
              The scientific dataset is versioned separately from the website.
              Cite the version you used so later corrections or additions do not
              silently change the meaning of an analysis.
            </p>
          </div>
          <aside className="release-current">
            <span>Current dataset</span>
            <strong>v{DATASET_VERSION}</strong>
            <small>
              Released{" "}
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "long",
                timeZone: "UTC",
              }).format(new Date(`${current.date}T00:00:00Z`))}
            </small>
          </aside>
        </header>

        <section
          className="release-citation"
          aria-labelledby="citation-heading"
        >
          <div>
            <p className="section-kicker">Suggested citation</p>
            <h2 id="citation-heading">Reference the exact dataset</h2>
          </div>
          <blockquote>
            Photodiode Atlas, dataset version {DATASET_VERSION}, released{" "}
            {current.date}, accessed [date], {repositoryUrl}.
          </blockquote>
          <p>
            CSV exports include a <code>dataset_version</code> column on every
            measurement row. The data schema remains independently identified as
            schema version {atlasData.schema_version}.
          </p>
        </section>

        <section
          className="release-history"
          aria-labelledby="release-history-heading"
        >
          <header>
            <p className="section-kicker">Changelog</p>
            <h2 id="release-history-heading">Release history</h2>
          </header>
          {DATASET_RELEASES.map((release, index) => (
            <article className="release-entry" key={release.version}>
              <div className="release-entry__marker">
                <span>{index === 0 ? "Current" : "Archived"}</span>
                <i />
              </div>
              <div className="release-entry__content">
                <header>
                  <div>
                    <span>v{release.version}</span>
                    <h3>{release.title}</h3>
                  </div>
                  <time dateTime={release.date}>{release.date}</time>
                </header>
                <p>{release.summary}</p>
                <ul>
                  {release.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
                {index === 0 ? (
                  <dl className="release-entry__counts">
                    <div>
                      <dt>Papers</dt>
                      <dd>{atlasData.papers.length}</dd>
                    </div>
                    <div>
                      <dt>Devices</dt>
                      <dd>{atlasData.devices.length}</dd>
                    </div>
                    <div>
                      <dt>Measurements</dt>
                      <dd>{atlasData.measurements.length}</dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            </article>
          ))}
        </section>

        <section className="release-downloads">
          <div>
            <p className="section-kicker">Source of record</p>
            <h2>Download and inspect</h2>
          </div>
          <p>
            The reviewed CSV files, validation rules, and version history remain
            public in the project repository.
          </p>
          <div>
            <DatasetDownloadButton />
            <a
              className="secondary-button"
              href={`${repositoryUrl}/tree/main/data`}
              target="_blank"
              rel="noreferrer"
            >
              View source data
            </a>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
